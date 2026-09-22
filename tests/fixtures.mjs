export const rpc = method => `https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/${method}`;
export function payload(lat, lng, method = 'GetMetadata') {
  const inner = [];
  inner[5] = [[null, [[null, null, lat, lng]]]];
  return JSON.stringify([null, method === 'GetMetadata' ? [inner] : inner]);
}
export const html = `<!doctype html><html><head><title>Geo Panel integration fixture</title></head><body><h1>本地模拟街景页面</h1><div id="map" style="width:600px;height:400px;background:#284639">地图模拟组件</div><script src="/fixture-maps.js"></script></body></html>`;
export const mapsScript = `
window.clicks = [];
window.zooms = [];
class FixtureMap {
  constructor(div) { this.div = div; this.events = {}; }
  getDiv() { return this.div; }
  panTo(point) { this.center = point; }
  setCenter(point) { this.center = point; }
  setZoom(value) { window.zooms.push(value); }
  addListener(type, callback) { this.events[type] ||= []; this.events[type].push(callback); }
}
window.google = { maps: { Map: FixtureMap, LatLng: class {
  constructor(lat, lng) { this.lat = () => lat; this.lng = () => lng; }
}, event: {
  hasListeners: (map, type) => !!map.events[type]?.length,
  trigger: (map, type, event) => map.events[type]?.forEach(callback => callback(event))
} } };
setTimeout(() => {
  window.map = new google.maps.Map(document.getElementById('map'));
  map.addListener('click', event => clicks.push({lat:event.latLng.lat(),lng:event.latLng.lng()}));
}, 350);
`;
