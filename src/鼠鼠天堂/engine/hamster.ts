// 1.4 鼠鼠管理

import type { GameState, Hamster } from '../schema';
import { getFacilityDef } from '../data/facilities';

/** 收养费用 */
const ADOPT_COST = 15;

/** 计算乐园当前住所容量（所有 living 设施容量之和） */
function getLivingCapacity(state: GameState): number {
  return Object.values(state.facilities)
    .filter(f => getFacilityDef(f.type)?.category === 'living')
    .reduce((sum, f) => sum + f.capacity, 0);
}

/** 计算已占用住所数量（所有 livingAt 非 null 的鼠鼠） */
function getLivingCount(state: GameState): number {
  return Object.values(state.hamsters).filter(h => h.livingAt).length;
}

/** 寻找有空位的 living 设施 */
function findAvailableLiving(state: GameState): string | null {
  for (const [fId, f] of Object.entries(state.facilities)) {
    const def = getFacilityDef(f.type);
    if (def?.category !== 'living') continue;
    const residents = Object.values(state.hamsters).filter(h => h.livingAt === fId).length;
    if (residents < f.capacity) return fId;
  }
  return null;
}

/** 收养鼠鼠 */
export function adoptHamster(
  state: GameState,
  hamsterId: string,
  hamsterData: Omit<Hamster, 'livingAt' | 'workingAt' | 'memory' | 'mood' | 'stamina'>,
): { state: GameState; success: boolean; reason?: string } {
  // 容量检查
  const capacity = getLivingCapacity(state);
  if (getLivingCount(state) >= capacity) {
    return { state, success: false, reason: '住所容量不足，请先建造或升级住所' };
  }

  // 资源检查
  if (state.energy < ADOPT_COST) {
    return { state, success: false, reason: `能源不足（需要${ADOPT_COST}）` };
  }

  // 自动分配到有空位的 living 设施
  const livingId = findAvailableLiving(state);
  if (!livingId) {
    return { state, success: false, reason: '没有可用的住所' };
  }

  const newHamster: Hamster = {
    ...hamsterData,
    mood: 70,
    stamina: 100,
    livingAt: livingId,
    workingAt: null,
    memory: {},
  };

  return {
    state: {
      ...state,
      energy: state.energy - ADOPT_COST,
      hamsters: { ...state.hamsters, [hamsterId]: newHamster },
    },
    success: true,
  };
}

/** 分配鼠鼠到工作设施（play 类） */
export function assignToWork(
  state: GameState,
  hamsterId: string,
  facilityId: string,
): { state: GameState; success: boolean; reason?: string } {
  const hamster = state.hamsters[hamsterId];
  if (!hamster) return { state, success: false, reason: '鼠鼠不存在' };

  const facility = state.facilities[facilityId];
  if (!facility) return { state, success: false, reason: '设施不存在' };

  const def = getFacilityDef(facility.type);
  if (!def) return { state, success: false, reason: '未知设施类型' };

  // 只能分配到 play 类设施工作
  if (def.category !== 'play') {
    return { state, success: false, reason: '只能分配到玩耍设施工作' };
  }

  // 工位容量检查（基于 occupants）
  if (facility.capacity > 0 && Object.keys(facility.occupants).length >= facility.capacity) {
    return { state, success: false, reason: '设施已满' };
  }

  // 先从旧工作设施移除
  const facilities = { ...state.facilities };
  if (hamster.workingAt && facilities[hamster.workingAt]) {
    const oldFacility = facilities[hamster.workingAt];
    const { [hamsterId]: _, ...remainingOccupants } = oldFacility.occupants;
    facilities[hamster.workingAt] = { ...oldFacility, occupants: remainingOccupants };
  }

  // 添加到新工作设施
  facilities[facilityId] = {
    ...facility,
    occupants: { ...facility.occupants, [hamsterId]: true },
  };

  const hamsters = {
    ...state.hamsters,
    [hamsterId]: { ...hamster, workingAt: facilityId },
  };

  return { state: { ...state, facilities, hamsters }, success: true };
}

/** 停止工作，回窝休息 */
export function stopWorking(
  state: GameState,
  hamsterId: string,
): GameState {
  const hamster = state.hamsters[hamsterId];
  if (!hamster || !hamster.workingAt) return state;

  const oldFacilityId = hamster.workingAt;
  const oldFacility = state.facilities[oldFacilityId];

  const facilities = { ...state.facilities };
  if (oldFacility) {
    const { [hamsterId]: _, ...remainingOccupants } = oldFacility.occupants;
    facilities[oldFacilityId] = { ...oldFacility, occupants: remainingOccupants };
  }

  return {
    ...state,
    facilities,
    hamsters: {
      ...state.hamsters,
      [hamsterId]: { ...hamster, workingAt: null },
    },
  };
}

/** 更换居住设施 */
export function changeLiving(
  state: GameState,
  hamsterId: string,
  facilityId: string,
): { state: GameState; success: boolean; reason?: string } {
  const hamster = state.hamsters[hamsterId];
  if (!hamster) return { state, success: false, reason: '鼠鼠不存在' };

  const facility = state.facilities[facilityId];
  if (!facility) return { state, success: false, reason: '设施不存在' };

  const def = getFacilityDef(facility.type);
  if (def?.category !== 'living') {
    return { state, success: false, reason: '只能选择生活设施' };
  }

  // 目标住所容量检查
  const residents = Object.values(state.hamsters).filter(h => h.livingAt === facilityId).length;
  if (residents >= facility.capacity) {
    return { state, success: false, reason: '住所已满' };
  }

  // 如果是同一个设施，不操作
  if (hamster.livingAt === facilityId) {
    return { state, success: false, reason: '已经住在这里了' };
  }

  return {
    state: {
      ...state,
      hamsters: {
        ...state.hamsters,
        [hamsterId]: { ...hamster, livingAt: facilityId },
      },
    },
    success: true,
  };
}
