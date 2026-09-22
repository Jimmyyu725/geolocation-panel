const $ = id => document.getElementById(id);
const C = globalThis.GeoPanelCore;
let point = null, tabId = null, detected = false;
const note = text => { $('status').textContent = text; };
function display(value, manual = false) {
  point = C.valid(value) ? value : null;
  detected = !!point && !manual;
  $('coordinates').textContent = point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : '—, —';
  $('source').textContent = point ? (manual ? '手动输入' : point.method) : '等待读取';
  $('freshness').textContent = point ? (manual ? '此位置来自你的手动输入。' : `读取时间 ${new Date(point.at).toLocaleTimeString()} · 当前加载街景`) : '坐标只保留在当前游戏页面，刷新即清除。';
  $('copy').disabled = !point;
  $('place').disabled = !detected;
  $('maps').classList.toggle('disabled', !point);
  $('maps').setAttribute('aria-disabled', String(!point));
  if (point) $('maps').href = `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
  else $('maps').removeAttribute('href');
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('请先选择游戏标签页。');
  return tab.id;
}
async function request(type, options) {
  const active = await activeTab();
  if (type === 'place' && active !== tabId) { display(null); throw new Error('标签页已切换，请重新读取位置。'); }
  if (type === 'read') tabId = active;
  let result;
  try { result = await chrome.tabs.sendMessage(active, { type, options }); }
  catch { throw new Error('请打开支持的游戏页面；安装扩展后需刷新页面。'); }
  if (!result?.ok) throw new Error(result?.message || '页面没有返回有效结果。');
  return result;
}
async function place() {
  if (!detected) throw new Error('请先读取游戏位置。');
  const result = await request('place', { zoom: $('zoom').checked, radius: Number($('radius').value), expectedSerial: point.serial });
  note(result.message);
}
$('read').addEventListener('click', async () => {
  $('read').disabled = true;
  try {
    const { current } = await request('read');
    display(current);
    if (!point) note('尚未捕获位置。请刷新或重新加载街景后重试；该站点的数据格式也可能尚未适配。');
    else if ($('auto').checked) await place();
    else note('已读取当前加载街景的坐标。');
  } catch (error) { display(null); note(error.message); }
  finally { $('read').disabled = false; }
});
$('place').addEventListener('click', async () => {
  $('place').disabled = true;
  try { await place(); } catch (error) { note(error.message); }
  finally { $('place').disabled = !detected; }
});
$('copy').addEventListener('click', async () => {
  if (!point) return;
  try { await navigator.clipboard.writeText(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`); note('坐标已复制。'); }
  catch { note('请直接选中上方坐标并复制。'); }
});
$('manualShow').addEventListener('click', () => {
  const parts = $('manual').value.trim().split(/[,，\s]+/);
  const value = parts.length === 2 && parts.every(part => part !== '') ? { lat: Number(parts[0]), lng: Number(parts[1]) } : null;
  if (!C.valid(value)) { note('请输入有效的纬度、经度，例如 25.033, 121.5654。'); return; }
  display(value, true); note('已显示手动输入的位置。');
});
for (const id of ['auto', 'zoom', 'radius']) $(id).addEventListener('input', async () => {
  $('radiusValue').textContent = `${$('radius').value} m`;
  try { await chrome.storage.local.set({ settings: { auto: $('auto').checked, zoom: $('zoom').checked, radius: Number($('radius').value) } }); }
  catch { note('设置保存失败，请重试。'); }
});
chrome.storage.local.get('settings').then(({ settings }) => {
  if (!settings) return;
  $('auto').checked = settings.auto === true;
  $('zoom').checked = settings.zoom === true;
  $('radius').value = Number.isFinite(settings.radius) ? Math.max(0, Math.min(10000, settings.radius)) : 0;
  $('radiusValue').textContent = `${$('radius').value} m`;
}).catch(() => note('设置读取失败，本次使用默认值。'));
chrome.tabs.onActivated.addListener(() => { tabId = null; display(null); });
chrome.tabs.onUpdated.addListener((id, change) => {
  if (id === tabId && (change.status === 'loading' || change.url)) { display(null); note('页面已变化，请重新读取位置。'); }
});
