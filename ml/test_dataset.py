import copy
import json

import pytest

from dataset import manifest, read_records
from core import model_frames, split_records


def recording(participant, label, value):
    return dict(participant=participant, session='session-1', label=label,
                frames=[[value] * 63 + [0] * 63 for _ in range(32)],
                frame_ms=[i * 67 for i in range(32)],
                hand_masks=[[True, False] for _ in range(32)],
                capture=dict(version=2, width=640, height=360, device='desktop', lighting='even'))


def save(path, records):
    path.write_text(json.dumps(dict(schema_version=2, records=records)))
    return path


def test_manifest_detects_content_changes_and_exclusions(tmp_path):
    records = [recording(f'p{i}', label, 1 + 4*i+j)
               for i in range(8) for j, label in enumerate(('idle', 'rotate', 'zoom', 'select'))]
    a = read_records([save(tmp_path / 'first.json', records)])
    b = read_records([save(tmp_path / 'second.json', list(reversed(records)))])
    freeze = lambda data: manifest(data, split_records(data)[3])
    assert freeze(a) == freeze(b)
    assert model_frames(a[0]).tolist() == a[0]['frames']
    records[0]['frames'][0][0] += .25
    path = save(tmp_path / 'changed.json', records)
    assert freeze(read_records([path])) != freeze(a)
    assert all(r['participant'] != 'p0' for r in read_records([path], excluded=['p0']))


def test_rejects_duplicates_and_timestamp_regressions(tmp_path):
    one = recording('p1', 'rotate', 1)
    two = copy.deepcopy(one)
    two['participant'] = 'p2'
    with pytest.raises(ValueError, match='duplicate'):
        read_records([save(tmp_path / 'duplicate.json', [one, two])])
    one['frame_ms'][3] = one['frame_ms'][2]
    with pytest.raises(ValueError, match='monotonic'):
        read_records([save(tmp_path / 'invalid.json', [one])])
