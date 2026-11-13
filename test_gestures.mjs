import assert from 'node:assert/strict';
import {Manipulator} from './dist/gestures.js';
function hand(x,pinch){const h=Array.from({length:21},()=>({x,y:.5,z:0}));h[9]={x,y:.3,z:0};h[5]={x:x-.06,y:.35};h[17]={x:x+.06,y:.4};h[4]={x:x-.01,y:.42};h[8]={x:x+(pinch?.01:.2),y:.42};return h}
let m=new Manipulator();assert.equal(m.update([hand(.3,true)],['Left']).mode,'grab');assert(Math.abs(m.update([hand(.35,true)],['Left']).dx+.05)<1e-8);
m.reset();m.update([hand(.2,false),hand(.7,false)],['Left','Right']);assert(m.update([hand(.15,false),hand(.75,false)],['Left','Right']).scaleRatio>1);
m.reset();m.update([hand(.2,true),hand(.7,true)],['Left','Right']);assert(m.update([hand(.15,true),hand(.75,true)],['Left','Right']).explodeDelta>0);
assert.equal(m.update([]).mode,'idle');assert.equal(m.update([hand(.8,true)],['Left']).dx,undefined);
console.log('Gesture manipulation tests passed: grab, scale, pull-apart and hand-loss reset.');
