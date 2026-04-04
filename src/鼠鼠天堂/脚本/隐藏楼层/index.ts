// 4.1 隐藏楼层脚本
// 同层前端卡：DOM 级别移除历史楼层，只保留最后一层
// 注意：用 DOM 移除而非 is_hidden，因为 is_hidden 会对 AI 也隐藏消息

$(() => {
  // 移除除最后一层外的所有楼层 DOM
  $('#chat > .mes').not('.last_mes').remove();

  // 切换聊天时重载 iframe
  let current_chat_id = SillyTavern.getCurrentChatId();
  eventOn(tavern_events.CHAT_CHANGED, (chat_id: string) => {
    if (current_chat_id !== chat_id) {
      current_chat_id = chat_id;
      reloadIframe();
    }
  });
});
