/* ============================================================
   sidepanel.js  —  TabTasks 核心逻辑（纯本地，chrome.storage）
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

let state = {
  lists: [],
  tasks: [],
  activeList: "all",
  plan: "free",           // 'free' | 'pro'
  license: null,          // {key, plan, exp, label}
};

const DEFAULT_LISTS = [
  { id: "inbox", name: "收集箱", color: "#6d5efc" },
  { id: "today", name: "今天看", color: "#f59e0b" },
];

// ---------- 存取 ----------
async function load() {
  const data = await chrome.storage.local.get(["lists", "tasks", "licenseKey"]);
  state.lists = data.lists && data.lists.length ? data.lists : DEFAULT_LISTS.slice();
  state.tasks = data.tasks || [];
  if (data.licenseKey) await checkLicense(data.licenseKey, { persist: false });
}

async function persist() {
  await chrome.storage.local.set({
    lists: state.lists,
    tasks: state.tasks,
  });
  updateBadge();
}

// ---------- 门控 ----------
const caps = () => (state.plan === "pro" ? CONFIG.PRO : CONFIG.FREE);
const isPro = () => state.plan === "pro";
function activeTasks() {
  return state.tasks.filter((t) => !t.done);
}

// ---------- License ----------
async function checkLicense(key, { persist = true } = {}) {
  const res = await Lic.verify(key, CONFIG.SECRET);
  if (res.ok) {
    state.plan = "pro";
    state.license = { key, plan: res.plan, exp: res.exp, label: res.label };
    if (persist) await chrome.storage.local.set({ licenseKey: key });
    licStatus("已激活 Pro" + (res.exp ? `，有效至 ${new Date(res.exp * 1000).toLocaleDateString()}` : ""), true);
  } else {
    state.plan = "free";
    state.license = null;
    if (persist) await chrome.storage.local.remove("licenseKey");
    const msg = { bad_signature: "Key 无效", expired: "Key 已过期", malformed: "Key 格式不对", empty: "请输入 Key" }[res.reason] || "Key 无效";
    licStatus(msg, false);
  }
  render();
}

async function deactivate() {
  state.plan = "free";
  state.license = null;
  await chrome.storage.local.remove("licenseKey");
  licStatus("已解除，回到免费版", false);
  render();
}

function licStatus(text, ok) {
  const el = $("#licStatus");
  el.textContent = text;
  el.className = "lic-status " + (ok ? "ok" : "err");
}

// ---------- 捕获当前页 ----------
async function captureCurrentPage() {
  const c = caps();
  const max = c.maxActiveTasks;
  if (max !== Infinity && activeTasks().length >= max) {
    return upgradeNeeded(`免费版最多 ${max} 个活动任务，删除一些或升级 Pro 继续收集。`);
  }
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
    return toast("当前页面无法收集（需 http/https 网页）");
  }
  let payload = { title: tab.title || tab.url, url: tab.url, excerpt: "" };
  try {
    const exec = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [isPro() && c.excerpt],
      func: (wantExcerpt) => {
        const meta = document.querySelector('meta[name="description"]');
        const sel = (window.getSelection().toString() || "").trim();
        let ex = meta ? meta.content : "";
        if (!ex) { const p = document.querySelector("article p, main p, p"); if (p) ex = p.innerText; }
        return {
          title: document.title,
          url: location.href,
          excerpt: (sel || ex || "").replace(/\s+/g, " ").trim().slice(0, wantExcerpt ? 320 : 0),
        };
      },
    });
    if (exec && exec[0] && exec[0].result) payload = exec[0].result;
  } catch (e) {
    /* 受限页面（chrome:// 等）退回用 tab 信息 */
  }

  const task = {
    id: uid(),
    title: (payload.title || "未命名").slice(0, 140),
    url: payload.url,
    excerpt: isPro() && c.excerpt ? payload.excerpt : "",
    note: "",
    listId: state.activeList !== "all" ? state.activeList : "inbox",
    tags: [],
    due: "",
    done: false,
    createdAt: Date.now(),
    completedAt: null,
    source: "capture",
  };
  state.tasks.unshift(task);
  await persist();
  render();
  toast("已收集到「" + listName(task.listId) + "」");
}

function addQuickTask(title) {
  title = (title || "").trim();
  if (!title) return;
  const c = caps();
  if (c.maxActiveTasks !== Infinity && activeTasks().length >= c.maxActiveTasks) {
    return upgradeNeeded(`免费版最多 ${c.maxActiveTasks} 个活动任务。`);
  }
  state.tasks.unshift({
    id: uid(), title: title.slice(0, 140), url: "", excerpt: "", note: "",
    listId: state.activeList !== "all" ? state.activeList : "inbox",
    tags: [], due: "", done: false, createdAt: Date.now(), completedAt: null, source: "quick",
  });
  persist();
  render();
}

