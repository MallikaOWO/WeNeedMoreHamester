// 2.3 记忆按需注入 / 提示词组装

import type { GameState } from '../schema';
import { getStateForPrompt } from './state';
import { getMemoryForPrompt } from '../engine/memory';
import type { EventType } from '../engine/event';

/**
 * 组装本回合提示词
 * 包含：资源状态 + 角色简表 + 事件指令 + 按需记忆
 */
export function buildTurnPrompt(
  state: GameState,
  eventSlots: EventType[],
  involvedCharacterIds: string[] = [],
): string {
  const parts: string[] = [];

  // ── 必定部分：当前状态摘要 ──
  parts.push(getStateForPrompt(state));

  // ── 事件生成指令 ──
  parts.push('');
  parts.push(`【本回合事件指令】`);
  parts.push(`请生成 ${eventSlots.length} 个事件，类型分别为：${eventSlots.join('、')}`);
  parts.push('每个事件需要：');
  parts.push('1. 叙事描述（结合乐园当前状态和角色性格）');
  parts.push('2. 2-3个选项，每个标注 energy/stardust/mood 变化量');
  parts.push('3. 至少一个稳妥选项，可选一个恶搞选项（扣除量不超过当前资源的10%）');

  if (state.energy > 0) {
    parts.push(`⚠️ 负面选项能源扣除不超过 ${Math.round(state.energy * 0.1)}`);
  }
  if (state.stardust > 0) {
    parts.push(`⚠️ 负面选项星尘扣除不超过 ${Math.round(state.stardust * 0.1)}`);
  }

  // 事件类型提示
  const typeHints: Record<EventType, string> = {
    daily: '日常：轻松小事，资源波动 ±5~15',
    opportunity: '机遇：需要决策，资源波动 ±10~30',
    challenge: '挑战：有小幅负面风险，恶搞选项让失败也有趣',
    special: '特殊：里程碑事件，大幅资源变动，可推进天使剧情',
  };
  for (const slot of eventSlots) {
    parts.push(`  - ${typeHints[slot]}`);
  }

  // ── 按需部分：涉及角色的个体记忆 ──
  if (involvedCharacterIds.length > 0) {
    const memoryText = getMemoryForPrompt(state, involvedCharacterIds);
    if (memoryText) {
      parts.push('');
      parts.push('【关联角色记忆（请参考以保持叙事连续性）】');
      parts.push(memoryText);
    }
  }

  return parts.join('\n');
}

/**
 * 组装个体互动提示词
 * 用于玩家选择"与某角色互动"时
 */
export function buildInteractionPrompt(
  state: GameState,
  characterId: string,
): string {
  const parts: string[] = [];

  // 基础状态（简化版）
  parts.push(`【当前资源】⚡${state.energy}/${state.energyCap} ✨${state.stardust} 💛${state.happiness} 回合${state.turn}`);

  // 查找角色
  const hamster = state.hamsters.find(h => h.id === characterId);
  const angel = state.angels.find(a => a.id === characterId);

  if (hamster) {
    parts.push('');
    parts.push(`【互动对象：鼠居民 ${hamster.name}】`);
    parts.push(`品种：${hamster.breed} | 性格：${hamster.personality.join('、')}`);
    parts.push(`心情：${hamster.mood} | 体力：${hamster.stamina}`);
    parts.push(`背景：${hamster.story}`);
  } else if (angel) {
    parts.push('');
    parts.push(`【互动对象：鼠天使 ${angel.name}】`);
    parts.push(`等级：Lv.${angel.level} | 管理方向：${angel.manageDomain}`);
    const activeSkills = angel.skills.filter(s => angel.level >= s.unlockedAtAngelLevel);
    if (activeSkills.length > 0) {
      parts.push(`技能：${activeSkills.map(s => s.skillId).join('、')}`);
    }
  }

  // 角色记忆
  const memoryText = getMemoryForPrompt(state, [characterId]);
  if (memoryText) {
    parts.push('');
    parts.push(memoryText);
  }

  parts.push('');
  parts.push('请以该角色的视角生成一段互动场景，体现其性格特征。互动结果可产生小幅心情变化。');

  return parts.join('\n');
}
