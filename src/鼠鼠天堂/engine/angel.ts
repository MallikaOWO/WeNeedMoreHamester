// 1.3 天使系统

import type { GameState } from '../schema';
import { getSkillDef } from '../data/skills';

/** 天使升级所需星尘（按等级递增） */
const LEVEL_UP_COST: Record<number, number> = {
  1: 15,   // Lv.1 → Lv.2
  2: 40,   // Lv.2 → Lv.3
  3: 80,   // Lv.3 → Lv.4
  4: 150,  // Lv.4 → Lv.5
};

/** 检查天使是否可以升级 */
export function canLevelUp(state: GameState, angelId: string): { ok: boolean; reason?: string } {
  const angel = state.angels[angelId];
  if (!angel) return { ok: false, reason: '天使不存在' };
  if (angel.level >= 5) return { ok: false, reason: '已达最高等级' };

  const cost = LEVEL_UP_COST[angel.level];
  if (state.stardust < cost) return { ok: false, reason: `星尘不足（需要${cost}）` };

  // 设施等级前提检查
  const nextLevel = angel.level + 1;
  const managedFacilities = Object.values(state.facilities).filter(f => f.managedBy === angelId);

  if (nextLevel === 2) {
    if (managedFacilities.length === 0) {
      return { ok: false, reason: '需要至少管理一个设施' };
    }
  } else if (nextLevel === 3) {
    if (!managedFacilities.some(f => f.level >= 2)) {
      return { ok: false, reason: '需要管理的设施中有至少1个Lv.2' };
    }
  } else if (nextLevel === 4) {
    if (managedFacilities.filter(f => f.level >= 3).length < 2) {
      return { ok: false, reason: '需要管理至少2个Lv.3设施' };
    }
  } else if (nextLevel === 5) {
    const allFacilities = Object.values(state.facilities);
    if (allFacilities.length === 0 || !allFacilities.every(f => f.level >= 3)) {
      return { ok: false, reason: '需要全部设施达到Lv.3' };
    }
  }

  return { ok: true };
}

/** 升级天使 */
export function levelUpAngel(state: GameState, angelId: string): GameState {
  const check = canLevelUp(state, angelId);
  if (!check.ok) return state;

  const angel = state.angels[angelId];
  const cost = LEVEL_UP_COST[angel.level];

  return {
    ...state,
    stardust: state.stardust - cost,
    angels: {
      ...state.angels,
      [angelId]: { ...angel, level: angel.level + 1 },
    },
  };
}

/** 使用天使技能 */
export function useSkill(
  state: GameState,
  angelId: string,
  skillId: string,
  targetId?: string,
): { state: GameState; success: boolean; reason?: string } {
  const angel = state.angels[angelId];
  if (!angel) return { state, success: false, reason: '天使不存在' };

  const skillState = angel.skills[skillId];
  if (!skillState) return { state, success: false, reason: '技能不存在' };
  if (angel.level < skillState.unlockedAtAngelLevel) {
    return { state, success: false, reason: `需要天使达到Lv.${skillState.unlockedAtAngelLevel}` };
  }
  if (skillState.cooldownLeft > 0) {
    return { state, success: false, reason: `冷却中（${skillState.cooldownLeft}回合）` };
  }

  const def = getSkillDef(skillId);
  if (!def) return { state, success: false, reason: '技能定义不存在' };

  let hamsters = { ...state.hamsters };
  let energy = state.energy;
  let stardust = state.stardust;
  const buffs = { ...state.buffs };

  // 应用技能效果
  switch (def.effectType) {
    case 'heal_mood': {
      // 治愈一只鼠鼠心情至满
      if (targetId && hamsters[targetId]) {
        hamsters = { ...hamsters, [targetId]: { ...hamsters[targetId], mood: 100 } };
      }
      break;
    }
    case 'aoe_mood': {
      // 全体心情 + effectValue
      hamsters = Object.fromEntries(
        Object.entries(hamsters).map(([id, h]) => [
          id,
          { ...h, mood: Math.min(100, h.mood + def.effectValue) },
        ])
      );
      break;
    }
    case 'boost_production': {
      // 能源过载：目标设施下回合产能翻倍 → 用 buff 实现
      if (targetId && state.facilities[targetId]) {
        buffs[`skill_${skillId}_${state.turn}`] = {
          type: 'production_boost',
          target: targetId,
          value: 100, // +100% = 翻倍
          duration: 1,
          description: `${angel.name}的能源过载 — 设施产能翻倍`,
        };
      }
      break;
    }
    case 'boost_stardust': {
      // 星尘感应：本回合星尘收入 +50% → 加 buff
      buffs[`skill_${skillId}_${state.turn}`] = {
        type: 'stardust_bonus',
        target: 'global',
        value: Math.max(1, Math.round(stardust * 0.5)), // 至少+1
        duration: 1,
        description: `${angel.name}的星尘感应 — 星尘收入增加`,
      };
      break;
    }
    case 'convert_resource': {
      // 消耗能源转化为星尘
      const convertAmount = Math.min(energy, 50);
      const gained = Math.floor(convertAmount / def.effectValue);
      energy -= convertAmount;
      stardust += gained;
      break;
    }
    case 'repair_facility': {
      // 紧急维修：移除目标设施的 facility_down buff，或临时增产
      if (targetId && state.facilities[targetId]) {
        let repaired = false;
        for (const [bId, b] of Object.entries(buffs)) {
          if (b.type === 'facility_down' && b.target === targetId) {
            delete buffs[bId];
            repaired = true;
          }
        }
        if (!repaired) {
          buffs[`skill_${skillId}_${state.turn}`] = {
            type: 'production_boost',
            target: targetId,
            value: 50,
            duration: 1,
            description: `${angel.name}的精密调校 — 设施增产50%`,
          };
        }
      }
      break;
    }
    case 'preview_event': {
      // 幸运加护：下回合事件必含一个高收益正面选项（通过 EJS 指示 AI）
      // duration=2：经过 settleTurn 递减后仍保留 duration=1，供 EJS 模板读取
      buffs[`skill_${skillId}_${state.turn}`] = {
        type: 'lucky_guard',
        target: 'global',
        value: 1,
        duration: 2,
        description: '泡芙的四叶草微微发光："好事要来了哦~"',
      };
      break;
    }
    case 'force_event_type': {
      // 好运连连：下回合强制至少一个 opportunity 事件
      // duration=2：同上，需存活到 EJS 模板读取
      buffs[`skill_${skillId}_${state.turn}`] = {
        type: 'force_opportunity',
        target: 'global',
        value: 1,
        duration: 2,
        description: '泡芙的四叶草发光了 — 下回合必出机遇事件',
      };
      break;
    }
  }

  // 设置冷却
  const angels = {
    ...state.angels,
    [angelId]: {
      ...angel,
      skills: {
        ...angel.skills,
        [skillId]: { ...skillState, cooldownLeft: def.cooldown },
      },
    },
  };

  return {
    state: { ...state, energy, stardust, hamsters, angels, buffs },
    success: true,
  };
}

/** 每回合冷却 -1 */
export function tickCooldowns(state: GameState): GameState {
  const angels = Object.fromEntries(
    Object.entries(state.angels).map(([aId, a]) => [
      aId,
      {
        ...a,
        skills: Object.fromEntries(
          Object.entries(a.skills).map(([sId, s]) => [
            sId,
            { ...s, cooldownLeft: Math.max(0, s.cooldownLeft - 1) },
          ])
        ),
      },
    ])
  );

  return { ...state, angels };
}
