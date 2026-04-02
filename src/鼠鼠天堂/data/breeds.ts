// 鼠鼠品种列表

export interface BreedDef {
  id: string;
  name: string;
  /** 供AI生成描述时参考 */
  descriptionHint: string;
}

export const BREEDS: BreedDef[] = [
  { id: 'golden', name: '金丝熊', descriptionHint: '体型较大，毛色金黄，性格独立' },
  { id: 'dwarf', name: '侏儒仓鼠', descriptionHint: '体型迷你，活泼好动，喜欢钻洞' },
  { id: 'milk_tea', name: '奶茶仓鼠', descriptionHint: '毛色奶茶渐变，性格温顺亲人' },
  { id: 'pudding', name: '布丁仓鼠', descriptionHint: '毛色嫩黄如布丁，圆滚滚，爱吃' },
  { id: 'silver_fox', name: '银狐仓鼠', descriptionHint: '银白毛色，眼神清澈，略显高冷' },
  { id: 'purple', name: '紫仓', descriptionHint: '灰紫色背毛，好奇心旺盛，爱探险' },
  { id: 'cream', name: '奶油仓鼠', descriptionHint: '纯白毛色，安静优雅，喜欢独处' },
  { id: 'sapphire', name: '蓝宝石仓鼠', descriptionHint: '蓝灰色毛发，机灵敏捷，社交达人' },
];

/** 获取品种定义 */
export function getBreedDef(id: string): BreedDef | undefined {
  return BREEDS.find(b => b.id === id);
}
