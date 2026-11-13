"""Sequence models and participant-isolated data loading. Browser features are already normalized."""
import json, random
from pathlib import Path
import numpy as np
import torch
from torch import nn
from sklearn.model_selection import GroupShuffleSplit
LABELS = ['idle', 'rotate', 'zoom', 'select']
class GestureModel(nn.Module):
    def __init__(self, architecture='lstm', hidden=64, dropout=.2):
        super().__init__()
        self.architecture = architecture
        if architecture == 'mlp':
            self.encoder = nn.Sequential(nn.Linear(126, hidden), nn.ReLU(), nn.Dropout(dropout))
        elif architecture == 'lstm':
            self.encoder = nn.LSTM(126, hidden, num_layers=2, dropout=dropout, batch_first=True)
        elif architecture == 'transformer':
            self.project = nn.Linear(126, hidden)
            self.position = nn.Parameter(torch.randn(1, 32, hidden) * .02)
            self.encoder = nn.TransformerEncoder(nn.TransformerEncoderLayer(hidden, 4, hidden*4, dropout, batch_first=True), 2)
        else: raise ValueError('Unknown architecture')
        self.head = nn.Linear(hidden, len(LABELS))
    def forward(self, x):
        if self.architecture == 'lstm': x = self.encoder(x)[0][:, -1]
        elif self.architecture == 'transformer': x = self.encoder(self.project(x) + self.position).mean(1)
        else: x = self.encoder(x.mean(1))
        return self.head(x)
def seed_all(seed):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
def load_data(paths, seed=42, *, excluded=(), include_records=False):
    from dataset import read_records
    records = read_records(paths, excluded)
    data = split_records(records, seed)
    return (*data, records) if include_records else data


def model_frames(record):
    frames = record['frames']
    if record['capture_schema'] == 1:
        return frames
    times = np.asarray(record['frame_ms'])
    grid = np.linspace(0, times[-1], len(frames))
    right = np.searchsorted(times, grid)
    left = np.maximum(right - 1, 0)
    nearest = np.where(grid - times[left] <= times[right] - grid, left, right)
    return np.asarray(frames)[nearest]


def split_records(records, seed=42):
    x = np.asarray([model_frames(r) for r in records], dtype=np.float32)
    if x.shape[1:] != (32, 126) or not np.isfinite(x).all(): raise ValueError('Expected finite [N,32,126] normalized landmarks')
    y = np.array([LABELS.index(r['label']) for r in records])
    groups = np.array([r['participant'] for r in records])
    if len(set(groups)) < 5: raise ValueError('Collect at least 5 participants (8+ recommended), each with every class')
    trainval, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=seed).split(x, y, groups))
    a, b = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=seed).split(x[trainval], y[trainval], groups[trainval]))
    splits = [trainval[a], trainval[b], test]
    for name, idx in zip(['train', 'validation', 'test'], splits):
        if set(y[idx]) != set(range(4)): raise ValueError(f'{name} lacks classes; collect every gesture for every participant')
    return x, y, groups, splits
