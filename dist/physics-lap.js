import {lapDynamics} from './lap-dynamics.mjs';
import {normalizedPath,layoutIds} from './track-math.js';
import {simulateLap,sampleLap} from './lap-model.mjs';

const $=id=>document.getElementById(id);
const tab=$('physics-lap'), circuit=$('lap-circuit'), status=$('lap-status');
const map=$('lap-map'), chart=$('lap-trace'), play=$('lap-play');
const svgNS='http://www.w3.org/2000/svg';
const metrics=[
  ['Speed','km/h',p=>p.speed*3.6,0], ['Along the car','g',p=>p.acceleration/9.80665,2],
  ['Across the car','g',p=>p.lateral/9.80665,2], ['Drag','kN',p=>p.drag/1000,2],
  ['Downforce','kN',p=>p.downforce/1000,2], ['Power against drag','kW',p=>p.power/1000,0]
].map(([label,unit,get,decimals])=>{
  const metric=document.createElement('div'), name=document.createElement('dt'), value=document.createElement('dd');
  name.textContent=label;
  metric.append(name,value);
  $('lap-metrics').append(metric);
  return {unit,get,decimals,value};
});

let layouts=[], lap, pending, playing=false, follow=false, time=0, lastFrame, frameId, lastReadout=-Infinity;
const descriptions={
  Braking:'The car sheds speed before a tighter bend. The longitudinal acceleration points backward.',
  Cornering:'The car changes direction. Lateral acceleration points toward the inside of the bend, and rises with the square of speed at fixed curvature.',
  Accelerating:'The car gains speed as the track opens up. The longitudinal arrow points forward while aerodynamic drag rises.',
  'Steady running':'With little change in speed or direction, the acceleration arrows shrink. Drag and downforce can still be substantial.'
};

async function initialize() {
  if (layouts.length || pending) return pending;
  status.hidden=false;
  status.textContent='Loading circuit layouts…';
  pending=(async()=>{
    try {
      const response=await fetch(new URL('./data/circuit-layouts.geojson',import.meta.url));
      if (!response.ok) throw Error('Circuit layouts could not load');
      const data=await response.json();
      layouts=data.features.filter(f=>Object.values(layoutIds).includes(f.properties.id)
        && Number(f.properties.length)>0).sort((a,b)=>a.properties.Name.localeCompare(b.properties.Name));
      if (!layouts.length) throw Error('No circuit layouts were available');
      circuit.replaceChildren(...layouts.map(f=>new Option(f.properties.Name,f.properties.id)));
      circuit.value=layouts.some(f=>f.properties.id===layoutIds.monza)?layoutIds.monza:layouts[0].properties.id;
      selectLap();
      status.hidden=true;
      $('lap-content').hidden=false;
    } catch {
      layouts=[];
      status.textContent='Circuit layouts could not load. Open Engineering Physics again to retry.';
    } finally {pending=null;}
  })();
  return pending;
}

