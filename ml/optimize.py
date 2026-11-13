"""Benchmark FP32 vs dynamic INT8 on validation only; test remains reserved."""
import argparse, copy, json, time, io
import numpy as np
import torch
from sklearn.metrics import f1_score
from core import GestureModel, load_data

def benchmark(model, sample):
    model.eval()
    with torch.inference_mode():
        for _ in range(15): model(sample)
        times=[]
        for _ in range(100):
            t=time.perf_counter();model(sample);times.append((time.perf_counter()-t)*1000)
    stream=io.BytesIO();torch.save(model.state_dict(),stream)
    return {'latency_ms_p50':float(np.percentile(times,50)),'latency_ms_p95':float(np.percentile(times,95)),'state_dict_bytes':stream.tell()}

def main():
    p=argparse.ArgumentParser();p.add_argument('--checkpoint',default='artifacts/model.pt');p.add_argument('--data',nargs='+',required=True);p.add_argument('--out',default='artifacts/optimization.json');a=p.parse_args()
    torch.set_num_threads(1)
    ck=torch.load(a.checkpoint,map_location='cpu',weights_only=True)
    if ck['config']['architecture']=='transformer':raise SystemExit('This INT8 path supports MLP/LSTM; Transformer quantization needs a separately validated export path.')
    model=GestureModel(**{k:ck['config'][k] for k in ['architecture','hidden','dropout']});model.load_state_dict(ck['state_dict']);model.eval()
    x,y,g,splits=load_data(a.data)
    manifest={name:sorted(map(str,set(g[idx]))) for name,idx in zip(['train','validation','test'],splits)}
    if manifest!=ck['split_manifest']:raise ValueError('Participant splits changed')
    xv=torch.from_numpy(x[splits[1]])
    # PyTorch eager dynamic quantization; benchmark on target CPU before choosing it.
    quant=torch.ao.quantization.quantize_dynamic(copy.deepcopy(model),{torch.nn.Linear,torch.nn.LSTM},dtype=torch.qint8)
    report={}
    for name,m in [('fp32',model),('int8',quant)]:
        with torch.inference_mode():pred=m(xv).argmax(1).numpy()
        report[name]={**benchmark(m,xv[:1]),'validation_macro_f1':float(f1_score(y[splits[1]],pred,labels=[0,1,2,3],average='macro',zero_division=0))}
    report['note']='Batch 1, CPU, 1 thread. Model-only latency. Select on validation; evaluate chosen model on held-out test separately.'
    from pathlib import Path
    Path(a.out).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':main()
