// 1.7 叙事自动总结

/** 从消息列表中提取叙事片段 */
export function extractNarratives(
  messages: Array<{ role: string; message: string }>,
): Array<{ turn: number; text: string }> {
  const results: Array<{ turn: number; text: string }> = [];
  const narrativeRe = /<Narrative>([\s\S]*?)<\/Narrative>/i;
  const turnRe = /\[推进到回合\s*(\d+)\]/;
  const interactRe = /\[与.+?互动\]/;

  // 遍历消息，将 user 消息作为上下文来确定回合号
  let lastTurn = 0;
  let lastIsInteraction = false;

  for (const msg of messages) {
    if (msg.role === 'user') {
      const turnMatch = msg.message.match(turnRe);
      if (turnMatch) {
        lastTurn = parseInt(turnMatch[1], 10);
        lastIsInteraction = false;
      } else if (interactRe.test(msg.message)) {
        lastIsInteraction = true;
      }
    } else if (msg.role === 'assistant') {
      const narMatch = msg.message.match(narrativeRe);
      if (narMatch) {
        results.push({
          turn: lastIsInteraction ? -1 : lastTurn, // -1 表示互动
          text: narMatch[1].trim(),
        });
      }
    }
  }

  return results;
}

/** 组装总结提示词 */
export function buildSummarizationPrompt(
  prevSummary: string,
  lastSummaryTurn: number,
  currentTurn: number,
  narratives: Array<{ turn: number; text: string }>,
): string {
  const parts: string[] = [];

  parts.push('你是"鼠鼠天堂"的叙事摘要引擎。请将以下叙事片段整合为一份简洁的前情提要。');
  parts.push('');
  parts.push('规则：');
  parts.push('- 保留：重大事件（收养、建造、升级、特殊事件）、玩家的选择及其后果、角色之间的关系变化');
  parts.push('- 省略：日常琐碎细节、纯数值变动描述、已记录到角色记忆中的内容');
  parts.push('- 格式：按时间段落组织，用「回合X-Y」标注时间范围');
  parts.push('- 长度：不超过800字');
  parts.push('- 输出用 <Summary> 标签包裹，标签外不要输出其他内容');
  parts.push('- 所有内容使用中文');

  if (prevSummary) {
    parts.push('');
    parts.push(`【上次摘要（回合1-${lastSummaryTurn}）】`);
    parts.push(prevSummary);
  }

  parts.push('');
  const startTurn = lastSummaryTurn + 1;
  parts.push(`【新叙事片段（回合${startTurn}-${currentTurn}）】`);

  for (const n of narratives) {
    const label = n.turn === -1 ? '互动' : `回合${n.turn}`;
    parts.push(`${label}: ${n.text}`);
  }

  parts.push('');
  parts.push('请输出整合后的完整摘要：');

  return parts.join('\n');
}

/** 从 AI 响应中提取 Summary 标签内容 */
export function parseSummaryResponse(aiText: string): string | null {
  const match = aiText.match(/<Summary>([\s\S]*?)<\/Summary>/i);
  return match ? match[1].trim() : null;
}
