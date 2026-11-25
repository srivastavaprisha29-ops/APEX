import {trackPhysicsZones,zoneDiagram} from './track-physics.mjs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {raceCars,layoutIds,bestLap,formatLap,compareLaps,normalizedPath,samplePath,apiRacesToSnapshot} from './track-math.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const refreshedAt = new Map();
let zones=[], drawerTrigger=null;
const zoneRay = new THREE.Raycaster();
const zonePointer = new THREE.Vector2();
zoneRay.params.Line.threshold = 2;
let snapshot,layouts,scene,camera,renderer,controls,road,path,markers=[],records=[null,null],loading,ready=false,playing=true,elapsed=0,lastFrame=0,lastLabel=0,version=0,refreshing=false,software=false;
const carFor=i=>raceCars.find(c=>c.id===$(i?'#track-car-b':'#track-car-a').value);
function selectedCircuit(){return snapshot.circuits.find(c=>c.circuitId===$('#track-select').value)}
function currentLayout(){return layouts.features.find(f=>f.properties.id===layoutIds[$('#track-select').value])}
async function initialize(){if(ready)return;if(loading)return loading;loading=(async()=>{try{[snapshot,layouts]=await Promise.all([fetch('data/racing-snapshot.json').then(r=>{if(!r.ok)throw Error('Circuit archive unavailable');return r.json()}),fetch('data/circuit-layouts.geojson').then(r=>{if(!r.ok)throw Error('Circuit geometry unavailable');return r.json()})]);for(const id of ['#track-car-a','#track-car-b'])for(const car of raceCars){const option=document.createElement('option');option.value=car.id;option.textContent=car.name+' / '+car.year;$(id).append(option)}$('#track-car-a').value='rb20';$('#track-car-b').value='mcl38';createScene();ready=true;fillCircuits();selectTrack();}catch(error){$('#track-coverage').textContent='Track mode could not start: '+error.message;loading=null}})();return loading}
function fillCircuits(){const old=$('#track-select').value,calendar=new Set(snapshot.calendar2026.map(r=>r.circuitId)),filter=$('#track-filter').value;let circuits=snapshot.circuits.filter(c=>filter==='all'||filter==='calendar'&&calendar.has(c.circuitId)||filter==='layouts'&&layoutIds[c.circuitId]);if(!circuits.length)circuits=snapshot.circuits;$('#track-select').replaceChildren();for(const circuit of circuits.sort((a,b)=>a.circuitName.localeCompare(b.circuitName))){const option=document.createElement('option');option.value=circuit.circuitId;option.textContent=circuit.circuitName+(layoutIds[circuit.circuitId]?'':' · metadata only');$('#track-select').append(option)}$('#track-select').value=circuits.some(c=>c.circuitId===old)?old:circuits.some(c=>c.circuitId==='monza')?'monza':circuits[0].circuitId;const coverage=snapshot.circuits.filter(c=>layoutIds[c.circuitId]&&layouts.features.some(f=>f.properties.id===layoutIds[c.circuitId])).length;const calendarCoverage=[...calendar].filter(id=>layoutIds[id]&&layouts.features.some(f=>f.properties.id===layoutIds[id])).length;$('#track-coverage').textContent=`${snapshot.circuits.length} historical circuit entries · ${coverage} reference layouts · ${calendarCoverage}/${calendar.size} circuits in the 2026 API calendar have a layout. Historical variants may differ.`}
const compactRenderer = matchMedia('(pointer: coarse), (max-width: 700px)').matches;

