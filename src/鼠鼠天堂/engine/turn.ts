// 1.1 回合结算

import type { GameState, Facility, Hamster } from '../schema';
import { getFacilityDef } from '../data/facilities';
import { getPersonalityDef } from '../data/personalities';

/**
 * 心情乘数：happiness 70 ≈ 1.0x（基准），100 = 1.2x，0 = 0.5x
 * 公式：0.5 + happiness/100 × 0.7
 */
export function calcMoodMultiplier(happiness: number): number {
  return 0.5 + (happiness / 100) * 0.7;
}

/**
 * 天使管理加成：等级越高，管理效率越高
 */
export function calcAngelMult(angelLevel: number): number {
  return 1 + (angelLevel - 1) * 0.1;
}

/**
 * 计算单个工作设施本回合产能
 * 每只工人产出 = (设施basePower + 鼠鼠basePower) × 等级倍率 × 天使加成 × 偏好加成
 * 总产出 = 各工人产出之和 × 心情乘数
 */
function calcFacilityOutput(facility: Facility, hamsters: Record<string, Hamster>, happiness: number, angelLevel: number, angelDomain?: string): number {
  const def = getFacilityDef(facility.type);
  if (!def || def.basePower <= 0) return 0;

  const levelMult = 1 + (facility.level - 1) * 0.3;
  const angelMult = calcAngelMult(angelLevel);
  const occupantIds = Object.keys(facility.occupants);

  // 螺丝被动：管理的 play 设施产能 +15%
  const luosiBonus = angelDomain === 'power' ? 1.15 : 1;
  // 泡芙被动：偏好匹配加成从 50% → 75%
  const preferBonus = angelDomain === 'social' ? 1.75 : 1.5;

  let total = 0;
  for (const hId of occupantIds) {
    const h = hamsters[hId];
    if (!h) continue;

    let power = def.basePower + h.basePower;

    // 偏好加成
    if (def.preferredPersonality) {
      const personalities = h.personality.split(',').map(p => p.trim());
      if (personalities.some(p => {
        const pDef = getPersonalityDef(p);
        return pDef?.preferredFacilityType === facility.type;
      })) {
        power *= preferBonus;
      }
    }

    total += power * levelMult * angelMult * luosiBonus;
  }

  total *= calcMoodMultiplier(happiness);
  return Math.round(total);
}

/** 体力消耗常量 */
const STAMINA_COST_PER_TURN = 20;
const STAMINA_RESTORE_BASE = 15;
const LOW_STAMINA_THRESHOLD = 25;
/** 工作心情消耗 */
const MOOD_COST_PER_TURN = 8;

