// 技能定义

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  /** 所属天使ID */
  angelId: string;
  /** 天使达到此等级解锁 */
  unlockedAtLevel: number;
  /** 冷却回合数 */
  cooldown: number;
  /** 效果类型 */
  effectType: 'heal_mood' | 'boost_production' | 'boost_stardust' | 'convert_resource' | 'preview_event' | 'force_event_type' | 'aoe_mood' | 'repair_facility';
  /** 效果强度/数值 */
  effectValue: number;
  /** 是否作用于全体 */
  aoe?: boolean;
}

export const SKILLS: SkillDef[] = [
  // ── 棉花 ──
  {
    id: 'heal_touch',
    name: '治愈之触',
    description: '恢复一只鼠鼠心情至满',
    angelId: 'mianhua',
    unlockedAtLevel: 1,
    cooldown: 3,
    effectType: 'heal_mood',
    effectValue: 100,
  },
  {
    id: 'warm_barrier',
    name: '温暖结界',
    description: '全体心情+15，免疫1次负面事件',
    angelId: 'mianhua',
    unlockedAtLevel: 3,
    cooldown: 6,
    effectType: 'aoe_mood',
    effectValue: 15,
    aoe: true,
  },

  // ── 螺丝 ──
  {
    id: 'energy_overload',
    name: '能源过载',
    description: '所管理设施下回合产能翻倍',
    angelId: 'luosi',
    unlockedAtLevel: 1,
    cooldown: 4,
    effectType: 'boost_production',
    effectValue: 2, // 倍数
  },
  {
    id: 'emergency_repair',
    name: '紧急维修',
    description: '立即修复一个损坏/降级的设施',
    angelId: 'luosi',
    unlockedAtLevel: 3,
    cooldown: 5,
    effectType: 'repair_facility',
    effectValue: 1,
  },

  // ── 星星 ──
  {
    id: 'stardust_sense',
    name: '星尘感应',
    description: '本回合所有星尘收入+50%',
    angelId: 'xingxing',
    unlockedAtLevel: 1,
    cooldown: 5,
    effectType: 'boost_stardust',
    effectValue: 1.5, // 倍数
  },
  {
    id: 'stellar_blessing',
    name: '星辰祝福',
    description: '消耗能源，转化为星尘',
    angelId: 'xingxing',
    unlockedAtLevel: 3,
    cooldown: 6,
    effectType: 'convert_resource',
    effectValue: 5, // 每5能源→1星尘
  },

  // ── 泡芙 ──
  {
    id: 'lucky_hunch',
    name: '幸运预感',
    description: '预知下回合事件类型',
    angelId: 'paofu',
    unlockedAtLevel: 1,
    cooldown: 3,
    effectType: 'preview_event',
    effectValue: 1,
  },
  {
    id: 'lucky_streak',
    name: '好运连连',
    description: '下次事件必定为机遇类',
    angelId: 'paofu',
    unlockedAtLevel: 3,
    cooldown: 8,
    effectType: 'force_event_type',
    effectValue: 1,
  },
];

/** 按天使ID查询技能 */
export function getSkillsByAngel(angelId: string): SkillDef[] {
  return SKILLS.filter(s => s.angelId === angelId);
}

/** 按ID查询技能 */
export function getSkillDef(skillId: string): SkillDef | undefined {
  return SKILLS.find(s => s.id === skillId);
}