function createScene(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.1,1200);camera.position.set(0,160,180);try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,compactRenderer ? 1.5 : 2));renderer.setClearColor(0,0)}catch(e){renderer=new SVGRenderer();renderer.setQuality('low');software=true}$('#track-scene').append(renderer.domElement);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=12;controls.maxDistance=500;controls.maxPolarAngle=Math.PI*.49;scene.add(new THREE.HemisphereLight(0xeaf4ff,0x8799a5,2.5));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-80,120,100);scene.add(light);const grid=new THREE.GridHelper(500,25,0x243945,0x20323d);grid.position.y=-.1;grid.material.opacity=.1;grid.material.transparent=true;scene.add(grid);road=new THREE.Group();scene.add(road);markers=[makeMarker(0),makeMarker(1)];scene.add(...markers);const resize=()=>{const r=$('#track-scene').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe($('#track-scene'));resize();requestAnimationFrame(animate);bindTrackPhysicsPicking(renderer.domElement);loadMarkers()}
function makeMarker(i){const g=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:i?0xffb264:0x6eb8ff});const body=new THREE.Mesh(new THREE.BoxGeometry(1.3,.5,4.1),material);body.position.y=.5;g.add(body);for(const z of [-1.5,1.4]){const wing=new THREE.Mesh(new THREE.BoxGeometry(2.5,.12,.5),material);wing.position.set(0,.4,z);g.add(wing);for(const x of [-1,1]){const tyre=new THREE.Mesh(new THREE.BoxGeometry(.4,.65,.8),new THREE.MeshLambertMaterial({color:0x14232b}));tyre.position.set(x,.35,z);g.add(tyre)}}g.userData.paints=[material];return g}
async function loadMarkers(){try{const response=await fetch('models/car-preview.glb');if(!response.ok)return;const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());for(let i=0;i<2;i++){const root=gltf.scene.clone(true),scale=4.7/Math.max(size.x,size.y,size.z);const normalized=new THREE.Group();root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);normalized.add(root);normalized.rotation.y=Math.PI/2;const paints=[];root.traverse(o=>{if(o.isMesh){const isWheel=/wheel/.test(o.name);o.material=new THREE.MeshLambertMaterial({color:isWheel?0x343e4b:(i?0xffb264:0x6eb8ff),emissive:isWheel?0x111822:0x172531});o.material.side=THREE.DoubleSide;if(!isWheel)paints.push(o.material)}});markers[i].clear();markers[i].add(normalized);markers[i].userData.paints=paints}renderComparison()}catch(e){/* Original schematic markers remain usable if the licensed LOD fails. */}}
function clearRoad(){for(const obj of [...road.children]){road.remove(obj);obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose()}}
function buildRoad(feature){clearRoad();path=null;for(const marker of markers)marker.visible=!!feature;if(!feature)return;path=normalizedPath(feature);const points=path.points.map(([x,z])=>new THREE.Vector3(x,0,z)),vertices=[],indices=[],left=[],right=[];for(let i=0;i<points.length;i++){const before=points[i?i-1:points.length-2],after=points[i===points.length-1?1:i+1],tangent=after.clone().sub(before).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x);const l=points[i].clone().addScaledVector(normal,1.5),r=points[i].clone().addScaledVector(normal,-1.5);vertices.push(l.x,.02,l.z,r.x,.02,r.z);left.push(new THREE.Vector3(l.x,.06,l.z));right.push(new THREE.Vector3(r.x,.06,r.z));if(i<points.length-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();road.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x40515d,side:THREE.DoubleSide})));for(const edge of [left,right])road.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge),new THREE.LineBasicMaterial({color:0x91a5a9})));const start=new THREE.Mesh(new THREE.BoxGeometry(3.2,.1,.6),new THREE.MeshBasicMaterial({color:0xe9dfae}));const p=samplePath(path,0);start.position.set(p.x,.09,p.z);start.rotation.y=p.heading;road.add(start)}
function selectTrack(){version++;elapsed=0;$('#track-follow').checked=false;const c=selectedCircuit(),feature=currentLayout();$('#track-name').textContent=c.circuitName;$('#track-location').textContent=c.Location.locality+' / '+c.Location.country;$('#track-unavailable').hidden=!!feature;$('#track-unavailable').textContent='Circuit metadata is available, but no reference layout is bundled for this venue. Select an available 3D layout; no fictional circuit is substituted.';buildRoad(feature);buildPhysicsZones();$('#track-layout-meta').textContent=feature?`Reference layout: ${feature.properties.Name} · published length ${Number(feature.properties.length).toLocaleString()} m · version ID ${feature.properties.id}. Community mapping, not a surveyed racing line. The replay origin is not a verified start/finish line.`:'No layout geometry imported.';renderComparison();resetView();}
function renderComparison(){if(!snapshot)return;records=[0,1].map(i=>bestLap(snapshot,$('#track-select').value,carFor(i)));for(let i=0;i<2;i++){const c=carFor(i),record=records[i];markers[i]?.userData.paints?.forEach(m=>m.color.set(c.color));$(i?'#comparison-b':'#comparison-a').innerHTML=`<div class="eyebrow">${i?'B / COMPARISON':'A / SELECTED CAR'} · ${c.year}</div><h2 style="color:${c.color}">${esc(c.name)}</h2><div class="record-metrics"><div><strong>${record?formatLap(record.seconds):'—'}</strong><span>fastest recorded race lap</span></div><div><strong>${record?.averageSpeed?record.averageSpeed.toFixed(1):'—'} <small>km/h</small></strong><span>published lap-average speed</span></div></div><p>${record?esc(record.driver)+' · Lap '+esc(record.fastestLap.lap)+' · '+esc(record.race.raceName)+' · '+esc(record.date):'No race-lap record returned for this car-season / circuit.'}</p>`;$(i?'#track-tag-b':'#track-tag-a').innerHTML=`<b style="color:${c.color}">${i?'B':'A'} · ${esc(c.name)}</b><span>${record?esc(record.code||record.driver)+' · '+formatLap(record.seconds)+' · '+(record.averageSpeed?record.averageSpeed.toFixed(1)+' km/h lap avg':'average speed unavailable'):'No timing record · demo pace'}</span>`}
const [a,b]=records,comparison=compareLaps(a,b);$('#race-delta').textContent=comparison?((comparison.milliseconds/1000).toFixed(3)+' s'):'Unavailable';$('#speed-delta').textContent=a?.averageSpeed&&b?.averageSpeed?'Δ lap-average speed: '+Math.abs(a.averageSpeed-b.averageSpeed).toFixed(1)+' km/h':'Lap-average speed difference unavailable';$('#comparison-context').textContent=comparison
  ? (comparison.leader ? comparison.leader+' recorded the shorter lap. ' : 'The recorded lap times are equal. ')
    + (comparison.sameEvent ? 'Same race. Driver, tyres and lap conditions can differ.' : 'Different races. Conditions and circuit layouts can differ.')
  : 'Select two car-seasons with results at this circuit.';$('#track-source-link').href=`https://api.jolpi.ca/ergast/f1/${carFor(0).year}/circuits/${encodeURIComponent($('#track-select').value)}/results/`;$('#track-data-status').textContent=[0,1].map(i=>{
  const year=carFor(i).year, circuit=$('#track-select').value;
  const refreshDate=refreshedAt.get(year+':'+circuit);
  const source=refreshDate?'Jolpica refresh':'bundled Jolpica snapshot';
  const date=new Date(refreshDate||snapshot.fetchedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
  return (i?'B':'A')+' · '+source+' · '+date+' IST';
}).join(' | ');$('#track-replay-caption').textContent=!currentLayout()?'REFERENCE LAYOUT UNAVAILABLE · NO REPLAY':'UNIFORM-PACE ILLUSTRATION · '+(records.every(Boolean)?'RECORDED LAP DURATIONS':'90 s DEMO WHERE TIMING IS UNAVAILABLE')+' · NOT TELEMETRY'}
function resetView(top=false) {
  if (!camera) return;
  const rect = $('#track-scene').getBoundingClientRect();
  const aspect = rect.width && rect.height ? rect.width/rect.height : 1;
  const vertical = THREE.MathUtils.degToRad(camera.fov/2);
  const horizontal = Math.atan(Math.tan(vertical)*aspect);
  const radius = path ? Math.max(...path.points.map(([x,z])=>Math.hypot(x,z))) : 90;
  const distance = radius / Math.sin(Math.min(vertical,horizontal)) * 1.18;
  controls.maxDistance = Math.max(500,distance);
  camera.position.set(0,top?1:.66,top?.0001:.75).setLength(distance);
  controls.target.set(0,0,0);
  controls.update();
  $('#track-follow').checked=false;
}
function animate(now){requestAnimationFrame(animate);const delta=Math.min((now-(lastFrame||now))/1000,.1);lastFrame=now;if(document.hidden||!ready||$('#track').hidden)return;if(playing&&path)elapsed+=delta*Number($('#track-rate').value);if(path){markers.forEach((m,i)=>{const duration=records[i]?.seconds||90,p=samplePath(path,elapsed/duration);const lane=i?1.05:-1.05;m.position.set(p.x+Math.cos(p.heading)*lane,.2,p.z-Math.sin(p.heading)*lane);m.rotation.y=p.heading});if($('#track-follow').checked){const target=markers[0].position;const offset=camera.position.clone().sub(controls.target);controls.target.lerp(target,.08);camera.position.copy(controls.target).add(offset)}}controls.update();renderer.render(scene,camera);if(now-lastLabel>80){lastLabel=now;const rect=$('#track-scene').getBoundingClientRect();updatePhysicsMarkers(rect);markers.forEach((m,i)=>{const tag=$(i?'#track-tag-b':'#track-tag-a');tag.hidden=!path;const p=m.position.clone().add(new THREE.Vector3(0,3,0)).project(camera);tag.style.left=(p.x*.5+.5)*rect.width+'px';tag.style.top=(-p.y*.5+.5)*rect.height+'px';tag.style.opacity=p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1?'0':'1'});$('#track-clock').textContent=elapsed.toFixed(1)+' s';if(document.activeElement!==$('#track-scrub'))$('#track-scrub').value=(elapsed/(records[0]?.seconds||90)%1)*100}}
async function refresh(){if(refreshing||!ready)return;refreshing=true;$('#track-refresh').disabled=true;const requestVersion=version,id=$('#track-select').value;try{const years=[...new Set([carFor(0).year,carFor(1).year])];const replies=await Promise.all(years.map(async year=>{const response=await fetch(`https://api.jolpi.ca/ergast/f1/${year}/circuits/${encodeURIComponent(id)}/results/?limit=100`,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('API returned '+response.status);return {year,races:apiRacesToSnapshot((await response.json()).MRData.RaceTable.Races)}}));if(requestVersion!==version)return;for(const {year,races}of replies){if(!races.length)continue;snapshot.seasons[String(year)]=[...(snapshot.seasons[String(year)]||[]).filter(r=>r.circuitId!==id),...races];refreshedAt.set(year+':'+id,Date.now());}elapsed=0;renderComparison();if(replies.some(reply=>!reply.races.length))$('#track-data-status').textContent+=' | No new result for one or more seasons.'}catch(error){$('#track-data-status').textContent='API refresh failed. Showing previously loaded results. '+error.message}finally{refreshing=false;$('#track-refresh').disabled=false}}
for(const button of document.querySelectorAll('[data-tab="track"]'))button.addEventListener('click',async()=>{await initialize();if(ready&&button.id==='see-track'){const selected=raceCars.find(c=>c.id===$('#car-select').value);if(selected){$('#track-car-a').value=selected.id;if($('#track-car-b').value===selected.id)$('#track-car-b').value=selected.id==='mcl38'?'rb20':'mcl38';elapsed=0;version++;renderComparison()}}requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')))});
$('#track-filter').onchange=()=>{fillCircuits();selectTrack()};$('#track-select').onchange=selectTrack;for(const id of ['#track-car-a','#track-car-b'])$(id).onchange=()=>{version++;elapsed=0;renderComparison()};$('#track-refresh').onclick=refresh;$('#track-play').onclick=()=>{$('#track-play').textContent=(playing=!playing)?'Ⅱ Pause':'▶ Play'};$('#track-reset').onclick=()=>elapsed=0;$('#track-scrub').oninput=e=>elapsed=Number(e.target.value)/100*(records[0]?.seconds||90);$('#track-overview').onclick=()=>resetView();$('#track-top').onclick=()=>resetView(true);

function highlightZone(zone) {
  for (const item of zones) {
    item.line.material.opacity = item === zone ? 1 : .52;
    item.marker.classList.toggle('highlighted', item === zone);
    item.button.classList.toggle('highlighted', item === zone);
  }
}

function closePhysicsDrawer(restoreFocus = false) {
  $('#track-physics-drawer').hidden = true;
  if (restoreFocus && drawerTrigger && !drawerTrigger.hidden) drawerTrigger.focus();
  drawerTrigger = null;
  highlightZone(null);
}

function openPhysicsDrawer(zone, trigger) {
  drawerTrigger = trigger;
  highlightZone(zone);
  $('#track-physics-title').textContent = zone.title;
  $('#track-physics-description').textContent = zone.explanation;
  $('#track-physics-diagram').innerHTML = zoneDiagram(zone);
  $('#track-physics-equation').textContent = zone.equation;
  $('#track-physics-example').textContent = zone.example;
  $('#track-physics-drawer').hidden = false;
  $('#track-physics-title').focus();
}

function zoneButton(zone, onMap) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = onMap ? 'track-zone-pin' : 'track-zone-option';
  button.textContent = zone.title;
  button.style.setProperty('--zone-color',zone.color);
  button.addEventListener('pointerenter',() => highlightZone(zone));
  button.addEventListener('pointerleave',() => {
    if (!drawerTrigger && document.activeElement !== button) highlightZone(null);
  });
  button.addEventListener('focus',() => highlightZone(zone));
  button.addEventListener('blur',() => { if (!drawerTrigger) highlightZone(null); });
  button.addEventListener('click',() => openPhysicsDrawer(zone,button));
  return button;
}

function buildPhysicsZones() {
  closePhysicsDrawer();
  $('#track-zone-markers').replaceChildren();
  $('#track-zone-list').replaceChildren();
  $('#track-current-zone').textContent = '';
  $('#track-close').disabled = !path;
  $('#track-physics').hidden = !path;
  zones = path ? trackPhysicsZones(path) : [];
  for (const zone of zones) {
    const points = Array.from({length:17},(_,i) => {
      const point = samplePath(path,zone.fraction+(i-8)*.0025);
      return new THREE.Vector3(point.x,.16,point.z);
    });
    zone.anchor = points[8];
    zone.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color:zone.color,transparent:true,opacity:.52}));
    road.add(zone.line);
    zone.marker = zoneButton(zone,true);
    zone.button = zoneButton(zone,false);
    $('#track-zone-markers').append(zone.marker);
    $('#track-zone-list').append(zone.button);
  }
}

