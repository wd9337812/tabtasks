/* ============================================================
   sidepanel.js  —  TabTasks 核心逻辑（纯本地，chrome.storage）
   ============================================================ */


const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => crypto.randomUUID();
let state = { lists: [], tasks: [], activeList: 'all', plan: 'free', license: null };
let panelWindowId;
function applyState(next) {
  if (!next) return;
  Object.assign(state, next);
  if (state.activeList !== 'all' && !state.lists.some(l => l.id === state.activeList)) state.activeList = 'all';
}
async function rpc(op, payload = {}) {
  if (globalThis.__previewMode) { toast('预览模式不保存数据'); return null; }
  try {
    const result = await chrome.runtime.sendMessage({ type: 'TT_OP', op, payload });
    if (!result?.ok) {
      const msg = result?.message || '后台暂时不可用，请重新打开侧栏';
      if (result?.code === 'pro' || result?.code === 'limit') upgradeNeeded(msg); else toast(msg);
      return null;
    }
    applyState(result.state); render(); return result;
  } catch { toast('保存失败，请重试'); return null; }
}
async function load() {
  if (globalThis.__previewMode) return;
  const result = await chrome.runtime.sendMessage({ type: 'TT_OP', op: 'READ' });
  if (!result?.ok) throw new Error(result?.message || '后台暂时不可用');
  applyState(result.state);
}
const caps = () => state.plan === 'pro' ? CONFIG.PRO : CONFIG.FREE;
const isPro = () => state.plan === 'pro';
function activeTasks() { return state.tasks.filter(t => !t.done); }
async function checkLicense(key) {
  const r = await rpc('LICENSE_SET', { key });
  if (r) licStatus('已激活 Pro', true); else licStatus('Key 无效或激活失败', false);
}
async function deactivate() { if (await rpc('LICENSE_RELEASE')) licStatus('已解除，回到免费版', false); }
function licStatus(text, ok) { const el=$('#licStatus'); el.textContent=text; el.className='lic-status '+(ok?'ok':'err'); }
async function captureCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, windowId: panelWindowId });
  if (!tab || !/^https?:/i.test(tab.url || '')) return toast('当前页面无法收集（需 http/https 网页）');
  const r = await rpc('CAPTURE', { tabId: tab.id, listId: state.activeList === 'all' ? 'inbox' : state.activeList });
  if (r) toast(r.excerptUnavailable ? '已收集标题和链接；如需正文摘要，请在网页上使用 Alt+Shift+T 或重新点击扩展图标授权' : '已收集任务');
}
async function addQuickTask(title) {
  title=(title||'').trim(); if (!title) return null;
  return rpc('ADD', { title, listId: state.activeList === 'all' ? 'inbox' : state.activeList, source: 'quick' });
}
const toggleTask = id => rpc('TOGGLE', { id });
const deleteTask = id => rpc('DELETE', { id });
const updateTask = (id, patch) => rpc('PATCH', { id, patch });
const moveTask = (id, listId) => updateTask(id, { listId });
function listName(id) { return state.lists.find(l => l.id === id)?.name || '收集箱'; }
const addList = name => rpc('LIST_ADD', { name });
const deleteList = id => rpc('LIST_DELETE', { id });
function exportData() {
  if (!caps().export) return upgradeNeeded('导出/导入为 Pro 功能。');
  const url=URL.createObjectURL(new Blob([JSON.stringify({ app: 'tabtasks', v: 1, lists: state.lists, tasks: state.tasks },null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download='tabtasks-backup-'+Date.now()+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importData(file) {
  if (!caps().export) return upgradeNeeded('导出/导入为 Pro 功能。');
  if (file.size > 10*1024*1024) return toast('备份文件过大（最多 10 MB）');
  try {
    const data=JSON.parse(await file.text());
    if (data.app && data.app !== 'tabtasks') throw new Error('Wrong app');
    const r=await rpc('IMPORT',{data});
    if(r) toast('已导入 '+r.importedTasks+' 个任务、'+r.importedLists+' 个列表');
  } catch { toast('文件不是有效的 TabTasks 备份'); }
}

// ---------- .ics 日程导出（到期任务的本地桥，不碰任何账号） ----------
function icsEsc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function exportIcs() {
  const due = state.tasks.filter((t) => t.due && !t.done);
  if (!due.length) return toast("没有带到期日的未完成任务可导出");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TabTasks//CN", "CALSCALE:GREGORIAN"];
  due.forEach((t) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@tabtasks`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${t.due.replace(/-/g, "")}`,
      `SUMMARY:${icsEsc(t.title)}`,
      `DESCRIPTION:${icsEsc((t.url ? t.url + "\n" : "") + (t.note || ""))}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = `tabtasks-due-${Date.now()}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`已导出 ${due.length} 条到期任务为 .ics`);
}

// ---------- AI 助手（自带 OpenAI Key，Pro；ops 预览后才落库） ----------
const AI_ORIGIN = { origins: ["https://api.openai.com/*"] };
let aiPendingOps = [];
function aiStatus(text, ok) {
  const el = $("#aiStatus");
  el.textContent = text;
  el.className = "lic-status " + (ok ? "ok" : "err");
}
async function aiSaveKey() {
  const k = $("#aiKey").value.trim();
  try {
    await chrome.storage.local.set({ aiKey: k, aiModel: $("#aiModel").value.trim() || "gpt-4o-mini" });
    aiStatus(k ? "Key 已保存（仅本机）" : "Key 已清除", !!k);
  } catch { aiStatus('Key 保存失败，请重试', false); }
}

async function aiSend() {
  if (!caps().ai) return upgradeNeeded('AI 助手为 Pro 功能。');
  const instr=$('#aiChat').value.trim(); if(!instr) return;
  if(globalThis.__previewMode) return aiStatus('预览模式不可用 AI',false);
  // Call request synchronously from the button's user gesture.
  const granted=chrome.permissions.request(AI_ORIGIN);
  $('#btnAiSend').disabled=true;
  aiPendingOps=[]; renderAiOps();
  try {
    if(!await granted) return aiStatus('未授予联网权限，无法直连 OpenAI',false);
    const d=await chrome.storage.local.get(['aiKey','aiModel']);
    if(!d.aiKey) return aiStatus('请先保存你的 OpenAI Key',false);
    await load(); if(!caps().ai) return upgradeNeeded('AI 助手为 Pro 功能。');
    aiStatus('思考中…',true);
    const snapshot=state.tasks.map(t=>({id:t.id,title:t.title,due:t.due,done:t.done,tags:t.tags||[]}));
    const sys='你是任务助手，只返回 JSON 数组，不要 markdown。操作：add(title,due,tags,note)、update(id,title,due,tags,note)、done(id)、del(id)。仅操作用户明确指定的任务。所有 id 必须来自当前列表。日期为 YYYY-MM-DD。今天是 '+new Date().toLocaleDateString('sv-SE')+'。当前任务：'+JSON.stringify(snapshot);
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
    let res;
    try { res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+d.aiKey},body:JSON.stringify({model:d.aiModel||'gpt-4o-mini',temperature:0,messages:[{role:'system',content:sys},{role:'user',content:instr}]})}); }
    finally { clearTimeout(timer); }
    if(!res.ok) return aiStatus('OpenAI 返回 '+res.status+'（检查 Key / 余额 / 模型名）',false);
    const j=await res.json(), raw=j.choices?.[0]?.message?.content||'';
    const ops=JSON.parse(raw.replace(/^\s*\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}\s*$/,'').trim());
    if(!Array.isArray(ops)||!ops.length||ops.length>200) throw new Error('无有效操作');
    const ids=new Set(state.tasks.map(t=>t.id));
    aiPendingOps=ops.map(o=>{
      if(!Data.object(o)||!['add','update','done','del'].includes(o.op)) throw new Error('不支持的操作');
      if(o.op!=='add'&&!ids.has(o.id)) throw new Error('任务不存在');
      if(o.op==='add'&&(typeof o.title!=='string'||!o.title.trim())) throw new Error('任务标题为空');
      if(o.title!==undefined&&typeof o.title!=='string') throw new Error('标题格式不正确');
      if(o.note!==undefined&&typeof o.note!=='string') throw new Error('备注格式不正确');
      if(o.due!==undefined) Data.date(o.due); if(o.tags!==undefined) Data.tags(o.tags);
      return Object.fromEntries(['op','id','title','due','tags','note'].filter(k=>Object.hasOwn(o,k)).map(k=>[k,o[k]]));
    });
    renderAiOps(); aiStatus('生成 '+aiPendingOps.length+' 条操作，请核对后点「应用」',true);
  } catch(e) { aiPendingOps=[]; renderAiOps(); aiStatus('调用或解析失败：'+(e.name==='AbortError'?'请求超时，请重试':e.message),false); }
  finally { $('#btnAiSend').disabled=false; }
}
function renderAiOps() {
  const name = (id) => { const t = state.tasks.find((x) => x.id === id); return t ? t.title : "(找不到该 id)"; };
  $("#aiOps").innerHTML = aiPendingOps.map((o) => {
    if (o.op === "add") return `<div class="ai-op">＋ 新增：${escapeHtml(o.title || "")}${o.due ? `（到期 ${escapeHtml(o.due)}）` : ""}</div>`;
    if (o.op === "update") return '<div class="ai-op">✎ 修改「'+escapeHtml(name(o.id))+'」：'+escapeHtml(JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k])=>!['op','id'].includes(k)))))+'</div>';
    if (o.op === "done") return `<div class="ai-op">✓ 完成：${escapeHtml(name(o.id))}</div>`;
    return `<div class="ai-op">🗑 删除：${escapeHtml(name(o.id))}</div>`;
  }).join("") || `<div class="ai-op">（无有效操作）</div>`;
  $("#btnAiApply").disabled = !aiPendingOps.length;
}