function selectLap() {
  const feature=layouts.find(f=>f.properties.id===circuit.value);
  if (!feature) return;
  const path=normalizedPath(feature), length=Number(feature.properties.length);
  lap=simulateLap(path,length);
  $('lap-meta').textContent=`${(length/1000).toFixed(3)} km · ${lap.duration.toFixed(1)} s simulated lap`;
  const points=lap.segments;
  $('lap-road').setAttribute('d','M'+points.map(p=>p.x.toFixed(2)+','+p.z.toFixed(2)).join(' L')+' Z');
  chart.replaceChildren(...points.map((p,i)=>{
    const b=points[(i+1)%points.length], line=document.createElementNS(svgNS,'line');
    const hue=24+145*Math.min(1,((p.speed+b.speed)/2)/88);
    line.setAttribute('stroke',`hsl(${hue} 78% 58%)`);
    for (const [attr,value] of Object.entries({x1:p.x,y1:p.z,x2:b.x,y2:b.z,'stroke-width':1.8,'stroke-linecap':'round'})) line.setAttribute(attr,value);
    return line;
  }));
  time=0;
  draw(true);
}
function draw(readout) {
  const p=sampleLap(lap,time);
  $('lap-car-marker').setAttribute('transform',`translate(${p.x} ${p.z}) rotate(${p.angle*180/Math.PI}) scale(${follow?.9:.48})`);
  if(follow) map.setAttribute('viewBox',`${p.x-31} ${p.z-31} 62 62`);
  if(!readout) return;
  const dynamics=lapDynamics(p);
  updateFreeBody(p,dynamics);
  updateDynamics(dynamics);
  const phase=p.acceleration < -1?'Braking':Math.abs(p.lateral)>4?'Cornering':p.acceleration>1?'Accelerating':'Steady running';
  $('lap-phase').textContent=phase;
  $('lap-explanation').textContent=descriptions[phase];
  $('lap-clock').textContent=`${time.toFixed(1)} s · ${Math.round(p.distance).toLocaleString()} m`;
  $('lap-scrub').value=Math.round(time/lap.duration*1000);
  for(const m of metrics) m.value.textContent=m.get(p).toFixed(m.decimals)+' '+m.unit;
  for(const [id,axis,value] of [['lap-long-vector','x2',p.acceleration*1.35],['lap-lat-vector','y2',p.lateral*.62]]) {
    const arrow=$(id);
    arrow.setAttribute(axis,value);
    arrow.setAttribute('visibility',Math.abs(value)<.7?'hidden':'visible');
  }
}
function updateFreeBody({drag,downforce},{weight,normal,tyre}) {
  const length=(force,cap)=>Math.min(cap,12+Math.abs(force)/430);
  const arrows=[
    ['normal','y2',170-length(normal,108),normal],
    ['weight','y2',130+length(weight,49),weight],
    ['down','y2',55+length(downforce,61),downforce],
    ['drag','x2',102-length(drag,75),drag],
    ['tyre','x2',164+Math.sign(tyre)*length(tyre,105),tyre]
  ];
  for(const [name,axis,end,force] of arrows) {
    const line=$('fbd-'+name);
    line.setAttribute(axis,end);
    line.setAttribute('visibility',Math.abs(force)<30?'hidden':'visible');
    $('fbd-'+name+'-value').textContent=(force/1000).toFixed(2)+' kN';
  }
  $('fbd-normal-label').setAttribute('y',Math.max(19,170-length(normal,108)+4));
  $('fbd-weight-label').setAttribute('y',130+length(weight,49)+7);
  $('fbd-drag-label').setAttribute('x',102-length(drag,75));
  $('fbd-tyre-label').setAttribute('x',Math.min(265,164+Math.sign(tyre)*length(tyre,105)));
}
function updateDynamics(d) {
  const values={
    grip:(d.usage*100).toFixed(0)+'% of illustrative grip',
    front:(d.front/1000).toFixed(2)+' kN',rear:(d.rear/1000).toFixed(2)+' kN',
    forward:(d.forwardTransfer/1000).toFixed(2)+' kN',outside:(d.outsideTransfer/1000).toFixed(2)+' kN',
    radius:Number.isFinite(d.radius)?d.radius.toFixed(0)+' m':'Straight',
    yaw:d.yawRate.toFixed(3)+' rad/s',lateral:(d.lateralForce/1000).toFixed(2)+' kN',
    energy:(d.kineticEnergy/1000).toFixed(0)+' kJ',brake:(d.brakingPower/1000).toFixed(0)+' kW',
    drag:(d.dragPower/1000).toFixed(0)+' kW',net:(d.kineticPower/1000).toFixed(0)+' kW'
  };
  for (const [id,value] of Object.entries(values)) $('dyn-'+id).textContent=value;
  const plotScale=66/Math.max(1,d.usage/1.2)/d.grip;
  const x=135+d.tyre*plotScale,y=104-d.lateralForce*plotScale;
  $('grip-vector').setAttribute('x2',x);
  $('grip-vector').setAttribute('y2',y);
  $('grip-point').setAttribute('cx',x);
  $('grip-point').setAttribute('cy',y);
}
function tick(now) {
  if (!playing || tab.hidden || document.hidden) {
    frameId=undefined;
    lastFrame=undefined;
    return;
  }
  const delta=lastFrame===undefined?0:Math.min((now-lastFrame)/1000,.1);
  lastFrame=now;
  time=(time+delta*Number($('lap-rate').value))%lap.duration;
  const readout=now-lastReadout>=80;
  if(readout) lastReadout=now;
  draw(readout);
  frameId=requestAnimationFrame(tick);
}
function setPlaying(value) {
  playing=value;
  play.textContent=value?'Pause':'Play';
  if (value && frameId===undefined) frameId=requestAnimationFrame(tick);
  if (!value && frameId!==undefined) {
    cancelAnimationFrame(frameId);
    frameId=undefined;
    lastFrame=undefined;
  }
}
play.onclick=()=>setPlaying(!playing);
$('lap-restart').onclick=()=>{time=0;draw(true);};
$('lap-scrub').oninput=event=>{setPlaying(false);time=lap.duration*Math.min(.999999,Number(event.target.value)/1000);draw(true);};
$('lap-camera').onclick=()=>{
  follow=!follow;
  $('lap-camera').textContent=follow?'Whole circuit':'Follow car';
  $('lap-camera').setAttribute('aria-pressed',String(follow));
  if (!follow) map.setAttribute('viewBox','-110 -110 220 220');
  draw(true);
};
circuit.onchange=selectLap;
document.addEventListener('visibilitychange',()=>{if(document.hidden) setPlaying(false);});
for(const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click',()=>button.dataset.tab==='physics-lap'?initialize():setPlaying(false));
}