/** 结算一个回合 */
export function settleTurn(state: GameState): GameState {
  let energy = state.energy;
  const hamsters: Record<string, Hamster> = {};
  for (const [id, h] of Object.entries(state.hamsters)) {
    hamsters[id] = { ...h };
  }
  const facilities: Record<string, Facility> = {};
  for (const [id, f] of Object.entries(state.facilities)) {
    facilities[id] = { ...f, occupants: { ...f.occupants } };
  }

  // ── 0. 应用即时 Buff 效果（不递减 duration，统一在末尾清理） ──
  const buffs = { ...state.buffs };
  for (const [buffId, buff] of Object.entries(buffs)) {
    if (buff.duration <= 0) { delete buffs[buffId]; continue; }
    switch (buff.type) {
      case 'mood_regen': {
        if (buff.target === 'global') {
          for (const h of Object.values(hamsters)) h.mood = Math.min(100, h.mood + buff.value);
        } else if (hamsters[buff.target]) {
          hamsters[buff.target].mood = Math.min(100, hamsters[buff.target].mood + buff.value);
        }
        break;
      }
      case 'mood_drain': {
        if (buff.target && hamsters[buff.target]) {
          hamsters[buff.target].mood = Math.max(0, hamsters[buff.target].mood - buff.value);
        }
        break;
      }
      // production_boost / facility_down / stardust_bonus / stamina_save
      // 在各自阶段处理，此处不动
    }
  }

  // ── 1. 工作设施产能计算（仅 play 类设施的 occupants 产出） ──
  let totalProduction = 0;
  for (const [fId, f] of Object.entries(facilities)) {
    if (!f.managedBy) continue; // 无天使管理则不运作
    const def = getFacilityDef(f.type);
    if (def?.category !== 'play') continue; // 只有 play 设施产能
    const angel = f.managedBy ? state.angels[f.managedBy] : null;
    let output = calcFacilityOutput(f, hamsters, state.happiness, angel?.level ?? 1, angel?.manageDomain);
    // 应用 buff：production_boost / facility_down
    for (const buff of Object.values(buffs)) {
      if (buff.target === fId) {
        if (buff.type === 'production_boost') output = Math.round(output * (1 + buff.value / 100));
        if (buff.type === 'facility_down') output = Math.round(output * 0.5);
      }
    }
    totalProduction += output;
  }
  energy = Math.min(energy + totalProduction, state.energyCap);

  // ── 1.5 设施维护费 ──
  let totalMaintenance = 0;
  for (const f of Object.values(facilities)) {
    const def = getFacilityDef(f.type);
    if (def) totalMaintenance += def.maintenanceCost;
  }
  energy = Math.max(0, energy - totalMaintenance);

  // ── 2. 工作中鼠鼠消耗体力和心情，低体力自动停工回窝 ──
  for (const [hId, h] of Object.entries(hamsters)) {
    if (h.workingAt) {
      // 螺丝被动：管理的 play 设施鼠鼠体力消耗 +3
      const workFacility = facilities[h.workingAt];
      const workAngel = workFacility?.managedBy ? state.angels[workFacility.managedBy] : null;
      const extraCost = workAngel?.manageDomain === 'power' ? 3 : 0;
      h.stamina = Math.max(0, h.stamina - STAMINA_COST_PER_TURN - extraCost);
      // 工作消耗心情（棉花被动：管理的设施中工作的鼠鼠心情消耗减半）
      const livingFacility = h.livingAt ? facilities[h.livingAt] : null;
      const livingAngel = livingFacility?.managedBy ? state.angels[livingFacility.managedBy] : null;
      const moodReduction = livingAngel?.manageDomain === 'life' ? Math.round(MOOD_COST_PER_TURN * 0.5) : MOOD_COST_PER_TURN;
      h.mood = Math.max(0, h.mood - moodReduction);
      if (h.stamina <= LOW_STAMINA_THRESHOLD) {
        // 从工作设施移除（但仍留在 livingAt 的居住设施）
        const f = facilities[h.workingAt];
        if (f) {
          delete f.occupants[hId];
        }
        h.workingAt = null;
      }
    }
  }

  // ── 3. 休息中鼠鼠恢复体力（没有在工作的鼠鼠） ──
  const hasCanteen = Object.values(facilities).some(f => f.type === 'canteen' && f.managedBy);
  const restoreAmount = hasCanteen
    ? Math.round(STAMINA_RESTORE_BASE * 1.5)
    : STAMINA_RESTORE_BASE;

  for (const h of Object.values(hamsters)) {
    if (!h.workingAt) {
      h.stamina = Math.min(100, h.stamina + restoreAmount);
    }
  }

  // ── 4. 生活设施回复心情（给住在里面且不在工作的鼠鼠） ──
  for (const [fId, f] of Object.entries(facilities)) {
    if (!f.managedBy) continue;
    const def = getFacilityDef(f.type);
    if (!def || def.category !== 'living' || def.moodRegen <= 0) continue;
    const levelMult = 1 + (f.level - 1) * 0.3;
    // 棉花被动：管理的 living 设施心情恢复 +30%
    const mianhuaBonus = (state.angels[f.managedBy]?.manageDomain === 'life') ? 1.3 : 1;
    const regen = Math.round(def.moodRegen * levelMult * mianhuaBonus);
    // 找出住在此设施且不在工作的鼠鼠
    for (const h of Object.values(hamsters)) {
      if (h.livingAt === fId && !h.workingAt) {
        h.mood = Math.min(100, h.mood + regen);
      }
    }
  }

  // ── 4.5 交谊厅全体心情加成 ──
  for (const f of Object.values(facilities)) {
    if (f.type === 'lounge' && f.managedBy) {
      const levelMult = 1 + (f.level - 1) * 0.3;
      const moodBonus = Math.round(2 * levelMult);
      for (const h of Object.values(hamsters)) {
        h.mood = Math.min(100, h.mood + moodBonus);
      }
    }
  }

  // ── 5. 星尘祭坛被动产出 + 星星被动 + stardust_bonus buff ──
  let stardust = state.stardust;
  for (const f of Object.values(facilities)) {
    if (f.type === 'stardust_altar' && f.managedBy) {
      const levelMult = 1 + (f.level - 1) * 0.3;
      stardust += Math.round(2 * levelMult); // 基础 2 星尘/回合
    }
    // 星星被动：管理的任何设施每3回合额外产出 1 星尘
    if (f.managedBy && state.angels[f.managedBy]?.manageDomain === 'stardust') {
      if ((state.turn + 1) % 3 === 0) stardust += 1;
    }
  }
  // stardust_bonus buff
  for (const buff of Object.values(buffs)) {
    if (buff.type === 'stardust_bonus') stardust += buff.value;
  }

  // ── 6. 事件链标记过期（超过3回合未触发则移除） ──
  const eventFlags = { ...state.event_flags };
  const currentTurn = state.turn + 1;
  for (const [flag, setTurn] of Object.entries(eventFlags)) {
    if (currentTurn - setTurn > 3) delete eventFlags[flag];
  }

  // ── 7. 更新全局心情值（所有鼠鼠平均） ──
  const hamsterValues = Object.values(hamsters);
  const happiness = hamsterValues.length > 0
    ? Math.round(hamsterValues.reduce((sum, h) => sum + h.mood, 0) / hamsterValues.length)
    : state.happiness;

  // ── 8. Buff duration 递减与清理（所有阶段结束后统一处理） ──
  for (const [buffId, buff] of Object.entries(buffs)) {
    buffs[buffId] = { ...buff, duration: buff.duration - 1 };
    if (buffs[buffId].duration <= 0) delete buffs[buffId];
  }

  return {
    ...state,
    energy,
    stardust,
    happiness,
    turn: currentTurn,
    hamsters,
    facilities,
    buffs,
    event_flags: eventFlags,
  };
}
