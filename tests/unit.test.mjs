import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../extension/core.js';
import { payload, rpc } from './fixtures.mjs';
const C = globalThis.GeoPanelCore;
test('both known RPC layouts and anti-XSSI prefix', () => {
  for (const method of ['GetMetadata', 'SingleImageSearch']) {
    assert.deepEqual(C.parse(payload(25.033, 121.5654, method), method), {lat:25.033,lng:121.5654});
    assert.deepEqual(C.parse(")]}'\n" + payload(0, 0, method), method), {lat:0,lng:0});
  }
});
test('unknown or malformed data never guesses a coordinate', () => {
  for (const text of ['', '{', '[[25,121]]', '{"lat":25,"lng":121}', payload(91, 121), payload(25, 181), payload('25', '121'), ' '.repeat(2000001)]) {
    assert.equal(C.parse(text, 'GetMetadata'), null);
  }
});
test('only the exact Google RPC endpoints are observed', () => {
  assert.equal(C.endpoint(rpc('GetMetadata')), 'GetMetadata');
  assert.equal(C.endpoint(rpc('SingleImageSearch') + '?x=1'), 'SingleImageSearch');
  for (const value of ['https://example.com/' + rpc('GetMetadata'), rpc('GetMetadata') + '/extra', rpc('GetMetadata').replace('https:', 'http:'), rpc('GetMetadata').replace('maps.googleapis.com', 'maps.googleapis.com.evil.test')]) assert.equal(C.endpoint(value), null);
});
test('offset radius is bounded and handles poles and the dateline', () => {
  const distance = (a,b) => {
    const r = Math.PI/180;
    const h = Math.sin((b.lat-a.lat)*r/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;
    return 2*6371008.8*Math.asin(Math.min(1, Math.sqrt(h)));
  };
  for (const point of [{lat:90,lng:180},{lat:-89.99,lng:-179.99},{lat:0,lng:0},{lat:25,lng:121}]) {
    assert.deepEqual(C.offset(point, 0), point);
    for (let i=0;i<100;i++) { const result=C.offset(point,10000); assert.ok(C.valid(result)); assert.ok(distance(point,result)<=10000.001); }
  }
  assert.throws(() => C.offset({lat:25,lng:121}, -1));
  assert.throws(() => C.offset({lat:25,lng:121}, Infinity));
});
test('manifest is scoped and shipped files exist', () => {
  const m = JSON.parse(fs.readFileSync('extension/manifest.json'));
  assert.deepEqual(m.permissions, ['storage','sidePanel']);
  assert.equal(m.content_scripts[0].world, 'MAIN');
  assert.equal(m.content_scripts[0].run_at, 'document_start');
  for (const entry of m.content_scripts) {
    assert.ok(entry.matches.every(match => /^https:\/\/(www\.)?(geoguessr|openguessr)\.com\/\*$/.test(match)));
    for (const file of entry.js) assert.ok(fs.existsSync('extension/'+file));
  }
});