async function aiApply() {
  if(!caps().ai) return upgradeNeeded('AI 助手为 Pro 功能。');
  $('#btnAiApply').disabled=true;
  const r=await rpc('AI_APPLY',{ops:aiPendingOps,listId:state.activeList==='all'?'inbox':state.activeList});
  if(r) { aiPendingOps=[]; renderAiOps(); toast('已应用 AI 操作'); }
  else $('#btnAiApply').disabled=!aiPendingOps.length;
}

// ---------- Badge ----------
function updateBadge() {}

// ---------- 渲染 ----------
function render() {
  // plan badge
  const pb = $("#planBadge");
  pb.textContent = isPro() ? "PRO" : "FREE";
  pb.className = "plan " + (isPro() ? "plan-pro" : "plan-free");
  $("#btnBuy").href = CONFIG.STRIPE_PAYMENT_LINK;

  // list tabs
  const tabs = $("#listTabs");
  const counts = {};
  state.tasks.forEach((t) => { if (!t.done) counts[t.listId] = (counts[t.listId] || 0) + 1; });
  let html = `<button class="tab ${state.activeList === "all" ? "on" : ""}" data-list="all">全部 ${activeTasks().length}</button>`;
  state.lists.forEach((l) => {
    html += `<button class="tab ${state.activeList === l.id ? "on" : ""}" data-list="${l.id}">
      <i style="background:${l.color}"></i>${escapeHtml(l.name)} ${counts[l.id] || 0}</button>`;
  });
  tabs.innerHTML = html;

  // tasks
  const list = $("#taskList");
  let tasks = state.tasks.filter((t) => state.activeList === "all" ? true : t.listId === state.activeList);
  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const ordered = [...active, ...done];
  if (!ordered.length) {
    list.innerHTML = `<div class="empty">还没有任务。<br>点上方「收集当前页面」，把正在看的网页变成待办。</div>`;
  } else {
    list.innerHTML = ordered.map(taskRow).join("");
  }

  // counter + caps
  const c = caps();
  const capText = c.maxActiveTasks === Infinity ? "" : ` / ${c.maxActiveTasks}`;
  $("#counter").textContent = `${active.length} 待办${capText}`;
  $("#btnExport").classList.toggle("locked", !c.export);
  $("#btnImport").classList.toggle("locked", !c.export);

  renderAdminLists();
}

