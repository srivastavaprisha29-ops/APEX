import os
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core import GestureModel, LABELS
app=FastAPI(title='APEX Gesture Inference')
# Override for the exact hosted origin when exposing the service over HTTPS.
origins=os.environ.get('ALLOWED_ORIGINS','http://localhost:8080,http://127.0.0.1:8080').split(',')
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['GET','POST'],allow_headers=['Content-Type'])
model=None; config={}
path=os.environ.get('MODEL_PATH','artifacts/model.pt')
if os.path.isfile(path):
    ck=torch.load(path,map_location='cpu',weights_only=True);config=ck['config']
    model=GestureModel(**{k:config[k] for k in ['architecture','hidden','dropout']});model.load_state_dict(ck['state_dict']);model.eval()
class Sequence(BaseModel):
    frames:list[list[float]]
@app.get('/health')
def health():return {'model_loaded':model is not None,'architecture':config.get('architecture')}
@app.post('/predict')
def predict(body:Sequence):
    if model is None:raise HTTPException(503,'Train a model first; no checkpoint is loaded')
    try:x=np.asarray(body.frames,dtype=np.float32)
    except ValueError:raise HTTPException(422,'Expected rectangular frames')
    if x.shape!=(32,126) or not np.isfinite(x).all():raise HTTPException(422,'Expected finite [32,126] normalized features')
    with torch.inference_mode():probs=model(torch.from_numpy(x).unsqueeze(0)).softmax(-1)[0].numpy()
    i=int(probs.argmax());return {'label':LABELS[i],'confidence':float(probs[i]),'probabilities':dict(zip(LABELS,map(float,probs)))}
