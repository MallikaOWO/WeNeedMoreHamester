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

  // 栏位上限检查
  if (Object.keys(state.facilities).length >= MAX_FACILITY_SLOTS) {
    return { ok: false, reason: `设施栏位已满（上限${MAX_FACILITY_SLOTS}个），请先拆除旧设施` };
  }

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

/** 设施栏位上限 */
export const MAX_FACILITY_SLOTS = 8;

/** 检查是否可以拆除设施 */
export function canDemolish(state: GameState, facilityId: string): { ok: boolean; reason?: string } {
  const facility = state.facilities[facilityId];
  if (!facility) return { ok: false, reason: '设施不存在' };

  const def = getFacilityDef(facility.type);
  if (!def) return { ok: false, reason: '未知设施类型' };

  // 生活设施拆除前检查：住户能否全部安置到其他生活设施
  if (def.category === 'living') {
    const residents = Object.values(state.hamsters).filter(h => h.livingAt === facilityId);
    if (residents.length > 0) {
      // 计算其他生活设施的总剩余容量
      let freeSlots = 0;
      for (const [fId, f] of Object.entries(state.facilities)) {
        if (fId === facilityId) continue;
        const fDef = getFacilityDef(f.type);
        if (fDef?.category !== 'living') continue;
        const count = Object.values(state.hamsters).filter(h => h.livingAt === fId).length;
        freeSlots += f.capacity - count;
      }
      if (freeSlots < residents.length) {
        return { ok: false, reason: `住户无处安置（需${residents.length}个空位，仅剩${freeSlots}个）` };
      }
    }
  }

  return { ok: true };
}

/** 拆除设施（返还 50% 建造费用） */
export function demolishFacility(state: GameState, facilityId: string): GameState {
  const check = canDemolish(state, facilityId);
  if (!check.ok) return state;

  const facility = state.facilities[facilityId];
  const def = getFacilityDef(facility.type)!;

  // 返还 50% 建造费用
  const refundEnergy = Math.floor(def.cost.energy * 0.5);
  const refundStardust = Math.floor(def.cost.stardust * 0.5);

  // 处理关联的鼠鼠
  const hamsters = { ...state.hamsters };
  for (const [hId, h] of Object.entries(hamsters)) {
    let changed = false;
    const updates: Partial<typeof h> = {};

    // play 设施拆除：工人停工（不影响 livingAt）
    if (h.workingAt === facilityId) {
      updates.workingAt = null;
      changed = true;
    }

    // living 设施拆除：住户搬迁到其他有空位的生活设施
    if (h.livingAt === facilityId) {
      let newLiving: string | null = null;
      for (const [fId, f] of Object.entries(state.facilities)) {
        if (fId === facilityId) continue;
        const fDef = getFacilityDef(f.type);
        if (fDef?.category !== 'living') continue;
        const count = Object.values(hamsters).filter(hh => hh.livingAt === fId).length;
        if (count < f.capacity) { newLiving = fId; break; }
      }
      updates.livingAt = newLiving;
      // 搬家后也停止工作（住所变动，需要适应）
      if (h.workingAt) updates.workingAt = null;
      changed = true;
    }

    if (changed) hamsters[hId] = { ...h, ...updates };
  }

  // 移除设施
  const { [facilityId]: _, ...remainingFacilities } = state.facilities;

  // 扣除能源上限加成
  const capLoss = def.energyCapBonus ?? 0;

  return {
    ...state,
    energy: Math.min(state.energy + refundEnergy, state.energyCap - capLoss),
    energyCap: state.energyCap - capLoss,
    stardust: state.stardust + refundStardust,
    hamsters,
    facilities: remainingFacilities,
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
