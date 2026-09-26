// ============================================================
//  background.js  —  service worker (MV3)
// ============================================================

// 点击工具栏图标即打开侧边栏
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn("sidePanel behavior:", e));
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
