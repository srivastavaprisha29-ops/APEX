import argparse, json, time, copy
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import TensorDataset, DataLoader
from sklearn.metrics import f1_score, classification_report, confusion_matrix
from core import GestureModel, LABELS, load_data, seed_all

def fit(x, y, splits, config, epochs=40, trial=None):
    seed_all(42)
    train, val, _ = splits
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = GestureModel(config['architecture'], config['hidden'], config['dropout']).to(device)
    ds = TensorDataset(torch.from_numpy(x[train]), torch.from_numpy(y[train]))
    loader = DataLoader(ds, batch_size=config['batch_size'], shuffle=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config['lr'], weight_decay=config['weight_decay'])
    counts = np.bincount(y[train], minlength=4)
    criterion = torch.nn.CrossEntropyLoss(weight=torch.tensor(len(train)/(4*counts), dtype=torch.float32, device=device))
    xv = torch.from_numpy(x[val]).to(device)
    best, stale, state, history = -1, 0, None, []
    for epoch in range(epochs):
        model.train(); losses=[]
        for xb, yb in loader:
            optimizer.zero_grad(); loss=criterion(model(xb.to(device)), yb.to(device)); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); optimizer.step(); losses.append(loss.item())
        model.eval()
        with torch.inference_mode(): pred=model(xv).argmax(1).cpu().numpy()
        score=f1_score(y[val], pred, labels=list(range(4)), average='macro', zero_division=0)
        history.append({'epoch':epoch+1,'train_loss':float(np.mean(losses)),'validation_macro_f1':float(score)})
        if score>best: best,stale,state=score,0,copy.deepcopy(model.cpu().state_dict()); model.to(device)
        else: stale+=1
        if trial:
            import optuna
            trial.report(score,epoch)
            if trial.should_prune(): raise optuna.TrialPruned()
        if stale>=8: break
    return state, float(best), history

def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['train','tune','evaluate']);p.add_argument('--data',nargs='+',required=True);p.add_argument('--out',default='artifacts');p.add_argument('--architecture',choices=['mlp','lstm','transformer'],default='lstm');p.add_argument('--epochs',type=int,default=40);p.add_argument('--trials',type=int,default=20);p.add_argument('--checkpoint',default='artifacts/model.pt');a=p.parse_args()
    x,y,groups,splits=load_data(a.data);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
    config=dict(architecture=a.architecture,hidden=64,dropout=.2,lr=1e-3,weight_decay=1e-4,batch_size=32)
    split_manifest={name:sorted(map(str,set(groups[idx]))) for name,idx in zip(['train','validation','test'],splits)}
    if a.command=='evaluate':
        ck=torch.load(a.checkpoint,map_location='cpu',weights_only=True)
        if ck['split_manifest']!=split_manifest: raise ValueError('Dataset participants changed since training')
        model=GestureModel(**{k:ck['config'][k] for k in ['architecture','hidden','dropout']});model.load_state_dict(ck['state_dict']);model.eval()
        xt=torch.from_numpy(x[splits[2]])
        with torch.inference_mode():
            pred=model(xt).argmax(1).numpy()
            sample=xt[:1]
            for _ in range(20): model(sample)
            times=[]
            for _ in range(100):
                t=time.perf_counter();model(sample);times.append((time.perf_counter()-t)*1000)
        report={'test_report':classification_report(y[splits[2]],pred,labels=list(range(4)),target_names=LABELS,output_dict=True,zero_division=0),'confusion_matrix':confusion_matrix(y[splits[2]],pred,labels=list(range(4))).tolist(),'cpu_latency_ms_p50':float(np.percentile(times,50)),'cpu_latency_ms_p95':float(np.percentile(times,95)),'checkpoint_bytes':Path(a.checkpoint).stat().st_size,'note':'Model-only CPU latency; excludes hand tracking, network and rendering.'}
        (out/'test_metrics.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));return
    if a.command=='tune':
        import optuna
        def objective(trial):
            cfg=dict(architecture=trial.suggest_categorical('architecture',['mlp','lstm','transformer']),hidden=trial.suggest_categorical('hidden',[32,64,128]),dropout=trial.suggest_float('dropout',.1,.5),lr=trial.suggest_float('lr',1e-4,3e-3,log=True),weight_decay=trial.suggest_float('weight_decay',1e-6,1e-2,log=True),batch_size=trial.suggest_categorical('batch_size',[16,32,64]))
            return fit(x,y,splits,cfg,a.epochs,trial)[1]
        study=optuna.create_study(direction='maximize',sampler=optuna.samplers.TPESampler(seed=42),pruner=optuna.pruners.MedianPruner(n_startup_trials=5,n_warmup_steps=5))
        study.optimize(objective,n_trials=a.trials);config=study.best_params;study.trials_dataframe().to_csv(out/'trials.csv',index=False)
    state,score,history=fit(x,y,splits,config,a.epochs)
    torch.save({'state_dict':state,'config':config,'labels':LABELS,'split_manifest':split_manifest,'schema_version':1},out/'model.pt')
    (out/'validation.json').write_text(json.dumps({'config':config,'validation_macro_f1':score,'split_manifest':split_manifest,'history':history},indent=2))
    print(f'Saved {out}/model.pt. Validation macro-F1={score:.4f}. Test set not evaluated.')
if __name__=='__main__':main()
