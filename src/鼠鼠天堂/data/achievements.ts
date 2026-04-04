// 成就定义

import type { GameState } from '../schema';
import { getFacilityDef } from './facilities';

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
    check: (s) => Object.keys(s.hamsters).length >= 1,
  },
  {
    id: 'small_paradise',
    name: '小小乐园',
    description: '同时拥有5只鼠鼠',
    reward: 10,
    check: (s) => Object.keys(s.hamsters).length >= 5,
  },
  {
    id: 'big_family',
    name: '大家庭',
    description: '同时拥有10只鼠鼠',
    reward: 20,
    check: (s) => Object.keys(s.hamsters).length >= 10,
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
    check: (s) => {
      const hamsters = Object.values(s.hamsters);
      return hamsters.length > 0 && hamsters.every(h => h.mood >= 90);
    },
  },
  {
    id: 'master_builder',
    name: '建筑大师',
    description: '建造10个设施',
    reward: 15,
    check: (s) => Object.keys(s.facilities).length >= 10,
  },
  {
    id: 'angel_power',
    name: '天使之力',
    description: '任一鼠天使达到Lv.3',
    reward: 10,
    check: (s) => Object.values(s.angels).some(a => a.level >= 3),
  },
  {
    id: 'full_house',
    name: '满员运转',
    description: '所有设施都满员运行',
    reward: 15,
    check: (s) => {
      const facilityEntries = Object.entries(s.facilities);
      return facilityEntries.length > 0 && facilityEntries.every(([fId, f]) => {
        if (f.capacity <= 0) return true;
        const def = getFacilityDef(f.type);
        if (def?.category === 'living') {
          // living 设施看 hamsters.livingAt
          return Object.values(s.hamsters).filter(h => h.livingAt === fId).length >= f.capacity;
        }
        // play 设施看 occupants
        return Object.keys(f.occupants).length >= f.capacity;
      });
    },
  },
];

/** 获取成就定义 */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}
