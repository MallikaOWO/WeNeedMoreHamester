// 1.4 鼠鼠管理

import type { GameState, Hamster } from '../schema';

/** 收养费用 */
const ADOPT_COST = 15;

/** 计算乐园当前住所容量 */
function getLivingCapacity(state: GameState): number {
  return Object.values(state.facilities)
    .filter(f => f.type === 'wood_nest' || f.type === 'garden_villa' || f.type === 'cloud_castle')
    .reduce((sum, f) => sum + f.capacity, 0);
}

/** 收养鼠鼠 */
export function adoptHamster(
  state: GameState,
  hamsterId: string,
  hamsterData: Omit<Hamster, 'assignedTo' | 'memory' | 'mood' | 'stamina'>,
): { state: GameState; success: boolean; reason?: string } {
  // 容量检查
  const capacity = getLivingCapacity(state);
  if (Object.keys(state.hamsters).length >= capacity) {
    return { state, success: false, reason: '住所容量不足，请先建造或升级住所' };
  }

  // 资源检查
  if (state.energy < ADOPT_COST) {
    return { state, success: false, reason: `能源不足（需要${ADOPT_COST}）` };
  }

  const newHamster: Hamster = {
    ...hamsterData,
    mood: 70,
    stamina: 100,
    assignedTo: null,
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

/** 分配鼠鼠到设施 */
export function assignHamster(
  state: GameState,
  hamsterId: string,
  facilityId: string,
): { state: GameState; success: boolean; reason?: string } {
  const hamster = state.hamsters[hamsterId];
  if (!hamster) return { state, success: false, reason: '鼠鼠不存在' };

  const facility = state.facilities[facilityId];
  if (!facility) return { state, success: false, reason: '设施不存在' };

  // 容量检查
  if (facility.capacity > 0 && Object.keys(facility.occupants).length >= facility.capacity) {
    return { state, success: false, reason: '设施已满' };
  }

  // 构建更新后的设施
  const facilities = { ...state.facilities };
  // 先从原设施移除
  if (hamster.assignedTo && facilities[hamster.assignedTo]) {
    const oldFacility = facilities[hamster.assignedTo];
    const { [hamsterId]: _, ...remainingOccupants } = oldFacility.occupants;
    facilities[hamster.assignedTo] = { ...oldFacility, occupants: remainingOccupants };
  }
  // 添加到新设施
  facilities[facilityId] = {
    ...facility,
    occupants: { ...facility.occupants, [hamsterId]: true },
  };

  const hamsters = {
    ...state.hamsters,
    [hamsterId]: { ...hamster, assignedTo: facilityId },
  };

  return {
    state: { ...state, facilities, hamsters },
    success: true,
  };
}

/** 从设施移除鼠鼠 */
export function unassignHamster(
  state: GameState,
  hamsterId: string,
): GameState {
  const hamster = state.hamsters[hamsterId];
  if (!hamster || !hamster.assignedTo) return state;

  const oldFacilityId = hamster.assignedTo;
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
      [hamsterId]: { ...hamster, assignedTo: null },
    },
  };
}
