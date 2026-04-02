// 成就定义

import type { GameState } from '../schema';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** 星尘奖励 */
  reward: number;
  /** 检查是否达成 */
  check: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_hamster',
    name: '初心',
    description: '收养第一只鼠鼠',
    reward: 5,
    check: (s) => s.hamsters.length >= 1,
  },
  {
    id: 'small_paradise',
    name: '小小乐园',
    description: '同时拥有5只鼠鼠',
    reward: 10,
    check: (s) => s.hamsters.length >= 5,
  },
  {
    id: 'big_family',
    name: '大家庭',
    description: '同时拥有10只鼠鼠',
    reward: 20,
    check: (s) => s.hamsters.length >= 10,
  },
  {
    id: 'power_surge',
    name: '电力充沛',
    description: '能源达到100',
    reward: 15,
    check: (s) => s.energy >= 100,
  },
  {
    id: 'all_happy',
    name: '全员满意',
    description: '所有鼠鼠心情达到90+',
    reward: 10,
    check: (s) => s.hamsters.length > 0 && s.hamsters.every(h => h.mood >= 90),
  },
  {
    id: 'master_builder',
    name: '建筑大师',
    description: '建造10个设施',
    reward: 15,
    check: (s) => s.facilities.length >= 10,
  },
  {
    id: 'angel_power',
    name: '天使之力',
    description: '任一鼠天使达到Lv.3',
    reward: 10,
    check: (s) => s.angels.some(a => a.level >= 3),
  },
  {
    id: 'full_house',
    name: '满员运转',
    description: '所有设施都满员运行',
    reward: 15,
    check: (s) => s.facilities.length > 0 && s.facilities.every(f => f.capacity > 0 ? f.occupants.length >= f.capacity : true),
  },
];

/** 获取成就定义 */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}
