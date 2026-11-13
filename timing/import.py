"""Validate the Monza slice and emit SQL for an atomic D1 import."""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import sys
from urllib.request import urlopen

SESSION = 9590
DRIVERS = (1, 4)
FIELDS = ('lap_duration', 'duration_sector_1', 'duration_sector_2', 'duration_sector_3')


def milliseconds(value):
    if value is None:
        return None
    if type(value) not in (int, float):
        raise ValueError('Expected numeric timing or null')
    duration = Decimal(str(value)) * 1000
    if not duration.is_finite() or not 0 < duration <= 3_600_000 or duration != int(duration):
        raise ValueError('Expected a positive duration at millisecond resolution')
    return int(duration)


def normalize(payload):
    rows = []
    for driver in DRIVERS:
        records = payload[str(driver)]
        numbers = set()
        for lap in records:
            number = lap['lap_number']
            if (lap['session_key'] != SESSION or lap['driver_number'] != driver
                    or type(number) is not int or number in numbers):
                raise ValueError('Unexpected session, driver or duplicate lap')
            numbers.add(number)
            total, *sectors = times = [milliseconds(lap[field]) for field in FIELDS]
            if type(lap['is_pit_out_lap']) is not bool:
                raise ValueError('Expected a pit-out flag')
            if lap['is_pit_out_lap']:
                quality = 'pit_out'
            elif None in times:
                quality = 'missing'
            elif total != sum(sectors):
                quality = 'inconsistent'
            else:
                quality = 'complete'
            rows.append((driver, number, *times, quality))
        if numbers != set(range(1, 54)) or not any(
            row[0] == driver and row[-1] == 'complete' for row in rows
        ):
            raise ValueError(f'Expected 53 consecutive race laps and usable timings for driver {driver}')
    return sorted(rows)


def quote(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + value.replace("'", "''") + "'"


def import_sql(rows, provider, fetched_at):
    revision = hashlib.sha256(json.dumps([provider, SESSION, rows]).encode()).hexdigest()
    statements = []
    def insert(table, values):
        statements.append(f'INSERT OR IGNORE INTO {table} VALUES ({", ".join(map(quote, values))});')
    insert('timing_revision', (revision, fetched_at, provider, SESSION))
    for row in rows:
        insert('timing_lap', (revision, *row))
    statements.append(
        f"INSERT INTO timing_active VALUES (1, '{revision}') "
        "ON CONFLICT(singleton) DO UPDATE SET revision = excluded.revision;"
    )
    return '\n'.join(statements)


def fetch():
    payload = {}
    for driver in DRIVERS:
        url = f'https://api.openf1.org/v1/laps?session_key={SESSION}&driver_number={driver}'
        with urlopen(url, timeout=20) as response:
            payload[str(driver)] = json.load(response)
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture', action='store_true', help='Generate clearly labeled synthetic test laps')
    args = parser.parse_args()
    if args.fixture:
        payload = {str(driver): [
            dict(session_key=SESSION, driver_number=driver, lap_number=lap,
                 lap_duration=90 + driver, duration_sector_1=30 + driver,
                 duration_sector_2=None if lap == 2 else 30, duration_sector_3=30,
                 is_pit_out_lap=lap == 3)
            for lap in range(1, 54)] for driver in DRIVERS}
    else:
        payload = fetch()
    rows = normalize(payload)
    print(f'Validated {len(rows)} laps', file=sys.stderr)
    print(import_sql(rows, 'fixture' if args.fixture else 'OpenF1',
                     datetime.now(timezone.utc).isoformat()))