const projectedZone = new THREE.Vector3();
function updatePhysicsMarkers(rect) {
  for (const zone of zones) {
    const p = projectedZone.copy(zone.anchor).project(camera);
    zone.marker.hidden = p.z > 1 || p.z < -1 || Math.abs(p.x) > .94 || Math.abs(p.y) > .88;
    if (zone.marker.hidden) continue;
    zone.marker.style.left = (p.x*.5+.5)*rect.width+'px';
    zone.marker.style.top = (-p.y*.5+.5)*rect.height+'px';
  }
  const lap = elapsed/(records[0]?.seconds||90)%1;
  const nearby = zones.find(zone=>Math.abs(((zone.fraction-lap+1.5)%1)-.5)<.033);
  const message = nearby ? 'Car A is near: '+nearby.title : 'Car A is between the highlighted zones.';
  if ($('#track-current-zone').textContent !== message) $('#track-current-zone').textContent = message;
}

$('#track-close').onclick=()=>{
  if (!path) return;
  const target = markers[0].position;
  controls.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(9,10,12));
  controls.update();
  $('#track-follow').checked=true;
};
$('#track-physics-dismiss').onclick=()=>closePhysicsDrawer(true);
$('#track-physics-calculator').onclick=()=>{
  closePhysicsDrawer();
  window.dispatchEvent(new CustomEvent('apex-engineering',{detail:{topic:'aero'}}));
};
document.addEventListener('keydown',event=>{
  if (event.key==='Escape' && !$('#track-physics-drawer').hidden) closePhysicsDrawer(true);
});
for (const button of document.querySelectorAll('[data-tab]:not([data-tab="track"])')) {
  button.addEventListener('click',()=>closePhysicsDrawer());
}

