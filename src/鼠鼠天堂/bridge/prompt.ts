// 2.3 记忆按需注入 / 提示词组装

import type { GameState } from '../schema';
import { getStateForPrompt } from './state';
import { getMemoryForPrompt } from '../engine/memory';
import { getFacilityDef } from '../data/facilities';
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
  parts.push('2. 2-3个选项，每个标注 energy_delta/stardust_delta/mood_delta 变化量');
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
 * 组装互动专用系统提示词
 * 用于 generate() 的 injects 参数，替代全量世界书
 */
export function buildInteractionSystemPrompt(
  state: GameState,
  characterId: string,
  angelPersonaText?: string | null,
): string {
  const parts: string[] = [];

  // 模式声明
  parts.push('你正在进行一次角色互动对话（非回合推进）。');
  parts.push('以该角色的视角和语气，与园长进行一段生动的对话互动。');

  // 简化状态
  parts.push('');
  parts.push(`【当前状态】回合${state.turn} ⚡${state.energy}/${state.energyCap} ✨${state.stardust} 💛${state.happiness}`);

  // 目标角色
  const angel = state.angels[characterId];
  const hamster = state.hamsters[characterId];

  if (angel) {
    parts.push('');
    parts.push(`【互动对象：鼠天使 ${angel.name}】`);
    if (angelPersonaText) {
      parts.push(angelPersonaText);
    } else {
      parts.push(`等级：Lv.${angel.level} | 管理方向：${angel.manageDomain}`);
    }
    const managed = Object.entries(state.facilities)
      .filter(([, f]) => f.managedBy === characterId)
      .map(([, f]) => getFacilityDef(f.type)?.name ?? f.type);
    if (managed.length > 0) {
      parts.push(`管理设施：${managed.join('、')}`);
    }
  } else if (hamster) {
    parts.push('');
    parts.push(`【互动对象：鼠居民 ${hamster.name}】`);
    parts.push(`品种：${hamster.breed} | 性格：${hamster.personality}`);
    parts.push(`心情：${hamster.mood} | 体力：${hamster.stamina}`);
    parts.push(`背景：${hamster.story}`);
    if (hamster.livingAt) {
      const fac = state.facilities[hamster.livingAt];
      parts.push(`住在：${getFacilityDef(fac?.type)?.name ?? '未知'}`);
    }
  }

  // 周围角色
  if (angel) {
    const hamsterList = Object.entries(state.hamsters);
    if (hamsterList.length > 0) {
      parts.push('');
      parts.push('【乐园里的鼠居民】');
      for (const [, h] of hamsterList) {
        parts.push(`  ${h.name}(${h.breed}) 性格:${h.personality} 心情:${h.mood}`);
      }
    }
  } else if (hamster) {
    const relevantAngels = new Set<string>();
    if (hamster.livingAt) {
      const mgr = state.facilities[hamster.livingAt]?.managedBy;
      if (mgr) relevantAngels.add(mgr);
    }
    if (hamster.workingAt) {
      const mgr = state.facilities[hamster.workingAt]?.managedBy;
      if (mgr) relevantAngels.add(mgr);
    }
    if (relevantAngels.size > 0) {
      parts.push('');
      parts.push('【附近的天使】');
      for (const aId of relevantAngels) {
        const a = state.angels[aId];
        if (a) parts.push(`  ${a.name}（${a.manageDomain}方向）`);
      }
    }
  }

  // 角色记忆
  const memoryText = getMemoryForPrompt(state, [characterId]);
  if (memoryText) {
    parts.push('');
    parts.push(memoryText);
  }

  // 输出规则
  parts.push('');
  parts.push('【输出规则】');
  parts.push('1. 输出 <Narrative> 标签，包含互动场景描写（2-6句，体现角色性格和语气）');
  parts.push('2. 可选输出 <UpdateVariable>，但仅允许更新记忆字段：');
  parts.push('   - 天使记忆：/angels/{ID}/memory/{key}');
  parts.push('   - 鼠鼠记忆：/hamsters/{ID}/memory/{key}');
  parts.push('3. 禁止：生成事件（pending_events）、修改资源、修改非记忆字段');
  parts.push('4. 记忆key格式：t{回合}_{关键词}，value为一句话描述互动要点');

  return parts.join('\n');
}
