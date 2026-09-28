// ============================================================
//  background.js  —  service worker (MV3)
// ============================================================

// 点击工具栏图标即打开侧边栏
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn("sidePanel behavior:", e));
  // 右键选区 → 收集为任务（仅选区上下文出现）
  chrome.contextMenus.create({
    id: "capture-selection",
    title: "收集选区为 TabTasks 任务",
    contexts: ["selection"],
  });
});

// 右键捕获：侧边栏可能没开 → 先入待收队列，再尝试拉起侧边栏消费
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "capture-selection" || !info.selectionText) return;
  const text = String(info.selectionText).replace(/\s+/g, " ").trim();
  if (!text) return;
  const d = await chrome.storage.local.get("pendingCaptures");
  const q = Array.isArray(d.pendingCaptures) ? d.pendingCaptures : [];
  q.push({
    title: text.slice(0, 140),
    url: (tab && tab.url) || "",
    excerpt: text.slice(0, 320),
    at: Date.now(),
  });
  await chrome.storage.local.set({ pendingCaptures: q });
  try {
    if (tab && tab.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    /* 无用户手势等场景忽略，队列仍在 */
  }
});

// 键盘快捷键：把当前页捕获为任务（Alt+Shift+T）
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-page") return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await chrome.runtime.sendMessage({ type: "CAPTURE_TAB", tabId: tab.id });
  } catch (e) {
    /* 侧边栏未打开时忽略 */
  }
});

// 更新工具栏角标显示未完成数量
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "SET_BADGE") {
    chrome.action.setBadgeText({ text: msg.count > 0 ? String(msg.count) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#6d5efc" });
  }
});