function taskRow(t) {
  const overdue = t.due && !t.done && t.due < new Date().toLocaleDateString('sv-SE');
  const tags = (t.tags || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("");
  const excerpt = t.excerpt ? `<p class="excerpt">${escapeHtml(t.excerpt)}</p>` : "";
  const note = t.note ? `<p class="excerpt note">${escapeHtml(t.note)}</p>` : "";
  const subs = (t.subtasks || []).map((s) => `
    <label class="sub"><input type="checkbox" ${s.done ? "checked" : ""} data-act="toggle-sub" data-id="${t.id}" data-sub="${s.id}">
      <span class="${s.done ? "sdone" : ""}">${escapeHtml(s.title)}</span>
      <span class="del" data-act="del-sub" data-id="${t.id}" data-sub="${s.id}" title="删除子任务">✕</span></label>`).join("");
  const subBox = `<div class="subs">${subs}
    <input class="sub-input" data-id="${t.id}" placeholder="＋ 子任务，回车保存" /></div>`;
  const link = t.url ? `<a class="tlink" href="${escapeAttr(t.url)}" target="_blank" rel="noopener" title="打开原网页">↗</a>` : "";
  const dueInput = `<input type="date" class="due ${overdue ? "overdue" : ""}" data-id="${t.id}" value="${t.due || ""}" title="到期日">`;
  const tagInput = caps().tags ? `<input class="tag-input" data-id="${t.id}" placeholder="+标签" />` : "";
  return `<div class="task ${t.done ? "done" : ""}" data-id="${t.id}">
    <label class="chk"><input type="checkbox" ${t.done ? "checked" : ""} data-act="toggle" data-id="${t.id}"></label>
    <div class="body">
      <div class="ttl" data-act="edit-title" data-id="${t.id}" title="点击编辑">${escapeHtml(t.title)}</div>
      ${excerpt}${note}${subBox}
      <div class="meta">${link}${dueInput}${tags}${tagInput}
        <span class="del" data-act="edit-note" data-id="${t.id}" title="编辑备注">✎</span>
        <span class="del" data-act="del" data-id="${t.id}" title="删除">🗑</span>
      </div>
    </div>
  </div>`;
}

function renderAdminLists() {
  const box = $("#adminLists");
  box.innerHTML = state.lists.map((l) => `
    <div class="admin-list">
      <span class="dot" style="background:${l.color}"></span>
      <span class="nm">${escapeHtml(l.name)}</span>
      <span class="rm" data-del-list="${l.id}">删除</span>
    </div>`).join("");
}

// ---------- 事件绑定 ----------
function bind() {
  $("#btnCapture").addEventListener("click", captureCurrentPage);
  $("#quickAdd").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const input=e.target; const value=input.value; addQuickTask(value).then(r=>{if(r&&input.value===value) input.value='';}); }
  });

  $("#listTabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b) { state.activeList = b.dataset.list; render(); }
  });

  $("#taskList").addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const id = el.dataset.id;
    const act = el.dataset.act;
    if (act === "del") deleteTask(id);
    if (act === "toggle-sub" || act === "del-sub") {
      await rpc(act === 'toggle-sub' ? 'SUB_TOGGLE' : 'SUB_DELETE', { id, subId: el.dataset.sub });
      return;
    }
    if (act === "edit-note") {
      const t = state.tasks.find((x) => x.id === id);
      const nn = prompt("编辑备注", t.note || "");
      if (nn !== null) updateTask(id, { note: nn.trim().slice(0, 500) });
    }
    if (act === "edit-title") {
      const t = state.tasks.find((x) => x.id === id);
      const nt = prompt("编辑任务标题", t.title);
      if (nt && nt.trim()) updateTask(id, { title: nt.trim().slice(0, 140) });
    }
  });

  $("#taskList").addEventListener("change", (e) => {
    const id = e.target.dataset.id;
    if (e.target.dataset.act === "toggle") toggleTask(id);
    else if (e.target.type === "date") updateTask(id, { due: e.target.value });
  });

  $("#taskList").addEventListener("keydown", (e) => {
    if (e.target.classList.contains("sub-input") && e.key === "Enter") {
      const id = e.target.dataset.id;
      const v = e.target.value.trim();
      if (!v) return;
      const t = state.tasks.find((x) => x.id === id);
      rpc('SUB_ADD', { id, title: v });
      return;
    }
    if (e.target.classList.contains("tag-input") && e.key === "Enter") {
      const id = e.target.dataset.id;
      const v = e.target.value.trim();
      if (!v) return;
      const t = state.tasks.find((x) => x.id === id);
      if (!caps().tags) return upgradeNeeded("标签为 Pro 功能。");
      rpc('TAG_ADD', { id, tag: v });
    }
  });

  $("#btnExport").addEventListener("click", exportData);
  $("#btnIcs").addEventListener("click", exportIcs);
  $("#btnAiSave").addEventListener("click", aiSaveKey);
  $("#btnAiSend").addEventListener("click", aiSend);
  $("#btnAiApply").addEventListener("click", aiApply);
  $("#btnImport").addEventListener("click", () => {
    if (!caps().export) return upgradeNeeded("导出/导入为 Pro 功能。");
    $("#fileImport").click();
  });
  $("#fileImport").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) importData(f);
    e.target.value = "";
  });
  $("#btnClearDone").addEventListener("click", () => {
    rpc('CLEAR_DONE');
  });

  // drawer
  $("#btnUpgrade").addEventListener("click", () => {
    $("#drawer").classList.remove("hidden");
    chrome.storage.local.get(["aiKey", "aiModel"]).then((d) => {
      $("#aiKey").value = d.aiKey || "";
      $("#aiModel").value = d.aiModel || "gpt-4o-mini";
    }).catch(() => {});
  });
  $("#btnCloseDrawer").addEventListener("click", () => $("#drawer").classList.add("hidden"));
  $("#btnActivate").addEventListener("click", () => {
    const key = $("#licenseInput").value.trim();
    if (!key) return licStatus("请输入 Key", false);
    checkLicense(key);
  });
  $("#btnDeactivate").addEventListener("click", deactivate);
  $("#btnAddList").addEventListener("click", () => {
    const n = prompt("新列表名称");
    if (n) addList(n);
  });
  $("#adminLists").addEventListener("click", (e) => {
    const id = e.target.dataset.delList;
    if (id) deleteList(id);
  });


  chrome.runtime.onMessage.addListener(msg => {
    if(msg?.type==='TT_FEEDBACK' && (msg.windowId == null || msg.windowId === panelWindowId)) toast(msg.message);
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&(changes.tasks||changes.lists||changes.licenseKey||changes.pendingCaptures)) load().then(render).catch(()=>toast('读取失败，请重试'));
  });
}

