// 初始游戏状态工厂

import type { GameState } from '../schema';
import { getStarterAngels } from './angels';

/** 创建新游戏的初始 GameState */
export function createInitialGameState(): GameState {
  return {
    energy: 80,
    energyCap: 100,
    stardust: 0,
    turn: 0,
    happiness: 70,
    hamsters: {},
    facilities: {},
    angels: getStarterAngels(),
    achievements: {},
    buffs: {},
    event_flags: {},
    pending_events: {},
    adoption_proposal: null,
  };
}
