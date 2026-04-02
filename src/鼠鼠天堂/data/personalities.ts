// 性格标签列表

export interface PersonalityDef {
  id: string;
  name: string;
  /** 偏好设施类型（在该类设施中产能+50%） */
  preferredFacilityType?: string;
  /** 供AI参考的行为倾向 */
  behaviorHint: string;
}

export const PERSONALITIES: PersonalityDef[] = [
  {
    id: 'glutton',
    name: '贪吃',
    behaviorHint: '总是在找吃的，看到食物两眼放光',
  },
  {
    id: 'timid',
    name: '胆小',
    behaviorHint: '容易受惊，喜欢躲在角落，但被安抚后会特别依赖人',
  },
  {
    id: 'curious',
    name: '好奇',
    preferredFacilityType: 'maze_tunnel',
    behaviorHint: '对什么都感兴趣，喜欢探索新地方，偶尔闯祸',
  },
  {
    id: 'social',
    name: '社牛',
    preferredFacilityType: 'slide_park',
    behaviorHint: '热爱社交，和谁都能玩到一起，是群体的开心果',
  },
  {
    id: 'sleepy',
    name: '爱睡觉',
    behaviorHint: '总是在打盹，体力恢复快但不太爱动',
  },
  {
    id: 'energetic',
    name: '精力旺盛',
    preferredFacilityType: 'running_wheel',
    behaviorHint: '永远在跑，停不下来，产能高但心情波动大',
  },
  {
    id: 'gentle',
    name: '温顺',
    behaviorHint: '性格安静温和，容易相处，心情稳定',
  },
  {
    id: 'mischievous',
    name: '调皮',
    behaviorHint: '喜欢恶作剧，经常制造小麻烦，但能活跃气氛',
  },
];

/** 获取性格定义 */
export function getPersonalityDef(id: string): PersonalityDef | undefined {
  return PERSONALITIES.find(p => p.id === id);
}
