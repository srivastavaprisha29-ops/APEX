import json
import numpy as np
import pytest
import torch
from core import GestureModel, load_data, LABELS
@pytest.mark.parametrize('arch',['mlp','lstm','transformer'])
def test_forward_and_gradient(arch):
    m=GestureModel(arch,32,.1); x=torch.randn(2,32,126)
    out=m(x);assert out.shape==(2,4);out.sum().backward()
    assert m.head.weight.grad is not None

def test_participant_isolation(tmp_path):
    records=[dict(participant=f'p{i}',session='s1',label=l,frames=np.zeros((32,126)).tolist()) for i in range(8) for l in LABELS]
    p=tmp_path/'data.json';p.write_text(json.dumps(dict(schema_version=1,records=records)))
    x,y,g,splits=load_data([p]);sets=[set(g[s]) for s in splits]
    assert not sets[0]&sets[1] and not sets[0]&sets[2] and not sets[1]&sets[2]

def test_api_rejects_untrained():
    import serve
    from fastapi.testclient import TestClient
    old=serve.model;serve.model=None
    try:assert TestClient(serve.app).post('/predict',json={'frames':[[0.0]*126]*32}).status_code==503
    finally:serve.model=old

def test_training_checkpoint_and_serving(tmp_path):
    from train import fit
    import serve
    from fastapi.testclient import TestClient
    rng=np.random.default_rng(42)
    x=rng.normal(size=(32,32,126)).astype('float32');y=np.tile(np.arange(4),8)
    splits=[np.arange(16),np.arange(16,24),np.arange(24,32)]
    cfg=dict(architecture='mlp',hidden=32,dropout=.1,lr=.001,weight_decay=.0001,batch_size=8)
    state,score,history=fit(x,y,splits,cfg,epochs=1)
    p=tmp_path/'model.pt';torch.save({'state_dict':state,'config':cfg,'split_manifest':{'train':['a']}},p)
    ck=torch.load(p,weights_only=True);m=GestureModel('mlp',32,.1);m.load_state_dict(ck['state_dict']);m.eval()
    old=serve.model;serve.model=m
    try:
        client=TestClient(serve.app)
        response=client.post('/predict',json={'frames':x[0].tolist()})
        assert response.status_code==200
        assert response.json()['label'] in LABELS
        assert abs(sum(response.json()['probabilities'].values())-1)<1e-5
        assert client.post('/predict',json={'frames':[[0.0]]}).status_code==422
    finally:serve.model=old
