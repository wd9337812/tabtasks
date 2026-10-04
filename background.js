importScripts('config.js', 'license.js', 'data.js');
const serialize = Data.queue();
const DEFAULT_LISTS = [{ id: 'inbox', name: '收集箱', color: '#6d5efc' }, { id: 'today', name: '今天看', color: '#f59e0b' }];
async function readState() {
  const raw = await chrome.storage.local.get(['lists', 'tasks', 'licenseKey', 'pendingCaptures']);
  const lists = Data.records(raw.lists, Data.list), tasks = Data.records(raw.tasks, Data.task);
  if (!lists.values.length) lists.values = DEFAULT_LISTS.map(x => ({ ...x }));
  if (!lists.values.some(x => x.id === 'inbox')) lists.values.unshift({ ...DEFAULT_LISTS[0] });
  const allowed = new Set(lists.values.map(x => x.id));
  tasks.values.forEach(t => { if (!allowed.has(t.listId)) t.listId = 'inbox'; });
  const license = raw.licenseKey ? await Lic.verify(raw.licenseKey, CONFIG.SECRET) : { ok: false };
  return { lists: lists.values, tasks: tasks.values, plan: license.ok && license.plan === 'pro' ? 'pro' : 'free',
    license: license.ok ? license : null, pending: Array.isArray(raw.pendingCaptures) ? raw.pendingCaptures : [], raw, invalid: lists.invalid || tasks.invalid };
}
const capsFor = s => s.plan === 'pro' ? CONFIG.PRO : CONFIG.FREE;
const snapshot = s => ({ lists: s.lists, tasks: s.tasks, plan: s.plan, license: s.license, pendingCount: s.pending.length, recoveryAvailable: s.invalid });
async function writeState(s) {
  await Data.protect(s.raw, ['lists', 'tasks'], 'tt_recovery_backup_v1', s.invalid);
  await chrome.storage.local.set({ lists: s.lists, tasks: s.tasks, pendingCaptures: s.pending });
  await updateBadge(s);
}
async function updateBadge(s) {
  s ||= await readState(); const n = s.tasks.filter(t => !t.done).length;
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#6d5efc' });
}
function requireFeature(s, name) { if (!capsFor(s)[name]) Data.fail('pro', '该功能需要 Pro'); }
function addTask(s, input) {
  if (s.tasks.filter(t => !t.done).length >= capsFor(s).maxActiveTasks) Data.fail('limit', `免费版最多 ${CONFIG.FREE.maxActiveTasks} 个活动任务`);
  const t = Data.task({ id: Data.id(), title: input.title, listId: 'inbox', createdAt: Date.now(), ...input });
  if (!s.lists.some(l => l.id === t.listId)) t.listId = 'inbox';
  if (s.tasks.some(x => x.id === t.id)) return;
  s.tasks.unshift(t); return t;
}
function consumePending(s) {
  let consumed = 0;
  while (s.pending.length && s.tasks.filter(t => !t.done).length < capsFor(s).maxActiveTasks) {
    const p = s.pending[0]; if (!Data.object(p) || typeof p.title !== 'string') break;
    addTask(s, { title: p.title || '未命名', url: Data.http(p.url) ? p.url : '', excerpt: Data.text(p.excerpt, 320), source: 'menu', createdAt: p.at || Date.now() });
    s.pending.shift(); consumed++;
  }
  return consumed;
}
async function captureTab(s, tabId, listId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab || !Data.http(tab.url)) Data.fail('invalid', '当前页面无法收集（需 http/https 网页）');
  let payload = { title: tab.title || tab.url, url: tab.url, excerpt: '' }, excerptUnavailable = false;
  if (capsFor(s).excerpt) {
    try {
      const result = await chrome.scripting.executeScript({ target: { tabId }, func: () => {
        const sel = (window.getSelection()?.toString() || '').trim(), meta = document.querySelector('meta[name="description"]'), p = document.querySelector('article p, main p, p');
        return { title: document.title, url: location.href, excerpt: (sel || meta?.content || p?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 320) };
      } });
      if (result[0]?.result) payload = result[0].result;
    } catch { excerptUnavailable = true; }
  }
  return { task: addTask(s, { ...payload, listId: listId || 'inbox', source: 'capture' }), excerptUnavailable };
}
function patchTask(s, id, patch) {
  const task = s.tasks.find(t => t.id === id); if (!task) Data.fail('missing', '任务已被另一个窗口删除');
  const allowed = ['title', 'note', 'due', 'tags', 'listId', 'done'];
  const fields = Object.fromEntries(allowed.filter(k => Object.hasOwn(patch, k)).map(k => [k, patch[k]]));
  if ('tags' in fields) requireFeature(s, 'tags');
  if (fields.done === false && task.done && s.tasks.filter(t => !t.done).length >= capsFor(s).maxActiveTasks) Data.fail('limit', '活动任务已达上限');
  const updated = Data.task({ ...task, ...fields, completedAt: 'done' in fields ? (fields.done ? Date.now() : null) : task.completedAt });
  if (!s.lists.some(l => l.id === updated.listId)) Data.fail('missing', '列表不存在');
  Object.assign(task, updated);
}
async function dispatch(op, p = {}) {
  const s = await readState(); let changed = false, extra = {};
  if (op === 'READ') changed = consumePending(s) > 0;
  else if (op === 'ADD') { extra.task = addTask(s, p); changed = true; }
  else if (op === 'CAPTURE') { extra = await captureTab(s, p.tabId, p.listId); changed = true; }
  else if (op === 'SELECTION') {
    s.pending.push({ id: Data.id(), title: Data.text(p.title, 140), url: Data.http(p.url) ? p.url : '', excerpt: Data.text(p.excerpt, 320), at: Date.now() });
    consumePending(s); extra.deferred = !!s.pending.length; changed = true;
  }
  else if (op === 'PATCH') { patchTask(s, p.id, p.patch || {}); changed = true; }
  else if (op === 'TAG_ADD') {
    const task = s.tasks.find(t => t.id === p.id); if (!task) Data.fail('missing', '任务不存在');
    const tag = Data.text(p.tag, 80).trim(); if (!tag) Data.fail('invalid', '请输入标签');
    patchTask(s, p.id, { tags: [...task.tags, tag] }); changed = true;
  }
  else if (op === 'TOGGLE') { const t = s.tasks.find(t => t.id === p.id); if (!t) Data.fail('missing', '任务不存在'); patchTask(s, p.id, { done: !t.done }); changed = true; }
  else if (op === 'DELETE') { s.tasks = s.tasks.filter(t => t.id !== p.id); changed = true; }
  else if (op === 'CLEAR_DONE') { s.tasks = s.tasks.filter(t => !t.done); changed = true; }
  else if (op === 'SUB_ADD' || op === 'SUB_TOGGLE' || op === 'SUB_DELETE') {
    const t = s.tasks.find(t => t.id === p.id); if (!t) Data.fail('missing', '任务不存在');
    if (op === 'SUB_ADD') { const title = Data.text(p.title, 140).trim(); if (!title) Data.fail('invalid', '请输入子任务'); t.subtasks.push({ id: Data.id(), title, done: false }); }
    else if (op === 'SUB_DELETE') t.subtasks = t.subtasks.filter(x => x.id !== p.subId);
    else { const sub = t.subtasks.find(x => x.id === p.subId); if (sub) sub.done = !sub.done; }
    changed = true;
  }
  else if (op === 'LIST_ADD') {
    if (s.lists.length >= capsFor(s).maxLists) Data.fail('limit', `免费版最多 ${CONFIG.FREE.maxLists} 个列表`);
    s.lists.push(Data.list({ id: Data.id(), name: p.name, color: '#10b981' })); changed = true;
  }
  else if (op === 'LIST_DELETE') {
    if (p.id === 'inbox') Data.fail('invalid', '收集箱不可删除');
    s.lists = s.lists.filter(l => l.id !== p.id); s.tasks.forEach(t => { if (t.listId === p.id) t.listId = 'inbox'; }); changed = true;
  }
  else if (op === 'IMPORT') {
    requireFeature(s, 'export'); if (!Data.object(p.data)) Data.fail('invalid', '文件不是 TabTasks 备份');
    const lists = Data.records(p.data.lists, Data.list, true).values, tasks = Data.records(p.data.tasks, Data.task, true).values;
    const haveL = new Set(s.lists.map(l => l.id)), haveT = new Set(s.tasks.map(t => t.id));
    const newLists = lists.filter(l => !haveL.has(l.id)), newTasks = tasks.filter(t => !haveT.has(t.id));
    const known = new Set([...s.lists, ...newLists].map(l => l.id));
    if (newTasks.some(t => !known.has(t.listId))) Data.fail('invalid', '备份引用了不存在的列表');
    s.lists.push(...newLists); s.tasks.unshift(...newTasks); changed = true;
    extra.importedTasks = newTasks.length; extra.importedLists = newLists.length;
  }
  else if (op === 'AI_APPLY') {
    requireFeature(s, 'ai');
    if (!Array.isArray(p.ops) || !p.ops.length || p.ops.length > 200) Data.fail('invalid', 'AI 操作格式不正确');
    for (const o of p.ops) {
      if (!Data.object(o)) Data.fail('invalid', 'AI 操作格式不正确');
      if (o.op === 'add') addTask(s, { title: o.title, due: o.due || '', tags: o.tags || [], note: o.note || '', listId: p.listId || 'inbox', source: 'ai' });
      else if (o.op === 'update') patchTask(s, o.id, o);
      else if (o.op === 'done') patchTask(s, o.id, { done: true });
      else if (o.op === 'del') { if (!s.tasks.some(t => t.id === o.id)) Data.fail('missing', 'AI 操作的任务已不存在'); s.tasks = s.tasks.filter(t => t.id !== o.id); }
      else Data.fail('invalid', 'AI 返回了不支持的操作');
    }
    changed = true;
  }
  else if (op === 'LICENSE_SET') {
    const v = await Lic.verify(p.key, CONFIG.SECRET);
    if (!v.ok || v.plan !== 'pro') Data.fail('invalid', v.reason === 'expired' ? 'Key 已过期' : 'Key 无效');
    await chrome.storage.local.set({ licenseKey: p.key }); return { ok: true, state: snapshot(await readState()) };
  }
  else if (op === 'LICENSE_RELEASE') { await chrome.storage.local.remove('licenseKey'); return { ok: true, state: snapshot(await readState()) }; }
  else Data.fail('invalid', 'Unknown operation');
  if (changed) { consumePending(s); await writeState(s); }
  return { ok: true, state: snapshot(s), ...extra };
}
function request(op, payload) { return serialize(() => dispatch(op, payload)); }
function feedback(result, windowId) {
  chrome.runtime.sendMessage({ type: 'TT_FEEDBACK', windowId, ok: result.ok, message: result.message || (result.deferred ? '活动任务已达上限，选区已暂存；腾出空间后自动收集' : '已收集任务') }).catch(() => {});
  if (!result.ok) { chrome.action.setBadgeText({ text: '!' }); chrome.action.setTitle({ title: result.message || 'TabTasks 操作失败，请打开侧栏重试' }); }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) return;
  if (!msg || msg.type !== 'TT_OP') return;
  request(msg.op, msg.payload).then(sendResponse, e => sendResponse({ ok: false, code: e.code || 'storage', message: e.code ? e.message : '保存失败，请检查本地存储空间后重试' })); return true;
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'capture-selection' || !info.selectionText) return;
  if (tab?.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  const text = info.selectionText.replace(/\s+/g, ' ').trim();
  request('SELECTION', { title: text.slice(0, 140), excerpt: text.slice(0, 320), url: tab?.url || '' })
    .then(r => feedback(r, tab?.windowId), e => feedback({ ok: false, message: e.code ? e.message : '选区保存失败，请重试' }, tab?.windowId));
});
chrome.commands.onCommand.addListener(async (cmd, suppliedTab) => {
  if (cmd !== 'capture-page') return;
  try {
    const tab = suppliedTab || (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; if (!tab) return;
    const r = await request('CAPTURE', { tabId: tab.id }); feedback(r, tab.windowId);
  } catch(e) { feedback({ ok: false, message: e.code ? e.message : '收集失败，请重试' }); }
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.warn);
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({ id: 'capture-selection', title: '收集选区为 TabTasks 任务', contexts: ['selection'] }));
  request('READ').then(r => updateBadge(r.state)).catch(console.warn);
});
chrome.runtime.onStartup.addListener(() => request('READ').then(r => updateBadge(r.state)).catch(console.warn));
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.tasks || changes.licenseKey)) updateBadge().catch(console.warn); });