// ---------- 任务操作 ----------
function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.completedAt = t.done ? Date.now() : null;
  persist(); render();
}
function deleteTask(id) {
  state.tasks = state.tasks.filter((x) => x.id !== id);
  persist(); render();
}
function updateTask(id, patch) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  persist(); render();
}
function moveTask(id, listId) {
  updateTask(id, { listId });
}

// ---------- 列表 ----------
function listName(id) {
  const l = state.lists.find((x) => x.id === id);
  return l ? l.name : "收集箱";
}
function addList(name) {
  const c = caps();
  if (c.maxLists !== Infinity && state.lists.length >= c.maxLists) {
    return upgradeNeeded(`免费版最多 ${c.maxLists} 个列表，升级 Pro 创建无限列表。`);
  }
  name = (name || "").trim();
  if (!name) return;
  const colors = ["#10b981", "#ef4444", "#3b82f6", "#a855f7", "#f97316"];
  state.lists.push({ id: uid(), name, color: colors[state.lists.length % colors.length] });
  persist(); render();
}
function deleteList(id) {
  if (id === "inbox") return toast("收集箱不可删除");
  state.lists = state.lists.filter((l) => l.id !== id);
  state.tasks.forEach((t) => { if (t.listId === id) t.listId = "inbox"; });
  if (state.activeList === id) state.activeList = "all";
  persist(); render();
}

// ---------- 导出/导入 ----------
function exportData() {
  if (!caps().export) return upgradeNeeded("导出/导入为 Pro 功能。");
  const blob = JSON.stringify({ lists: state.lists, tasks: state.tasks }, null, 2);
  const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = `tabtasks-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Badge ----------
function updateBadge() {
  chrome.runtime.sendMessage({ type: "SET_BADGE", count: activeTasks().length }).catch(() => {});
}

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

  renderAdminLists();
}

function taskRow(t) {
  const overdue = t.due && !t.done && new Date(t.due) < new Date(new Date().toDateString());
  const tags = (t.tags || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("");
  const excerpt = t.excerpt ? `<p class="excerpt">${escapeHtml(t.excerpt)}</p>` : "";
  const link = t.url ? `<a class="tlink" href="${escapeAttr(t.url)}" target="_blank" rel="noopener" title="打开原网页">↗</a>` : "";
  const dueInput = `<input type="date" class="due ${overdue ? "overdue" : ""}" data-id="${t.id}" value="${t.due || ""}" title="到期日">`;
  const tagInput = caps().tags ? `<input class="tag-input" data-id="${t.id}" placeholder="+标签" />` : "";
  return `<div class="task ${t.done ? "done" : ""}" data-id="${t.id}">
    <label class="chk"><input type="checkbox" ${t.done ? "checked" : ""} data-act="toggle" data-id="${t.id}"></label>
    <div class="body">
      <div class="ttl" data-act="edit-title" data-id="${t.id}" title="点击编辑">${escapeHtml(t.title)}</div>
      ${excerpt}
      <div class="meta">${link}${dueInput}${tags}${tagInput}
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
    if (e.key === "Enter") { addQuickTask(e.target.value); e.target.value = ""; }
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
    if (e.target.classList.contains("tag-input") && e.key === "Enter") {
      const id = e.target.dataset.id;
      const v = e.target.value.trim();
      if (!v) return;
      const t = state.tasks.find((x) => x.id === id);
      if (!caps().tags) return upgradeNeeded("标签为 Pro 功能。");
      t.tags = Array.from(new Set([...(t.tags || []), v]));
      e.target.value = "";
      persist(); render();
    }
  });

  $("#btnExport").addEventListener("click", exportData);
  $("#btnClearDone").addEventListener("click", () => {
    state.tasks = state.tasks.filter((t) => !t.done); persist(); render();
  });

  // drawer
  $("#btnUpgrade").addEventListener("click", () => $("#drawer").classList.remove("hidden"));
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

  // 来自快捷键的消息
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "CAPTURE_TAB") captureCurrentPage();
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
function escapeAttr(s) { return encodeURI(String(s)); }

// ---------- 启动 ----------
(async function init() {
  bind();
  await load();

  // 预览/调试模式：sidepanel.html?demo=free|pro|paywall （不影响正常使用）
  const demo = (location.search.match(/demo=(\w+)/) || [])[1];
  if (demo) {
    state.lists = [
      { id: "inbox", name: "收集箱", color: "#6d5efc" },
      { id: "today", name: "今天看", color: "#f59e0b" },
      { id: "reading", name: "稍后阅读", color: "#10b981" },
    ];
    state.tasks = [
      { id: uid(), title: "Q3 竞品分析：参考 Notion 侧边栏交互", url: "https://example.com/competitor", excerpt: "他们在 2025 年引入了标签分组与快捷捕获，用户留存提升明显，值得对照我们的收集流程做一次体验审计。", note: "", listId: "today", tags: ["竞品", "重要"], due: new Date(Date.now() + 864e5).toISOString().slice(0, 10), done: false, createdAt: Date.now(), completedAt: null, source: "capture" },
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
})();
