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
  const data = await chrome.storage.local.get(["lists", "tasks", "licenseKey", "pendingCaptures"]);
  state.lists = data.lists && data.lists.length ? data.lists : DEFAULT_LISTS.slice();
  state.tasks = data.tasks || [];
  // 右键选区捕获的待收队列（background 写入）
  if (Array.isArray(data.pendingCaptures) && data.pendingCaptures.length) {
    data.pendingCaptures.forEach((p) => state.tasks.unshift({
      id: uid(), title: p.title || "未命名", url: p.url || "", excerpt: p.excerpt || "",
      note: "", listId: "inbox", tags: [], due: "", done: false,
      createdAt: p.at || Date.now(), completedAt: null, source: "menu",
    }));
    await chrome.storage.local.remove("pendingCaptures");
    await persist();
    toast(`已收集 ${data.pendingCaptures.length} 条选区内容`);
  }
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

async function importData(file) {
  if (!caps().export) return upgradeNeeded("导出/导入为 Pro 功能。");
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.lists)) throw 0;
    const haveL = new Set(state.lists.map((l) => l.id));
    const haveT = new Set(state.tasks.map((t) => t.id));
    const newLists = data.lists.filter((l) => l && l.id && !haveL.has(l.id));
    const newTasks = data.tasks.filter((t) => t && t.id && !haveT.has(t.id));
    state.lists = [...state.lists, ...newLists];
    state.tasks = [...newTasks, ...state.tasks];
    await persist();
    render();
    toast(`已导入 ${newTasks.length} 个任务、${newLists.length} 个列表`);
  } catch {
    toast("文件不是 TabTasks 备份（需本扩展导出的 JSON）");
  }
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
      `DESCRIPTION:${icsEsc((t.url ? t.url + "\\n" : "") + (t.note || ""))}`,
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
  await chrome.storage.local.set({ aiKey: k, aiModel: $("#aiModel").value.trim() || "gpt-4o-mini" });
  aiStatus(k ? "Key 已保存（仅本机）" : "Key 已清除", !!k);
}
async function aiSend() {
  if (!caps().ai) return upgradeNeeded("AI 助手为 Pro 功能。");
  const instr = $("#aiChat").value.trim();
  if (!instr) return;
  if (!chrome.permissions) return aiStatus("预览模式不可用 AI", false);
  const d = await chrome.storage.local.get(["aiKey", "aiModel"]);
  if (!d.aiKey) return aiStatus("请先保存你的 OpenAI Key", false);
  const have = await chrome.permissions.contains(AI_ORIGIN);
  if (!have) {
    const ok = await chrome.permissions.request(AI_ORIGIN);
    if (!ok) return aiStatus("未授予联网权限，无法直连 OpenAI", false);
  }
  aiStatus("思考中…", true);
  const snapshot = state.tasks.map((t) => ({ id: t.id, title: t.title, due: t.due, done: t.done, tags: t.tags || [] }));
  const sys = "你是 TabTasks 里的任务助手。用户用自然语言下指令，你只返回 JSON 数组（不要 markdown、不要解释）。可用操作：" +
    '[{"op":"add","title":"...","due":"YYYY-MM-DD 或空字符串","tags":[],"note":""},' +
    '{"op":"update","id":"任务id","title":"新标题"},{"op":"done","id":"任务id"},{"op":"del","id":"任务id"}]。' +
    "只操作用户明确提到的任务；id 必须来自当前任务列表，不得编造。当前任务列表：" + JSON.stringify(snapshot);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + d.aiKey },
      body: JSON.stringify({
        model: d.aiModel || "gpt-4o-mini",
        temperature: 0,
        messages: [{ role: "system", content: sys }, { role: "user", content: instr }],
      }),
    });
    if (!res.ok) return aiStatus("OpenAI 返回 " + res.status + "（检查 Key / 余额 / 模型名）", false);
    const j = await res.json();
    const raw = ((j.choices || [])[0] || {}).message?.content || "";
    const ops = JSON.parse(raw.replace(/```json?/gi, "").replace(/```/g, "").trim());
    if (!Array.isArray(ops) || !ops.length) return aiStatus("模型没有返回可执行操作", false);
    aiPendingOps = ops.filter((o) => o && ["add", "update", "done", "del"].includes(o.op));
    renderAiOps();
    aiStatus(`生成 ${aiPendingOps.length} 条操作，请核对后点「应用」`, true);
  } catch (e) {
    aiStatus("调用或解析失败：" + (e && e.message ? e.message : e), false);
  }
}
function renderAiOps() {
  const name = (id) => { const t = state.tasks.find((x) => x.id === id); return t ? t.title : "(找不到该 id)"; };
  $("#aiOps").innerHTML = aiPendingOps.map((o) => {
    if (o.op === "add") return `<div class="ai-op">＋ 新增：${escapeHtml(o.title || "")}${o.due ? `（到期 ${escapeHtml(o.due)}）` : ""}</div>`;
    if (o.op === "update") return `<div class="ai-op">✎ 改「${escapeHtml(name(o.id))}」→「${escapeHtml(o.title || "")}」</div>`;
    if (o.op === "done") return `<div class="ai-op">✓ 完成：${escapeHtml(name(o.id))}</div>`;
    return `<div class="ai-op">🗑 删除：${escapeHtml(name(o.id))}</div>`;
  }).join("") || `<div class="ai-op">（无有效操作）</div>`;
  $("#btnAiApply").disabled = !aiPendingOps.length;
}
function aiApply() {
  aiPendingOps.forEach((o) => {
    if (o.op === "add") {
      state.tasks.unshift({
        id: uid(), title: String(o.title || "未命名").slice(0, 140), url: "", excerpt: "",
        note: String(o.note || "").slice(0, 500),
        listId: state.activeList !== "all" ? state.activeList : "inbox",
        tags: Array.isArray(o.tags) ? o.tags.slice(0, 8).map(String) : [],
        due: /^\d{4}-\d{2}-\d{2}$/.test(o.due || "") ? o.due : "",
        done: false, createdAt: Date.now(), completedAt: null, source: "ai",
      });
      return;
    }
    const t = state.tasks.find((x) => x.id === o.id);
    if (!t) return;
    if (o.op === "update") t.title = String(o.title || t.title).slice(0, 140);
    if (o.op === "done") { t.done = true; t.completedAt = Date.now(); }
    if (o.op === "del") state.tasks = state.tasks.filter((x) => x.id !== o.id);
  });
  aiPendingOps = [];
  renderAiOps();
  persist(); render();
  toast("已应用 AI 操作");
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
  $("#btnImport").classList.toggle("locked", !c.export);

  renderAdminLists();
}

function taskRow(t) {
  const overdue = t.due && !t.done && new Date(t.due) < new Date(new Date().toDateString());
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
    if (act === "toggle-sub" || act === "del-sub") {
      const t = state.tasks.find((x) => x.id === id);
      const s = (t.subtasks || []).find((y) => y.id === el.dataset.sub);
      if (!s) return;
      if (act === "toggle-sub") s.done = !s.done;
      else t.subtasks = t.subtasks.filter((y) => y.id !== s.id);
      persist(); render();
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
      t.subtasks = [...(t.subtasks || []), { id: uid(), title: v.slice(0, 140), done: false }];
      e.target.value = "";
      persist(); render();
      return;
    }
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
    state.tasks = state.tasks.filter((t) => !t.done); persist(); render();
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
})();
