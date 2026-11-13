import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layoutIds,lapSeconds,formatLap,bestLap,compareLaps,raceCars,normalizedPath,samplePath} from './dist/track-math.js';
import {engineeringForces} from './dist/physics.js';
const snapshot=JSON.parse(readFileSync('dist/data/racing-snapshot.json')),layouts=JSON.parse(readFileSync('dist/data/circuit-layouts.geojson'));
assert.equal(lapSeconds('1:23.226'),83.226);assert.equal(lapSeconds('bad'),null);assert.equal(formatLap(83.226),'1:23.226');
for(const entry of snapshot.calendar2026)assert(layouts.features.some(f=>f.properties.id===layoutIds[entry.circuitId]),'Calendar layout absent: '+entry.circuitId);
for(const feature of layouts.features){const p=normalizedPath(feature);assert(Number.isFinite(p.length)&&p.length>0);for(const fraction of [0,.2,.9,1,2.5]){const s=samplePath(p,fraction);assert([s.x,s.z,s.heading].every(Number.isFinite))}const a=samplePath(p,0),b=samplePath(p,1);assert(Math.hypot(a.x-b.x,a.z-b.z)<1e-7)}
for(const id of ['rb20','mcl38']){const car=raceCars.find(c=>c.id===id),record=bestLap(snapshot,'monza',car);assert(record&&record.seconds>60&&record.seconds<150);assert.equal(record.constructor,car.constructor);assert.equal(record.race.season,'2024')}
assert.equal(bestLap(snapshot,'ain-diab',raceCars[0]),null);
const assumptions={mass:800,rho:1.225,area:1.5,cd:1,cl:3,radius:100,mu:1.5,betaDeg:5};const a=engineeringForces({...assumptions,speedKph:100}),b=engineeringForces({...assumptions,speedKph:200});assert(Math.abs(b.drag/a.drag-4)<1e-9);assert(Math.abs(b.dragPowerKw/a.dragPowerKw-8)<1e-9);assert(Math.abs(b.lateralAcceleration/a.lateralAcceleration-4)<1e-9);
console.log(`Track/physics checks passed: ${snapshot.circuits.length} circuits, ${layouts.features.length} paths, all ${snapshot.calendar2026.length} calendar entries, real Monza comparisons, missing-data handling and SI scaling.`);

assert.equal(lapSeconds('1:60.000'), null);
assert.equal(lapSeconds('1:02'), null);
assert.equal(formatLap(59.9999), '1:00.000');
const redBull = bestLap(snapshot, 'monza', raceCars.find(car => car.id === 'rb20'));
const mclaren = bestLap(snapshot, 'monza', raceCars.find(car => car.id === 'mcl38'));
assert.deepEqual(compareLaps(redBull, redBull), {milliseconds: 0, leader: null, sameEvent: true});
assert.equal(compareLaps(redBull, mclaren).sameEvent, true);
assert.equal(compareLaps(redBull, {...mclaren, race: {...mclaren.race, round: '99'}}).sameEvent, false);
assert.equal(compareLaps(null, mclaren), null);
