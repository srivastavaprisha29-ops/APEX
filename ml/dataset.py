"""Validate private capture exports and freeze a reproducible dataset manifest."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

LABELS = ('idle', 'rotate', 'zoom', 'select')
IDENTIFIER = re.compile(r'[A-Za-z0-9_-]{1,64}')


def digest(value):
    encoded = json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


def validate_capture(record):
    times = record.get('frame_ms')
    if (not isinstance(times, list) or len(times) != 32 or times[0] != 0
            or any(type(t) is not int for t in times)
            or any(not 0 < b-a <= 250 for a, b in zip(times, times[1:]))):
        raise ValueError('Expected 32 monotonic frame times with gaps of at most 250 ms')
    masks = record.get('hand_masks')
    if (not isinstance(masks, list) or len(masks) != 32
            or any(not isinstance(mask, list) or len(mask) != 2
                   or any(type(flag) is not bool for flag in mask) for mask in masks)):
        raise ValueError('Expected a two-hand presence mask per frame')
    for frame, mask in zip(record['frames'], masks):
        if any(not present and any(frame[i*63:(i+1)*63]) for i, present in enumerate(mask)):
            raise ValueError('Absent hand must have zeroed landmark features')
    capture = record.get('capture', {})
    if (capture.get('version') != 2 or capture.get('device') not in ('desktop', 'phone')
            or capture.get('lighting') not in ('even', 'dim', 'backlit')
            or any(type(capture.get(key)) is not int or capture[key] <= 0
                   for key in ('width', 'height'))):
        raise ValueError('Invalid device or lighting metadata')
    if record['label'] != 'idle' and not any(any(mask) for mask in masks):
        raise ValueError('Command sample has no detected hands')


def read_records(paths, excluded=()):
    samples = []
    seen = set()
    for path in paths:
        payload = json.loads(Path(path).read_text())
        version = payload.get('schema_version')
        if version not in (1, 2):
            raise ValueError(f'{path}: expected capture schema 1 or 2')
        for record in payload['records']:
            if record.get('participant') in excluded:
                continue
            if record.get('label') not in LABELS or any(
                not IDENTIFIER.fullmatch(str(record.get(key, '')))
                or not isinstance(record.get(key), str) for key in ('participant', 'session')
            ):
                raise ValueError(f'{path}: invalid label or pseudonymous identifier')
            frames = record['frames']
            if len(frames) != 32 or any(
                len(frame) != 126 or any(type(v) not in (int, float) or not math.isfinite(v)
                                         for v in frame) for frame in frames
            ):
                raise ValueError(f'{path}: expected finite [32,126] landmarks')
            if version == 2:
                validate_capture(record)
            # Empty idle windows can legitimately be identical across participants.
            features = digest([[float(value) for value in frame] for frame in frames])
            if any(any(frame) for frame in frames):
                if features in seen:
                    raise ValueError(f'{path}: duplicate landmark sequence')
                seen.add(features)
            samples.append({**record, 'capture_schema': version})
    if not samples:
        raise ValueError('No eligible recordings')
    return sorted(samples, key=digest)


def manifest(records, splits):
    return {
        'manifest_version': 1,
        'dataset_sha256': digest(records),
        'splits': {
            name: [digest(records[i]) for i in indices]
            for name, indices in zip(('train', 'validation', 'test'), splits)
        }
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+')
    parser.add_argument('--exclude', action='append', default=[])
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    records = read_records(args.files, args.exclude)
    from core import split_records
    _, _, _, splits = split_records(records)
    result = manifest(records, splits)
    with args.out.open('x') as output:
        json.dump(result, output, indent=2)
    print(f'Validated {len(records)} recordings. Dataset SHA-256 {result["dataset_sha256"]}')


if __name__ == '__main__':
    main()
