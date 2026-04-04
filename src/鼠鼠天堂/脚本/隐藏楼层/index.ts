// 4.1 隐藏楼层脚本
// 同层前端卡：DOM 级别移除历史楼层，只保留第零层（游戏界面）
// 注意：用 DOM 移除而非 is_hidden，因为 is_hidden 会对 AI 也隐藏消息

$(() => {
  // 移除除第零层（游戏界面）外的所有楼层 DOM
  // 用 :first 选择器而非 mesid，因为 SillyTavern 对首条消息的 mesid 可能为空
  $('#chat > .mes:gt(0)').remove();

  // 监听 DOM 变化，移除后续新增的楼层（AI 生成时会动态添加）
  // 只保留第一个 .mes（游戏界面）
  const chatEl = document.getElementById('chat');
  if (chatEl) {
    const observer = new MutationObserver(() => {
      const messages = chatEl.querySelectorAll(':scope > .mes');
      for (let i = 1; i < messages.length; i++) {
        messages[i].remove();
      }
    });
    observer.observe(chatEl, { childList: true });
  }

  // 切换聊天时重载 iframe
  let current_chat_id = SillyTavern.getCurrentChatId();
  eventOn(tavern_events.CHAT_CHANGED, (chat_id: string) => {
    if (current_chat_id !== chat_id) {
      current_chat_id = chat_id;
      reloadIframe();
    }
  });
});
