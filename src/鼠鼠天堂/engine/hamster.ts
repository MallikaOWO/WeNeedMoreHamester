// 1.4 鼠鼠管理

import type { GameState, Hamster } from '../schema';

/** 收养费用 */
const ADOPT_COST = 15;

/** 计算乐园当前住所容量 */
function getLivingCapacity(state: GameState): number {
  return state.facilities
    .filter(f => f.type === 'wood_nest' || f.type === 'garden_villa' || f.type === 'cloud_castle')
    .reduce((sum, f) => sum + f.capacity, 0);
}

/** 收养鼠鼠 */
export function adoptHamster(
  state: GameState,
  hamsterData: Omit<Hamster, 'assignedTo' | 'memory'>,
): { state: GameState; success: boolean; reason?: string } {
  // 容量检查
  const capacity = getLivingCapacity(state);
  if (state.hamsters.length >= capacity) {
    return { state, success: false, reason: '住所容量不足，请先建造或升级住所' };
  }

  // 资源检查
  if (state.energy < ADOPT_COST) {
    return { state, success: false, reason: `能源不足（需要${ADOPT_COST}）` };
  }

  const newHamster: Hamster = {
    ...hamsterData,
    assignedTo: null,
    memory: [],
  };

  return {
    state: {
      ...state,
      energy: state.energy - ADOPT_COST,
      hamsters: [...state.hamsters, newHamster],
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
  const hamster = state.hamsters.find(h => h.id === hamsterId);
  if (!hamster) return { state, success: false, reason: '鼠鼠不存在' };

  const facility = state.facilities.find(f => f.id === facilityId);
  if (!facility) return { state, success: false, reason: '设施不存在' };

  // 容量检查
  if (facility.capacity > 0 && facility.occupants.length >= facility.capacity) {
    return { state, success: false, reason: '设施已满' };
  }

  // 先从原设施移除
  const facilities = state.facilities.map(f => {
    if (f.id === hamster.assignedTo) {
      return { ...f, occupants: f.occupants.filter(id => id !== hamsterId) };
    }
    if (f.id === facilityId) {
      return { ...f, occupants: [...f.occupants, hamsterId] };
    }
    return f;
  });

  const hamsters = state.hamsters.map(h =>
    h.id === hamsterId ? { ...h, assignedTo: facilityId } : h
  );

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
  const hamster = state.hamsters.find(h => h.id === hamsterId);
  if (!hamster || !hamster.assignedTo) return state;

  return {
    ...state,
    facilities: state.facilities.map(f =>
      f.id === hamster.assignedTo
        ? { ...f, occupants: f.occupants.filter(id => id !== hamsterId) }
        : f
    ),
    hamsters: state.hamsters.map(h =>
      h.id === hamsterId ? { ...h, assignedTo: null } : h
    ),
  };
}