// ---------- 工具 ----------
function upgradeNeeded(msg) {
  toast(msg || "该功能需要 Pro");
  $("#drawer").classList.remove("hidden");
}
let toastTimer;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ---------- 启动 ----------
(async function init() {
  bind();
  if(!globalThis.__previewMode) { panelWindowId=(await chrome.windows.getCurrent()).id; await load(); }

  // 预览/调试模式：sidepanel.html?demo=free|pro|paywall （不影响正常使用）
  const demo = globalThis.__previewMode && (location.search.match(/demo=(\w+)/) || [])[1];
  if (demo) {
    state.lists = [
      { id: "inbox", name: "收集箱", color: "#6d5efc" },
      { id: "today", name: "今天看", color: "#f59e0b" },
      { id: "reading", name: "稍后阅读", color: "#10b981" },
    ];
    state.tasks = [
      { id: uid(), title: "Q3 竞品分析：参考 Notion 侧边栏交互", url: "https://example.com/competitor", excerpt: "他们在 2025 年引入了标签分组与快捷捕获，用户留存提升明显，值得对照我们的收集流程做一次体验审计。", note: "重点对照侧边栏捕获流程", listId: "today", tags: ["竞品", "重要"], due: new Date(Date.now() + 864e5).toISOString().slice(0, 10), done: false, createdAt: Date.now(), completedAt: null, source: "capture", subtasks: [{ id: uid(), title: "截图他们的捕获流程", done: false }, { id: uid(), title: "写对照结论", done: true }] },
      { id: uid(), title: "写扩展上架的商店文案（关键词：sidebar to-do）", url: "https://chrome.google.com/webstore/devconsole", excerpt: "", note: "", listId: "inbox", tags: ["上架"], due: "", done: false, createdAt: Date.now(), completedAt: null, source: "capture" },
      { id: uid(), title: "读完《Refactoring UI》第 4 章", url: "https://refactoringui.com", excerpt: "", note: "", listId: "reading", tags: [], due: "", done: false, createdAt: Date.now(), completedAt: null, source: "quick" },
      { id: uid(), title: "回复 Support 邮件：激活失败问题", url: "", excerpt: "", note: "", listId: "inbox", tags: [], due: "", done: true, createdAt: Date.now() - 864e5, completedAt: Date.now(), source: "quick" },
    ];
    if (demo === "pro" || demo === "paywall") {
      state.plan = "pro"; state.license = { key: "(demo)", plan: "pro" };
    }
    if (demo === "paywall") {
      state.plan = "free"; state.license = null;
      state.tasks.forEach((t) => { t.excerpt = ""; t.tags = []; });
    }
    render();
    if (demo === "paywall") {
      $("#drawer").classList.remove("hidden");
      licStatus("升级解锁：无限任务 · 标签 · 摘要 · 导出", false);
    }
    return;
  }
  render();
  if(state.pendingCount) toast('有暂存选区等待收集，请先腾出任务空间');
})().catch(e=>toast(e.message || '启动失败，请重试'));
