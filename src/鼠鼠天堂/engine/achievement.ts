// 1.7 成就检测

import type { GameState } from '../schema';
import { ACHIEVEMENTS } from '../data/achievements';

export interface AchievementUnlock {
  id: string;
  name: string;
  reward: number;
}

/** 检查成就，返回新解锁的成就列表并更新状态 */
export function checkAchievements(state: GameState): { state: GameState; unlocked: AchievementUnlock[] } {
  const unlocked: AchievementUnlock[] = [];
  let stardust = state.stardust;
  const newAchievements = [...state.achievements];

  for (const def of ACHIEVEMENTS) {
    if (state.achievements.includes(def.id)) continue;
    if (def.check(state)) {
      unlocked.push({ id: def.id, name: def.name, reward: def.reward });
      stardust += def.reward;
      newAchievements.push(def.id);
    }
  }

  if (unlocked.length === 0) return { state, unlocked: [] };

  return {
    state: { ...state, stardust, achievements: newAchievements },
    unlocked,
  };
}
