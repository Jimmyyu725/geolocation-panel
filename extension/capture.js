(() => {
  const C = globalThis.GeoPanelCore;
  let serial = 0, current = null, href = location.href, busy = false;
  const maps = new Set(), patched = new WeakSet();
  const send = (type, payload = {}) => window.postMessage({ channel: 'geo-panel-out', type, ...payload }, location.origin);
  const reset = () => { serial++; current = null; send('state', { current }); };
  function begin() { href = location.href; reset(); return serial; }
  function finish(id, text, method) {
    if (id !== serial) return;
    if (location.href !== href) { href = location.href; reset(); return; }
    const point = C.parse(text, method);
    current = point ? { ...point, method, at: Date.now(), href, serial: id } : null;
    send('state', { current });
  }
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const method = C.endpoint(typeof input === 'string' || input instanceof URL ? String(input) : input?.url);
    const id = method ? begin() : null;
    const promise = Reflect.apply(originalFetch, this, arguments);
    if (method) promise.then(response => {
      if (response.ok) response.clone().text().then(text => finish(id, text, method)).catch(() => {});
    }, () => {});
    return promise;
  };
  const open = XMLHttpRequest.prototype.open, sendXHR = XMLHttpRequest.prototype.send;
  const requests = new WeakMap();
  XMLHttpRequest.prototype.open = function(verb, url) {
    const result = Reflect.apply(open, this, arguments);
    requests.set(this, { method: C.endpoint(String(url)) });
    return result;
  };
  XMLHttpRequest.prototype.send = function() {
    const request = requests.get(this);
    if (request?.method) {
      const id = begin();
      const loaded = () => {
        if (this.status >= 200 && this.status < 300) {
          try { finish(id, this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText, request.method); } catch {}
        }
      };
      this.addEventListener('load', loaded, { once: true });
      this.addEventListener('loadend', () => this.removeEventListener('load', loaded), { once: true });
    }
    return Reflect.apply(sendXHR, this, arguments);
  };
  function remember(map) {
    if (map?.getDiv && typeof map.panTo === 'function') maps.add(map);
  }
  function hookMaps() {
    const api = window.google?.maps;
    if (!api?.Map || patched.has(api.Map)) return;
    const Original = api.Map;
    const Wrapped = new Proxy(Original, {
      construct(target, args, newTarget) {
        const map = Reflect.construct(target, args, newTarget);
        remember(map);
        return map;
      }
    });
    patched.add(Wrapped);
    api.Map = Wrapped;
    for (const key of ['setCenter', 'panTo', 'fitBounds', 'addListener']) {
      const original = Original.prototype[key];
      if (typeof original !== 'function') continue;
      Original.prototype[key] = function() { remember(this); return Reflect.apply(original, this, arguments); };
    }
  }
  function mapTarget() {
    const api = window.google?.maps;
    const candidates = [];
    for (const map of maps) {
      const div = map.getDiv();
      if (!div?.isConnected) { maps.delete(map); continue; }
      if (div.getClientRects().length && api.event.hasListeners(map, 'click')) candidates.push(map);
    }
    if (candidates.length !== 1) throw new Error(candidates.length ? '发现多个地图，请只保留一个猜测地图。' : '请展开游戏小地图并稍作缩放，然后重试；地图适配尚未就绪。');
    return candidates[0];
  }
  async function place(options) {
    if (busy) throw new Error('上一项地图操作仍在进行。');
    const snapshot = current, route = location.href;
    if (!snapshot || Date.now() - snapshot.at > 120000 || snapshot.href !== route) throw new Error('请重新加载当前街景以获取新坐标。');
    if (options.expectedSerial !== snapshot.serial) throw new Error('街景已更新，请重新读取后再落点。');
    const point = C.offset(snapshot, options.radius ?? 0);
    const map = mapTarget();
    busy = true;
    try {
      if (options.zoom) {
        map.panTo(point);
        for (const zoom of [4, 7, 10, 13]) {
          if (current !== snapshot || location.href !== route) throw new Error('位置已变化，已取消落点。');
          map.setZoom(zoom);
          await new Promise(resolve => setTimeout(resolve, 140));
        }
      }
      if (current !== snapshot || location.href !== route || !map.getDiv()?.isConnected) throw new Error('位置或地图已变化，已取消落点。');
      const api = window.google.maps;
      api.event.trigger(map, 'click', { latLng: new api.LatLng(point.lat, point.lng), domEvent: new MouseEvent('click') });
      return { ok: true, point, message: '已发送落点，请检查游戏地图；提交仍由你点击。' };
    } finally { busy = false; }
  }
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'geo-panel-in') return;
    const { type, id, options } = event.data;
    if (typeof id !== 'string' || id.length > 100) return;
    if (type === 'read') {
      if (location.href !== href || (current && Date.now() - current.at > 120000)) { href = location.href; reset(); }
      send('reply', { id, result: { ok: true, current } });
    } else if (type === 'place') {
      try { send('reply', { id, result: await place(options || {}) }); }
      catch (error) { send('reply', { id, result: { ok: false, message: error.message } }); }
    } else if (type === 'clear') {
      reset(); send('reply', { id, result: { ok: true, current: null } });
    }
  });
  // Polling avoids rewriting Google's loader globals. Late map construction is supported.
  setInterval(() => {
    try { hookMaps(); } catch {}
    if (href !== location.href) { href = location.href; reset(); }
  }, 100);
  hookMaps();
})();
