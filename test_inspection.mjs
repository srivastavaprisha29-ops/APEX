import assert from 'node:assert/strict';
import {partFromHit,tooltipPosition} from './dist/inspection.js';
import {technicalParts,references} from './dist/parts-data.js';
import {schematic} from './dist/schematics.js';
const group={visible:true,userData:{system:'front-wing'},parent:null};
const mesh={visible:true,userData:{},parent:group};
assert.equal(partFromHit({object:mesh}),'front-wing');group.visible=false;assert.equal(partFromHit({object:mesh}),null);group.visible=true;mesh.visible=false;assert.equal(partFromHit({object:mesh}),null);
assert.deepEqual(tooltipPosition(990,690,280,160,1000,700),{left:708,top:528});
assert.equal(Object.keys(technicalParts).length,16);
for(const [id,part]of Object.entries(technicalParts)){for(const field of ['title','role','principle','tradeoff','coupling','scope','diagram'])assert(part[field],id+' lacks '+field);assert(part.inspect.length>=3);assert(references(part).every(([label,url])=>label&&url.startsWith('https://')));assert(schematic(part.diagram).includes('<svg'))}
console.log('Inspection checks passed: visible-hit mapping, viewport bounds, 16 technical entries and schematics.');
