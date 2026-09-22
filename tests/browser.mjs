import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { html, mapsScript, payload, rpc } from './fixtures.mjs';
const root = path.resolve(process.argv[2] || 'extension');
const baseline = !JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).content_scripts;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-panel-test-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
  viewport: {width:390,height:1000}
});
let errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
await context.route('https://**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'www.geoguessr.com') {
    return route.fulfill({contentType:url.pathname === '/fixture-maps.js'?'text/javascript':'text/html', body:url.pathname==='/fixture-maps.js'?mapsScript:html});
  }
  if (url.hostname === 'maps.googleapis.com') {
    if (url.searchParams.has('delay')) await new Promise(resolve=>setTimeout(resolve,Number(url.searchParams.get('delay'))));
    return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:url.searchParams.has('invalid')?'{}':payload(Number(url.searchParams.get('lat')||25.033),121.5654,url.pathname.split('/').at(-1))});
  }
  return route.abort();
});
try {
  const game = await context.newPage();
  await game.goto('https://www.geoguessr.com/game/fixture');
  await game.waitForFunction(()=>!!window.map?.events);
  if (baseline) {
    assert.equal(await game.evaluate(()=>typeof window.GeoPanelCore), 'undefined');
    console.log('BROWSER_CAPTURE_DISABLED');
  } else {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const tab = await worker.evaluate(async()=> (await chrome.tabs.query({active:true,currentWindow:true}))[0].id);
    const send = async (type, options) => {
      if (type === 'place' && options?.expectedSerial === undefined) {
        const state = await send('read');
        options = { ...options, expectedSerial: state.current?.serial };
      }
      return worker.evaluate(async({tab,type,options})=>chrome.tabs.sendMessage(tab,{type,options}),{tab,type,options});
    };
    const fetchPoint = async(query='') => {
      await game.evaluate(async url => { const response=await fetch(url); window.originalResponse=await response.text(); },rpc('GetMetadata')+query);
      await game.waitForTimeout(50);
    };
    await fetchPoint();
    let read = await send('read');
    assert.equal(read.current.lat,25.033);
    assert.equal(read.current.lng,121.5654);
    assert.equal(await game.evaluate(()=>window.originalResponse),payload(25.033,121.5654));
    const firstPlace = await send('place',{radius:0,zoom:false}); assert.equal(firstPlace.ok,true, JSON.stringify(firstPlace));
    assert.deepEqual(await game.evaluate(()=>clicks.at(-1)),{lat:25.033,lng:121.5654});
    await send('place',{radius:1000,zoom:true});
    assert.deepEqual(await game.evaluate(()=>zooms),[4,7,10,13]);
    assert.notDeepEqual(await game.evaluate(()=>clicks.at(-1)),{lat:25.033,lng:121.5654});
    // A newer request wins even when an older response arrives last.
    await game.evaluate(async url => {await Promise.all([fetch(url+'?lat=10&delay=200'),fetch(url+'?lat=20&delay=10')]);},rpc('GetMetadata'));
    await game.waitForTimeout(60);
    assert.equal((await send('read')).current.lat,20);
    assert.equal((await send('place',{expectedSerial:read.current.serial})).ok,false);
    await fetchPoint('?invalid=1');
    assert.equal((await send('read')).current,null);
    assert.equal((await send('place',{})).ok,false);
    // XHR observes JSON responses while preserving the original response.
    await game.evaluate(url=>new Promise(resolve=>{const xhr=new XMLHttpRequest();xhr.open('GET',url);xhr.responseType='json';xhr.onload=resolve;xhr.send();}),rpc('SingleImageSearch'));
    await game.waitForTimeout(50);
    assert.equal((await send('read')).current.method,'SingleImageSearch');
    await game.evaluate(()=>history.pushState({},'', '/game/new-round'));
    assert.equal((await send('read')).current,null);
    await fetchPoint();
    // Navigation during animated placement cancels the action.
    const before=await game.evaluate(()=>clicks.length);
    const placement=send('place',{zoom:true,radius:0});
    await game.waitForTimeout(180);
    await game.evaluate(()=>history.pushState({},'', '/game/another-round'));
    assert.equal((await placement).ok,false);
    assert.equal(await game.evaluate(()=>clicks.length),before);
    await fetchPoint();
    // Real extension page, storage, content-script bridge, and main-world scripts.
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${id}/panel.html`);
    await panel.locator('summary').click();
    await panel.locator('#manual').fill('25.033, 121.5654');
    await panel.locator('#manualShow').click();
    assert.equal(await panel.locator('#coordinates').innerText(),'25.033000, 121.565400');
    assert.ok(await panel.locator('#place').isDisabled());
    assert.equal(await panel.locator('#maps').getAttribute('href'),'https://www.google.com/maps/search/?api=1&query=25.033,121.5654');
    await panel.locator('#zoom').check();
    await panel.waitForTimeout(100);
    await panel.reload();
    assert.ok(await panel.locator('#zoom').isChecked());
    await worker.evaluate(tab=>chrome.tabs.update(tab,{active:true}),tab);
    await panel.locator('#read').click();
    await panel.waitForFunction(()=>document.getElementById('coordinates').textContent==='25.033000, 121.565400');
    assert.equal(await panel.locator('#coordinates').innerText(),'25.033000, 121.565400');
    assert.ok(await panel.locator('#place').isEnabled());
    await panel.screenshot({path:'artifacts/panel-preview.png',fullPage:true});
    const behavior=await worker.evaluate(()=>chrome.sidePanel.getPanelBehavior());
    assert.equal(behavior.openPanelOnActionClick,true);
    assert.deepEqual(errors,[]);
    console.log('BROWSER_PASS: extension load, fetch, XHR, response preservation, latest-request wins, invalid data, route reset, pin event, zoom, radius, cancellation, panel, storage, sidePanel');
  }
} finally {
  await context.close();
  fs.rmSync(profile,{recursive:true,force:true});
}
