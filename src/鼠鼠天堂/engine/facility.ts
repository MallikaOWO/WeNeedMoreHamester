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

  // 自动分配对应方向的天使（如果空闲）
  let managedBy: string | null = null;
  if (def.manageDomain !== 'any') {
    for (const [aId, a] of Object.entries(state.angels)) {
      if (a.manageDomain === def.manageDomain && !a.assignedFacility) {
        managedBy = aId;
        break;
      }
    }
  }

  const newFacility: Facility = {
    type: facilityType,
    level: 1,
    capacity: def.capacity,
    occupants: {},
    managedBy,
    requiredAngelLevel: def.requiredAngelLevel,
  };

  const facilities = { ...state.facilities, [id]: newFacility };

  const angels = managedBy
    ? Object.fromEntries(
        Object.entries(state.angels).map(([aId, a]) =>
          aId === managedBy ? [aId, { ...a, assignedFacility: id }] : [aId, a]
        )
      )
    : state.angels;

  return {
    ...state,
    energy: state.energy - def.cost.energy,
    stardust: state.stardust - def.cost.stardust,
    facilities,
    angels,
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

  // 管理天使等级检查：升级后的设施等级不能超过管理天使的等级
  const nextLevel = facility.level + 1;
  if (facility.managedBy) {
    const angel = state.angels[facility.managedBy];
    if (angel && angel.level < nextLevel) {
      return { ok: false, reason: `需要管理天使达到Lv.${nextLevel}` };
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

/** 分配天使管理设施 */
export function assignAngelToFacility(state: GameState, angelId: string, facilityId: string): GameState {
  const angel = state.angels[angelId];
  const facility = state.facilities[facilityId];
  if (!angel || !facility) return state;

  const def = getFacilityDef(facility.type);
  if (!def) return state;

  // 检查管理方向匹配
  if (def.manageDomain !== 'any' && angel.manageDomain !== def.manageDomain) return state;
  // 检查天使等级
  if (angel.level < facility.requiredAngelLevel) return state;

  // 先解除天使原先管理的设施，再分配新设施
  const facilities = { ...state.facilities };
  for (const [fId, f] of Object.entries(facilities)) {
    if (fId === facilityId) {
      facilities[fId] = { ...f, managedBy: angelId };
    } else if (f.managedBy === angelId) {
      facilities[fId] = { ...f, managedBy: null };
    }
  }

  const angels = {
    ...state.angels,
    [angelId]: { ...angel, assignedFacility: facilityId },
  };

  return { ...state, facilities, angels };
}
