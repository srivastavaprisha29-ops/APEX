import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import worker, {compare} from './worker.mjs';

test('fixture imports are idempotent and serve bounded comparisons', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./migrations/0001_monza.sql', import.meta.url), 'utf8'));
  const sql = execFileSync('python3', ['timing/import.py', '--fixture'], {encoding: 'utf8'});
  for (let i = 0; i < 2; i++) db.exec('BEGIN;\n' + sql + '\nCOMMIT;');
  assert.equal(db.prepare('SELECT count(*) AS n FROM timing_lap').get().n, 106);
  assert.equal(db.prepare('SELECT count(*) AS n FROM timing_revision').get().n, 1);
  const env = {TIMING: {prepare: query => ({bind: (...values) => ({
    all: async () => ({results: db.prepare(query).all(...values)})
  })})}};
  const get = (query, init) => worker.fetch(
    new Request('https://apex.example/api/v1/timing/monza-2024?' + query, init), env);
  const response = await get('a=1&b=1');
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.first.provider, 'fixture');
  assert.deepEqual(result.sectors.map(split => split.cumulative), [-3000, -3000, -3000, -3000]);
  assert.equal((await get('a=1&b=1', {headers: {'If-None-Match': response.headers.get('ETag')}})).status, 304);
  assert.equal((await get('a=54&b=1')).status, 400);
  assert.equal((await get('a=1&a=1')).status, 400);
  assert.equal((await get('a=1&b=1', {method: 'POST'})).status, 405);
  const missing = await (await get('a=2&b=1')).json();
  assert.deepEqual(missing.sectors.map(split => split.cumulative), [-3000, null, null, -3000]);
  assert.equal(compare(result.first, result.first)[3].delta, 0);
  assert.throws(() => db.exec("BEGIN; UPDATE timing_active SET revision = 'bad'; COMMIT;"));
  db.exec('ROLLBACK;');
  assert.equal((await get('a=1&b=1')).status, 200);
  db.close();
});
