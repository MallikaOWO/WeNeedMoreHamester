// 预设鼠天使定义
import type { Angel } from '../schema';
import { getSkillsByAngel } from './skills';

export interface AngelPreset {
  id: string;
  name: string;
  manageDomain: Angel['manageDomain'];
  /** 性格关键词（供提示词使用） */
  personalityKeywords: string[];
  /** 简要描述 */
  description: string;
}

export const ANGEL_PRESETS: AngelPreset[] = [
  {
    id: 'mianhua',
    name: '棉花',
    manageDomain: 'life',
    personalityKeywords: ['温柔', '治愈'],
    description: '负责生活设施管理，拥有治愈系超自然能力，说话轻声细语。',
  },
  {
    id: 'luosi',
    name: '螺丝',
    manageDomain: 'power',
    personalityKeywords: ['暴躁', '认真'],
    description: '负责产能设施管理，能力与机械和能源相关，嘴硬心软。',
  },
  {
    id: 'xingxing',
    name: '星星',
    manageDomain: 'stardust',
    personalityKeywords: ['神秘', '安静'],
    description: '负责星尘相关事务，与星辰有神秘联系，话少但说的都很重要。',
  },
  {
    id: 'paofu',
    name: '泡芙',
    manageDomain: 'social',
    personalityKeywords: ['话痨', '乐天'],
    description: '负责社交和事件管理，天生好运体质，是乐园的气氛担当。',
  },
  {
    id: 'unknown',
    name: '???',
    manageDomain: 'special',
    personalityKeywords: [],
    description: '解锁条件：后期特殊事件。',
  },
];

/** 将预设天使转为初始游戏状态中的 Angel 对象 */
export function createInitialAngel(preset: AngelPreset): Angel {
  const skills = getSkillsByAngel(preset.id);
  return {
    id: preset.id,
    name: preset.name,
    level: 1,
    manageDomain: preset.manageDomain,
    assignedFacility: null,
    skills: skills.map(s => ({
      skillId: s.id,
      level: 1,
      cooldownLeft: 0,
      unlockedAtAngelLevel: s.unlockedAtLevel,
    })),
    memory: [],
    exp: 0,
  };
}

/** 获取初始可用天使（排除隐藏天使） */
export function getStarterAngels(): Angel[] {
  return ANGEL_PRESETS
    .filter(p => p.id !== 'unknown')
    .map(createInitialAngel);
}
