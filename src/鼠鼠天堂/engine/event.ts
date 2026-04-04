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
  optionKey: string,
): GameState {
  const event = state.pending_events[eventId];
  if (!event) return state;
  const option = event.options[optionKey];
  if (!option) return state;

  let energy = state.energy + option.energy_delta;
  let stardust = state.stardust + option.stardust_delta;
  // 资源不低于0
  energy = Math.max(0, Math.min(energy, state.energyCap));
  stardust = Math.max(0, stardust);

  // 心情变化
  let hamsters = state.hamsters;
  if (option.mood_delta !== 0) {
    if (option.mood_target) {
      // 指定角色心情变化
      const target = hamsters[option.mood_target];
      if (target) {
        hamsters = {
          ...hamsters,
          [option.mood_target]: {
            ...target,
            mood: Math.max(0, Math.min(100, target.mood + option.mood_delta)),
          },
        };
      }
    } else {
      // 全局心情变化
      hamsters = Object.fromEntries(
        Object.entries(state.hamsters).map(([id, h]) => [
          id,
          { ...h, mood: Math.max(0, Math.min(100, h.mood + option.mood_delta)) },
        ])
      );
    }
  }

  // 从待处理事件中移除
  const { [eventId]: _, ...pending_events } = state.pending_events;

  // 重新计算全局心情值（所有鼠鼠 mood 的平均值）
  const hamsterValues = Object.values(hamsters);
  const happiness = hamsterValues.length > 0
    ? Math.round(hamsterValues.reduce((sum, h) => sum + h.mood, 0) / hamsterValues.length)
    : state.happiness;

  return {
    ...state,
    energy,
    stardust,
    happiness,
    hamsters,
    pending_events,
  };
}

/** 验证事件选项的资源扣除不超过当前资源的10% */
export function validateEventOptions(state: GameState, options: Record<string, EventOption>): Record<string, EventOption> {
  const maxEnergyLoss = Math.round(state.energy * 0.1);
  const maxStardustLoss = Math.round(state.stardust * 0.1);

  return Object.fromEntries(
    Object.entries(options).map(([key, opt]) => [
      key,
      {
        ...opt,
        energy_delta: opt.energy_delta < 0
          ? Math.max(opt.energy_delta, -maxEnergyLoss)
          : opt.energy_delta,
        stardust_delta: opt.stardust_delta < 0
          ? Math.max(opt.stardust_delta, -maxStardustLoss)
          : opt.stardust_delta,
      },
    ])
  );
}
