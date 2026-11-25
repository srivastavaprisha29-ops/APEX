import {bestLap,raceCars,formatLap} from './track-math.js';

const byId = id => document.getElementById(id);
const svg = (tag, attrs) => {
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
  return el;
};
const median = values => {
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};
const seconds = ms => Number.isFinite(ms) ? (ms/1000).toFixed(3)+' s' : 'Unavailable';
let laps, pending;

function render() {
  const rows=laps.filter(row=>row.driver_number===Number(byId('race-eng-driver').value));
  const clean=rows.filter(row=>row.quality==='complete');
  const times=clean.map(row=>row.total);
  const pace=median(times), best=Math.min(...times);
  const deviation=Math.sqrt(times.reduce((sum,t)=>sum+(t-pace)**2,0)/times.length);
  byId('race-eng-pace').textContent=formatLap(pace/1000);
  byId('race-eng-best').textContent=formatLap(best/1000);
  byId('race-eng-consistency').textContent=seconds(deviation);
  byId('race-eng-count').textContent=clean.length+' / '+rows.length;
  const selected=byId('race-eng-lap').value;
  byId('race-eng-lap').replaceChildren(...rows.map(row=>new Option('Lap '+row.lap,row.lap)));
  byId('race-eng-lap').value=rows.some(row=>String(row.lap)===selected)?selected:String(clean.find(row=>row.total===best).lap);
  drawChart();
  byId('race-eng-lap').onchange=()=>selectLap(rows,clean);
  selectLap(rows,clean);
}

function drawChart() {
  const graph=byId('race-eng-plot'), gap=byId('race-eng-view').value==='gap';
  graph.setAttribute('aria-label',gap?'Lap-time gap in seconds, Car 01 minus Car 04':'Lap times in seconds for both cars');
  graph.replaceChildren();
  const first=laps.filter(row=>row.driver_number===1);
  const second=new Map(laps.filter(row=>row.driver_number===4).map(row=>[row.lap,row]));
  const series=gap ? [{color:'#8ce5f2',rows:first.map(row=>{
    const other=second.get(row.lap);
    return {lap:row.lap,total:row.total-other.total,quality:row.quality==='complete'?other.quality:row.quality};
  })}] : [{color:'#8ce5f2',rows:first},{color:'#c8b2ff',rows:[...second.values()]}];
  const values=series.flatMap(line=>line.rows.map(row=>row.total));
  const low=Math.floor((Math.min(...values,gap?0:Infinity)-200)/1000)*1000;
  const high=Math.ceil((Math.max(...values,gap?0:-Infinity)+200)/1000)*1000;
  const x=lap=>58+(lap-1)/(first.length-1)*516;
  const y=time=>205-(time-low)/(high-low)*177;
  const label=(value,x,y)=>{
    const el=svg('text',{x,y,fill:'#c1d2db','font-size':14});
    el.textContent=value;
    graph.append(el);
  };
  for(let i=0;i<=4;i++){
    const time=low+(high-low)*i/4;
    graph.append(svg('line',{x1:58,x2:574,y1:y(time),y2:y(time),stroke:'#3d5360'}));
    label((time/1000).toFixed(1),5,y(time)+4);
  }
  for(const number of [1,10,20,30,40,first.length]) label(number,x(number)-6,225);
  if(gap) graph.append(svg('line',{x1:58,x2:574,y1:y(0),y2:y(0),stroke:'#e9bc77','stroke-dasharray':'4 4'}));
  for(const {rows,color} of series){
    graph.append(svg('polyline',{points:rows.map(r=>[x(r.lap),y(r.total)].join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2}));
    for(const row of rows) {
      const dot=svg('circle',{cx:x(row.lap),cy:y(row.total),r:4,fill:row.quality==='complete'?color:'#f0bb83','data-lap':row.lap});
      const tip=svg('title',{});
      tip.textContent='Lap '+row.lap+' · '+seconds(row.total);
      dot.append(tip);
      dot.addEventListener('click',()=>{
        byId('race-eng-lap').value=String(row.lap);
        byId('race-eng-lap').onchange();
      });
      graph.append(dot);
    }
  }
}
function selectLap(rows,clean) {
  const number=Number(byId('race-eng-lap').value);
  const lap=rows.find(row=>row.lap===number);
  const pair=laps.filter(row=>row.lap===number).sort((a,b)=>a.driver_number-b.driver_number);
  const gap=pair[0].total-pair[1].total;
  byId('race-eng-gap').textContent=gap===0?'Both cars recorded the same lap time.':
    (gap<0?'Car 01':'Car 04')+' quicker on this lap by '+seconds(Math.abs(gap))+
    (pair.some(row=>row.quality!=='complete')?' · Includes a flagged lap.':'');
  const fields=['s1','s2','s3'], minima=fields.map(key=>Math.min(...clean.map(row=>row[key])));
  byId('race-eng-ideal').textContent=formatLap(minima.reduce((sum,t)=>sum+t,0)/1000);
  byId('race-eng-quality').textContent=lap.quality.replace('_',' ');
  byId('race-eng-splits').replaceChildren(...fields.map((key,i)=>{
    const row=document.createElement('tr');
    const heading=document.createElement('th');
    heading.scope='row'; heading.textContent='Sector '+(i+1); row.append(heading);
    const delta=lap[key]===null?null:lap[key]-minima[i];
    for(const value of [seconds(lap[key]),seconds(minima[i]),seconds(delta)]) row.insertCell().textContent=value;
    return row;
  }));
  for(const dot of byId('race-eng-plot').querySelectorAll('[data-lap]')) {
    dot.setAttribute('stroke',Number(dot.dataset.lap)===number?'white':'none');
    dot.setAttribute('stroke-width','3');
  }
}

function showArchive(snapshot) {
  byId('race-eng-archive').replaceChildren(...raceCars.slice(0,5).map(car=>{
    const row=document.createElement('tr'), record=bestLap(snapshot,'monza',car);
    for(const value of [car.name,car.year,record?.driver??'Unavailable',formatLap(record?.seconds),
      record?.averageSpeed ? record.averageSpeed.toFixed(1)+' km/h' : 'Unavailable']) row.insertCell().textContent=value;
    return row;
  }));
}

async function loadFile(path) {
  const response=await fetch(new URL(path,import.meta.url));
  if(!response.ok) throw Error('Data unavailable');
  return response.json();
}

async function open() {
  if(laps||pending) return;
  byId('race-eng-status').textContent='Loading timing data…';
  pending=true;
  try {
    const [fixture,archive]=await Promise.allSettled([
      loadFile('./data/monza-sector-fixture.json'),loadFile('./data/racing-snapshot.json')
    ]);
    if(archive.status==='fulfilled') showArchive(archive.value);
    if(fixture.status!=='fulfilled') throw Error('Sample session unavailable');
    laps=fixture.value.laps;
    render();
    byId('race-eng-status').textContent=archive.status==='rejected'?'The recorded-results archive could not load.':'';
    byId('race-eng-desk').hidden=false;
  } catch {
    laps=null;
    byId('race-eng-status').textContent='Timing could not load. Open Race Engineering again to retry.';
  } finally {pending=false;}
}
document.querySelector('nav [data-tab="race-engineering"]').addEventListener('click',open);
byId('race-eng-driver').addEventListener('change',render);

byId('race-eng-view').addEventListener('change',render);
