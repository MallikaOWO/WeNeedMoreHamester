// 1.2 建造 / 升级

import type { GameState, Facility } from '../schema';
import { getFacilityDef, getUpgradeCost } from '../data/facilities';

let facilityCounter = 0;
function nextFacilityId(type: string): string {
  return `${type}_${++facilityCounter}`;
}

/** 检查是否可以建造指定类型的设施 */
export function canBuild(state: GameState, facilityType: string): { ok: boolean; reason?: string } {
  const def = getFacilityDef(facilityType);
  if (!def) return { ok: false, reason: '未知设施类型' };

  // 资源检查
  if (state.energy < def.cost.energy) return { ok: false, reason: '能源不足' };
  if (state.stardust < def.cost.stardust) return { ok: false, reason: '星尘不足' };

  // 天使等级检查
  if (def.manageDomain !== 'any') {
    const angel = Object.values(state.angels).find(a => a.manageDomain === def.manageDomain);
    if (!angel || angel.level < def.requiredAngelLevel) {
      return { ok: false, reason: `需要${def.manageDomain}方向天使达到Lv.${def.requiredAngelLevel}` };
    }
  }

  return { ok: true };
}

/** 建造设施 */
export function buildFacility(state: GameState, facilityType: string): GameState {
  const check = canBuild(state, facilityType);
  if (!check.ok) return state;

  const def = getFacilityDef(facilityType)!;
  const id = nextFacilityId(facilityType);

  // 按领域自动分配管理天使（一个天使管理其领域的所有设施）
  let managedBy: string | null = null;
  if (def.manageDomain !== 'any') {
    for (const [aId, a] of Object.entries(state.angels)) {
      if (a.manageDomain === def.manageDomain) {
        managedBy = aId;
        break;
      }
    }
  }
  // manageDomain === 'any' 的功能设施无需专人管理，自动运作

  const newFacility: Facility = {
    type: facilityType,
    level: 1,
    capacity: def.capacity,
    occupants: {},
    managedBy,
    requiredAngelLevel: def.requiredAngelLevel,
  };

  const facilities = { ...state.facilities, [id]: newFacility };

  return {
    ...state,
    energy: state.energy - def.cost.energy,
    energyCap: state.energyCap + (def.energyCapBonus ?? 0),
    stardust: state.stardust - def.cost.stardust,
    facilities,
  };
}

/** 检查是否可以升级设施 */
export function canUpgrade(state: GameState, facilityId: string): { ok: boolean; reason?: string } {
  const facility = state.facilities[facilityId];
  if (!facility) return { ok: false, reason: '设施不存在' };
  if (facility.level >= 3) return { ok: false, reason: '已达最高等级' };

  const def = getFacilityDef(facility.type);
  if (!def) return { ok: false, reason: '未知设施类型' };

  const cost = getUpgradeCost(def, facility.level);
  if (state.energy < cost.energy) return { ok: false, reason: '能源不足' };
  if (state.stardust < cost.stardust) return { ok: false, reason: '星尘不足' };

  // 天使等级检查：领域天使等级 >= 设施目标等级
  const nextLevel = facility.level + 1;
  if (def.manageDomain !== 'any') {
    const domainAngel = Object.values(state.angels).find(a => a.manageDomain === def.manageDomain);
    if (!domainAngel) {
      return { ok: false, reason: '没有对应领域的天使' };
    }
    if (domainAngel.level < nextLevel) {
      return { ok: false, reason: `需要${domainAngel.name}达到Lv.${nextLevel}` };
    }
  }

  return { ok: true };
}

/** 升级设施 */
export function upgradeFacility(state: GameState, facilityId: string): GameState {
  const check = canUpgrade(state, facilityId);
  if (!check.ok) return state;

  const facility = state.facilities[facilityId];
  const def = getFacilityDef(facility.type)!;
  const cost = getUpgradeCost(def, facility.level);

  return {
    ...state,
    energy: state.energy - cost.energy,
    stardust: state.stardust - cost.stardust,
    facilities: {
      ...state.facilities,
      [facilityId]: {
        ...facility,
        level: facility.level + 1,
        // 升级容量：每级 +1（有容量的设施）
        capacity: def.capacity > 0 ? def.capacity + facility.level : 0,
      },
    },
  };
}

/** 查找管理某设施的领域天使 */
export function getDomainAngel(state: GameState, facilityType: string): { id: string; angel: GameState['angels'][string] } | null {
  const def = getFacilityDef(facilityType);
  if (!def || def.manageDomain === 'any') return null;
  for (const [aId, a] of Object.entries(state.angels)) {
    if (a.manageDomain === def.manageDomain) return { id: aId, angel: a };
  }
  return null;
}

/** 修复旧存档：确保所有设施的 managedBy 与领域天使匹配 */
export function fixupFacilityManagers(state: GameState): GameState {
  let changed = false;
  const facilities = { ...state.facilities };
  for (const [fId, f] of Object.entries(facilities)) {
    const def = getFacilityDef(f.type);
    if (!def) continue;
    if (def.manageDomain === 'any') {
      // 'any' 设施无需管理者
      if (f.managedBy) {
        facilities[fId] = { ...f, managedBy: null };
        changed = true;
      }
    } else {
      // 领域设施：确保 managedBy 指向正确的领域天使
      const domainAngel = getDomainAngel(state, f.type);
      const correctManager = domainAngel?.id ?? null;
      if (f.managedBy !== correctManager) {
        facilities[fId] = { ...f, managedBy: correctManager };
        changed = true;
      }
    }
  }
  return changed ? { ...state, facilities } : state;
}