function bindTrackPhysicsPicking(surface) {
  let press = null;
  let previousHit = null;
  function pickZone(event) {
    const rect = surface.getBoundingClientRect();
    zonePointer.set((event.clientX-rect.left)/rect.width*2-1,
      1-(event.clientY-rect.top)/rect.height*2);
    zoneRay.setFromCamera(zonePointer,camera);
    const hit = zoneRay.intersectObjects(zones.map(zone=>zone.line))[0];
    return hit ? zones.find(zone=>zone.line===hit.object) : null;
  }
  surface.addEventListener('pointerdown', event=>{
    press = event.isPrimary && event.button===0 ? [event.clientX,event.clientY] : null;
  });
  surface.addEventListener('pointermove', event=>{
    if (press && Math.hypot(event.clientX-press[0],event.clientY-press[1])>6) press=null;
    if (event.pointerType==='touch' || event.buttons) return;
    const zone = pickZone(event);
    if (zone===previousHit) return;
    previousHit = zone;
    surface.style.cursor = zone ? 'pointer' : '';
    if (!drawerTrigger) highlightZone(zone);
  });
  surface.addEventListener('pointerleave', ()=>{
    previousHit = null;
    surface.style.cursor = '';
    if (!drawerTrigger) highlightZone(null);
  });
  surface.addEventListener('pointercancel', ()=>{press=null;});
  surface.addEventListener('pointerup', event=>{
    const initial = press;
    press = null;
    if (!initial || Math.hypot(event.clientX-initial[0],event.clientY-initial[1])>6) return;
    const zone = pickZone(event);
    if (zone) openPhysicsDrawer(zone,zone.button);
  });
}
