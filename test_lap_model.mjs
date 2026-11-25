import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {normalizedPath} from './dist/track-math.js';
import {simulateLap,sampleLap} from './dist/lap-model.mjs';

test('full circuit laps obey the teaching limits and wrap continuously',()=>{
  const {features}=JSON.parse(readFileSync(new URL('./dist/data/circuit-layouts.geojson',import.meta.url)));
  assert.equal(features.length,40);
  for (const feature of features) {
    const lap=simulateLap(normalizedPath(feature),Number(feature.properties.length));
    assert(lap.duration>0);
    let last=-1;
    for (let i=0;i<960;i++) {
      const p=sampleLap(lap,lap.duration*i/960);
      assert(p.distance>last);
      assert(p.speed>0 && p.speed<=88.000001);
      assert(p.acceleration>=-12.000001 && p.acceleration<=5.000001);
      assert(Math.abs(p.lateral)<=22.000001);
      assert(p.downforce>=0 && p.power>=0);
      last=p.distance;
    }
    assert.deepEqual(sampleLap(lap,0),sampleLap(lap,lap.duration));
  }
});
