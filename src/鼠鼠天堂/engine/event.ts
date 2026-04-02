// 1.5 事件结算

import type { GameState, EventOption } from '../schema';

/** 事件类型及对应概率 */
export type EventType = 'daily' | 'opportunity' | 'challenge' | 'special';

const EVENT_WEIGHTS: { type: EventType; weight: number }[] = [
  { type: 'daily', weight: 50 },
  { type: 'opportunity', weight: 30 },
  { type: 'challenge', weight: 15 },
  { type: 'special', weight: 5 },
];

/** 按权重随机选取事件类型 */
function rollEventType(): EventType {
  const total = EVENT_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of EVENT_WEIGHTS) {
    roll -= w.weight;
    if (roll <= 0) return w.type;
  }
  return 'daily';
}

/** 决定本回合事件数量和各槽位类型 */
export function rollEventSlots(_state: GameState): EventType[] {
  const count = Math.random() < 0.5 ? 2 : 3;
  return Array.from({ length: count }, () => rollEventType());
}

/** 应用玩家对事件选项的选择 */
export function applyEventChoice(
  state: GameState,
  eventId: string,
  optionIndex: number,
): GameState {
  const event = state.pendingEvents.find(e => e.id === eventId);
  if (!event) return state;
  const option = event.options[optionIndex];
  if (!option) return state;

  let energy = state.energy + option.energyDelta;
  let stardust = state.stardust + option.stardustDelta;
  // 资源不低于0
  energy = Math.max(0, Math.min(energy, state.energyCap));
  stardust = Math.max(0, stardust);

  // 心情变化
  let hamsters = state.hamsters;
  if (option.moodDelta !== 0) {
    if (option.moodTarget) {
      // 指定角色心情变化
      hamsters = state.hamsters.map(h =>
        h.id === option.moodTarget
          ? { ...h, mood: Math.max(0, Math.min(100, h.mood + option.moodDelta)) }
          : h
      );
    } else {
      // 全局心情变化
      hamsters = state.hamsters.map(h => ({
        ...h,
        mood: Math.max(0, Math.min(100, h.mood + option.moodDelta)),
      }));
    }
  }

  // 从待处理事件中移除
  const pendingEvents = state.pendingEvents.filter(e => e.id !== eventId);

  return {
    ...state,
    energy,
    stardust,
    hamsters,
    pendingEvents,
  };
}

/** 验证事件选项的资源扣除不超过当前资源的10% */
export function validateEventOptions(state: GameState, options: EventOption[]): EventOption[] {
  const maxEnergyLoss = Math.round(state.energy * 0.1);
  const maxStardustLoss = Math.round(state.stardust * 0.1);

  return options.map(opt => ({
    ...opt,
    energyDelta: opt.energyDelta < 0
      ? Math.max(opt.energyDelta, -maxEnergyLoss)
      : opt.energyDelta,
    stardustDelta: opt.stardustDelta < 0
      ? Math.max(opt.stardustDelta, -maxStardustLoss)
      : opt.stardustDelta,
  }));
}
