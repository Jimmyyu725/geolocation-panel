(() => {
  const pending = new Map();
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'geo-panel-out') return;
    if (event.data.type === 'reply' && pending.has(event.data.id)) {
      const { resolve, timer } = pending.get(event.data.id);
      clearTimeout(timer); pending.delete(event.data.id);
      resolve(event.data.result);
    }
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !['read', 'place', 'clear'].includes(message?.type)) return;
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      respond({ ok: false, message: '页面读取超时，请刷新游戏页面后重试。' });
    }, 5000);
    pending.set(id, { resolve: respond, timer });
    window.postMessage({ channel: 'geo-panel-in', id, type: message.type, options: message.options }, location.origin);
    return true;
  });
})();
