// 4.1 隐藏楼层脚本
// 同层前端卡：隐藏历史楼层，只显示最后一层

/** 隐藏除最新楼层外的所有楼层 */
async function hideOldMessages() {
  const lastId = getLastMessageId();
  if (lastId < 1) return;

  // 将 0 ~ lastId-1 全部隐藏，最后一层保持可见
  const updates = _.range(lastId).map(id => ({ message_id: id, is_hidden: true }));
  // 确保最新楼层可见
  updates.push({ message_id: lastId, is_hidden: false });
  await setChatMessages(updates, { refresh: 'none' });
}

// 初始加载时隐藏旧楼层
$(() => {
  hideOldMessages();
});

// 新消息到达时隐藏旧楼层
eventOn(tavern_events.MESSAGE_RECEIVED, () => {
  hideOldMessages();
});

// 切换聊天时重新隐藏
eventOn(tavern_events.CHAT_CHANGED, () => {
  hideOldMessages();
});
