const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class Manipulator {
 constructor(){this.reset()}
 reset(){this.previous=null;this.pinches=new Map()}
 update(hands,sides=[]){
  if(!hands.length){this.reset();return {mode:'idle'}}
  const observations=hands.map((h,i)=>{const size=Math.max(dist(h[0],h[9]),.025),ratio=dist(h[4],h[8])/size,key=sides[i]||String(i);const pinch=ratio<(this.pinches.get(key)?.48:.30);this.pinches.set(key,pinch);return {h,pinch,size,center:{x:(h[4].x+h[8].x)/2,y:(h[4].y+h[8].y)/2},angle:Math.atan2(h[5].y-h[17].y,h[5].x-h[17].x)}});
  const [a,b]=observations;
  let mode=b?(a.pinch&&b.pinch?'explode':!a.pinch&&!b.pinch?'scale':'idle'):a.pinch?'grab':'rotate';
  const current={mode,key:sides.join(','),x:a.center.x,y:a.center.y,angle:a.angle,size:a.size,spread:b?dist(a.h[0],b.h[0]):0};
  const p=this.previous;this.previous=current;
  if(!p||p.mode!==mode||p.key!==current.key)return {mode};
  const dx=clamp(current.x-p.x,-.08,.08),dy=clamp(current.y-p.y,-.08,.08);
  if(mode==='grab')return {mode,dx:-dx,dy:-dy};
  if(mode==='rotate'){let angle=current.angle-p.angle;angle=Math.atan2(Math.sin(angle),Math.cos(angle));return {mode,yaw:-dx*3,pitch:dy*2,roll:clamp(-angle,-.15,.15)}}
  if(mode==='scale')return {mode,scaleRatio:clamp(current.spread/Math.max(p.spread,.08),.92,1.08)};
  if(mode==='explode')return {mode,explodeDelta:clamp((current.spread-p.spread)*2.5,-.1,.1)};
  return {mode};
 }
}
