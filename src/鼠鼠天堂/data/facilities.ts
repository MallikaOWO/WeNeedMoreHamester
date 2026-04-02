// 设施类型定义

import type { Angel } from '../schema';

export interface FacilityDef {
  type: string;
  name: string;
  category: 'play' | 'living' | 'function';
  /** 管理方向（对应天使 manageDomain） */
  manageDomain: Angel['manageDomain'] | 'any';
  /** 基础容量 */
  capacity: number;
  /** 基础产能（每回合，仅玩耍设施有） */
  basePower: number;
  /** 心情回复（每回合，仅生活设施有） */
  moodRegen: number;
  /** 特殊效果描述 */
  specialEffect?: string;
  /** 建造费用 */
  cost: { energy: number; stardust: number };
  /** 需要管理天使的最低等级 */
  requiredAngelLevel: number;
  /** 升级费用倍率（每级费用 = 基础 × 此值^(level-1)） */
  upgradeCostMultiplier: number;
  /** 偏好性格（该性格鼠鼠在此设施产能+50%） */
  preferredPersonality?: string;
}

export const FACILITY_DEFS: FacilityDef[] = [
  // ── 玩耍设施（产能核心）── 管理方向：螺丝(power)
  {
    type: 'running_wheel',
    name: '跑轮发电站',
    category: 'play',
    manageDomain: 'power',
    capacity: 2,
    basePower: 10,
    moodRegen: 0,
    cost: { energy: 30, stardust: 0 },
    requiredAngelLevel: 1,
    upgradeCostMultiplier: 1.8,
  },
  {
    type: 'maze_tunnel',
    name: '迷宫隧道',
    category: 'play',
    manageDomain: 'power',
    capacity: 3,
    basePower: 8,
    moodRegen: 0,
    cost: { energy: 50, stardust: 0 },
    requiredAngelLevel: 1,
    upgradeCostMultiplier: 1.8,
    preferredPersonality: '好奇',
  },
  {
    type: 'slide_park',
    name: '滑梯乐园',
    category: 'play',
    manageDomain: 'power',
    capacity: 2,
    basePower: 12,
    moodRegen: 0,
    cost: { energy: 60, stardust: 0 },
    requiredAngelLevel: 2,
    upgradeCostMultiplier: 1.8,
    preferredPersonality: '社牛',
  },
  {
    type: 'candy_pool',
    name: '棉花糖泳池',
    category: 'play',
    manageDomain: 'power',
    capacity: 4,
    basePower: 6,
    moodRegen: 0,
    cost: { energy: 80, stardust: 0 },
    requiredAngelLevel: 2,
    upgradeCostMultiplier: 2.0,
  },
  {
    type: 'star_trampoline',
    name: '星空蹦床',
    category: 'play',
    manageDomain: 'power',
    capacity: 2,
    basePower: 15,
    moodRegen: 0,
    cost: { energy: 100, stardust: 10 },
    requiredAngelLevel: 3,
    upgradeCostMultiplier: 2.0,
  },

  // ── 生活设施（容量与心情）── 管理方向：棉花(life)
  {
    type: 'wood_nest',
    name: '木屑小窝',
    category: 'living',
    manageDomain: 'life',
    capacity: 2,
    basePower: 0,
    moodRegen: 0,
    cost: { energy: 20, stardust: 0 },
    requiredAngelLevel: 1,
    upgradeCostMultiplier: 1.5,
  },
  {
    type: 'garden_villa',
    name: '花园别墅',
    category: 'living',
    manageDomain: 'life',
    capacity: 3,
    basePower: 0,
    moodRegen: 5,
    cost: { energy: 60, stardust: 0 },
    requiredAngelLevel: 2,
    upgradeCostMultiplier: 1.8,
  },
  {
    type: 'cloud_castle',
    name: '云朵城堡',
    category: 'living',
    manageDomain: 'life',
    capacity: 4,
    basePower: 0,
    moodRegen: 10,
    cost: { energy: 120, stardust: 15 },
    requiredAngelLevel: 3,
    upgradeCostMultiplier: 2.0,
  },

  // ── 功能设施 ── 管理方向：星星/泡芙/任意
  {
    type: 'sunflower_storage',
    name: '向日葵储能站',
    category: 'function',
    manageDomain: 'any',
    capacity: 0,
    basePower: 0,
    moodRegen: 0,
    specialEffect: '能源上限+100',
    cost: { energy: 40, stardust: 0 },
    requiredAngelLevel: 1,
    upgradeCostMultiplier: 1.5,
  },
  {
    type: 'canteen',
    name: '食堂',
    category: 'function',
    manageDomain: 'any',
    capacity: 0,
    basePower: 0,
    moodRegen: 0,
    specialEffect: '体力恢复+50%',
    cost: { energy: 50, stardust: 0 },
    requiredAngelLevel: 1,
    upgradeCostMultiplier: 1.5,
  },
  {
    type: 'watchtower',
    name: '瞭望台',
    category: 'function',
    manageDomain: 'social',
    capacity: 0,
    basePower: 0,
    moodRegen: 0,
    specialEffect: '事件预警+30%',
    cost: { energy: 70, stardust: 0 },
    requiredAngelLevel: 2,
    upgradeCostMultiplier: 1.8,
  },
  {
    type: 'stardust_altar',
    name: '星尘祭坛',
    category: 'function',
    manageDomain: 'stardust',
    capacity: 0,
    basePower: 0,
    moodRegen: 0,
    specialEffect: '被动产出星尘',
    cost: { energy: 150, stardust: 20 },
    requiredAngelLevel: 3,
    upgradeCostMultiplier: 2.0,
  },
];

/** 按类型查找设施定义 */
export function getFacilityDef(type: string): FacilityDef | undefined {
  return FACILITY_DEFS.find(f => f.type === type);
}

/** 按类别筛选设施 */
export function getFacilitiesByCategory(category: FacilityDef['category']): FacilityDef[] {
  return FACILITY_DEFS.filter(f => f.category === category);
}

/** 计算升级费用 */
export function getUpgradeCost(def: FacilityDef, currentLevel: number): { energy: number; stardust: number } {
  const mult = Math.pow(def.upgradeCostMultiplier, currentLevel);
  return {
    energy: Math.round(def.cost.energy * mult),
    stardust: Math.round(def.cost.stardust * mult),
  };
}
