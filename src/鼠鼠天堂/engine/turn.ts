// 1.1 回合结算

import type { GameState, Facility, Hamster } from '../schema';
import { getFacilityDef } from '../data/facilities';
import { getPersonalityDef } from '../data/personalities';

/** 计算单个设施本回合产能 */
function calcFacilityOutput(facility: Facility, hamsters: Record<string, Hamster>, happiness: number): number {
  const def = getFacilityDef(facility.type);
  if (!def || def.basePower <= 0) return 0;

  // 等级加成：每级 +30%
  const levelMult = 1 + (facility.level - 1) * 0.3;

  // 遍历设施中的鼠鼠，计算每只的产出
  let total = 0;
  const occupantIds = Object.keys(facility.occupants);
  for (const hId of occupantIds) {
    const h = hamsters[hId];
    if (!h) continue;

    let power = h.basePower;
    // 偏好加成：鼠鼠性格匹配设施偏好性格 → +50%
    if (def.preferredPersonality) {
      const personalities = h.personality.split(',').map(p => p.trim());
      if (personalities.some(p => {
        const pDef = getPersonalityDef(p);
        return pDef?.preferredFacilityType === facility.type;
      })) {
        power *= 1.5;
      }
    }
    total += power;
  }

  // 设施基础产能 × 等级倍率
  total += def.basePower * occupantIds.length * levelMult;

  // 心情乘数：happiness 70 = ×1.0，100 = ×1.3，0 = ×0.3
  const moodMult = 0.3 + (happiness / 100) * 0.7 + Math.max(0, happiness - 70) / 100 * 0.3;
  total *= moodMult;

  return Math.round(total);
}

/** 体力消耗常量 */
const STAMINA_COST_PER_TURN = 15;
const STAMINA_RESTORE_BASE = 20;
const LOW_STAMINA_THRESHOLD = 20;

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

  // ── 1. 设施产能计算 ──
  let totalProduction = 0;
  for (const f of Object.values(facilities)) {
    if (!f.managedBy) continue; // 无天使管理则不运作
    totalProduction += calcFacilityOutput(f, hamsters, state.happiness);
  }
  energy = Math.min(energy + totalProduction, state.energyCap);

  // ── 2. 体力消耗 & 低体力鼠鼠自动回窝 ──
  for (const [hId, h] of Object.entries(hamsters)) {
    if (h.assignedTo) {
      h.stamina = Math.max(0, h.stamina - STAMINA_COST_PER_TURN);
      if (h.stamina <= LOW_STAMINA_THRESHOLD) {
        // 从设施中移除
        const f = facilities[h.assignedTo];
        if (f) {
          delete f.occupants[hId];
        }
        h.assignedTo = null;
      }
    }
  }

  // ── 3. 休息中鼠鼠恢复体力 ──
  const hasCanteen = Object.values(facilities).some(f => f.type === 'canteen' && f.managedBy);
  const restoreAmount = hasCanteen
    ? Math.round(STAMINA_RESTORE_BASE * 1.5)
    : STAMINA_RESTORE_BASE;

  for (const h of Object.values(hamsters)) {
    if (!h.assignedTo) {
      h.stamina = Math.min(100, h.stamina + restoreAmount);
    }
  }

  // ── 4. 生活设施回复心情 ──
  for (const f of Object.values(facilities)) {
    if (!f.managedBy) continue;
    const def = getFacilityDef(f.type);
    if (!def || def.moodRegen <= 0) continue;
    const levelMult = 1 + (f.level - 1) * 0.3;
    const regen = Math.round(def.moodRegen * levelMult);
    for (const hId of Object.keys(f.occupants)) {
      const h = hamsters[hId];
      if (h) h.mood = Math.min(100, h.mood + regen);
    }
  }

  // ── 5. 星尘祭坛被动产出 ──
  let stardust = state.stardust;
  for (const f of Object.values(facilities)) {
    if (f.type === 'stardust_altar' && f.managedBy) {
      const levelMult = 1 + (f.level - 1) * 0.3;
      stardust += Math.round(2 * levelMult); // 基础 2 星尘/回合
    }
  }

  // ── 6. 更新全局心情值（所有鼠鼠平均） ──
  const hamsterValues = Object.values(hamsters);
  const happiness = hamsterValues.length > 0
    ? Math.round(hamsterValues.reduce((sum, h) => sum + h.mood, 0) / hamsterValues.length)
    : state.happiness;

  return {
    ...state,
    energy,
    stardust,
    happiness,
    turn: state.turn + 1,
    hamsters,
    facilities,
  };
}
