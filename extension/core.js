(() => {
  const valid = value => !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
  function endpoint(input) {
    try {
      const url = new URL(input);
      const prefix = '/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/';
      if (url.protocol !== 'https:' || url.hostname !== 'maps.googleapis.com') return null;
      const method = url.pathname.slice(prefix.length);
      return url.pathname.startsWith(prefix) && ['GetMetadata', 'SingleImageSearch'].includes(method) ? method : null;
    } catch { return null; }
  }
  function parse(text, method) {
    if (typeof text !== 'string' || text.length > 2_000_000) return null;
    try {
      const data = JSON.parse(text.replace(/^\)\]\}'\s*/, ''));
      // These private RPC layouts may change; unknown layouts deliberately return no location.
      const position = method === 'GetMetadata' ? data?.[1]?.[0]?.[5]?.[0]?.[1]?.[0]
        : method === 'SingleImageSearch' ? data?.[1]?.[5]?.[0]?.[1]?.[0] : null;
      const point = { lat: position?.[2], lng: position?.[3] };
      return valid(point) ? point : null;
    } catch { return null; }
  }
  function offset(point, meters = 0, random = Math.random) {
    if (!valid(point) || !Number.isFinite(meters) || meters < 0 || meters > 100000) throw new Error('Invalid coordinates or radius');
    if (!meters) return { lat: point.lat, lng: point.lng };
    const toRad = Math.PI / 180;
    const distance = Math.sqrt(random()) * meters / 6371008.8;
    const bearing = random() * 2 * Math.PI;
    const lat = point.lat * toRad, lng = point.lng * toRad;
    const nextLat = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing));
    const nextLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat));
    return { lat: nextLat / toRad, lng: ((nextLng / toRad + 540) % 360) - 180 };
  }
  globalThis.GeoPanelCore = Object.freeze({ valid, endpoint, parse, offset });
})();
