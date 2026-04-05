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

/** 统计满员设施数量（仅计有容量的设施） */
function countFullFacilities(s: GameState): number {
  let count = 0;
  for (const [fId, f] of Object.entries(s.facilities)) {
    if (f.capacity <= 0) continue;
    const def = getFacilityDef(f.type);
    if (def?.category === 'living') {
      if (Object.values(s.hamsters).filter(h => h.livingAt === fId).length >= f.capacity) count++;
    } else {
      if (Object.keys(f.occupants).length >= f.capacity) count++;
    }
  }
  return count;
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
    id: 'all_happy_3',
    name: '小小和谐',
    description: '3只鼠鼠心情同时达到90+',
    reward: 8,
    check: (s) => {
      const happy = Object.values(s.hamsters).filter(h => h.mood >= 90);
      return happy.length >= 3;
    },
  },
  {
    id: 'all_happy_6',
    name: '乐园之春',
    description: '6只鼠鼠心情同时达到90+',
    reward: 15,
    check: (s) => {
      const happy = Object.values(s.hamsters).filter(h => h.mood >= 90);
      return happy.length >= 6;
    },
  },
  {
    id: 'all_happy_9',
    name: '极乐净土',
    description: '9只鼠鼠心情同时达到90+',
    reward: 25,
    check: (s) => {
      const happy = Object.values(s.hamsters).filter(h => h.mood >= 90);
      return happy.length >= 9;
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
    id: 'full_house_3',
    name: '初具规模',
    description: '3个有容量的设施满员运行',
    reward: 10,
    check: (s) => countFullFacilities(s) >= 3,
  },
  {
    id: 'full_house_6',
    name: '满员运转',
    description: '6个有容量的设施满员运行',
    reward: 18,
    check: (s) => countFullFacilities(s) >= 6,
  },
  {
    id: 'full_house_10',
    name: '全力输出',
    description: '10个有容量的设施满员运行',
    reward: 30,
    check: (s) => countFullFacilities(s) >= 10,
  },
];

/** 获取成就定义 */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}
