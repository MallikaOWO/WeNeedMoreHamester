// 鼠鼠天堂 游戏状态 Schema
// MVU 约定：record > array, coerce.number + transform(clamp), prefault

// ── 技能状态 [代码管理] ──
const SkillStateSchema = z.object({
  level: z.coerce.number().transform(v => _.clamp(v, 1, 5)).prefault(1),
  cooldownLeft: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
  unlockedAtAngelLevel: z.coerce.number().transform(v => _.clamp(v, 1, 5)).prefault(1),
});

// ── 事件选项 [AI 生成，代码结算] ──
const EventOptionSchema = z.object({
  label: z.string().prefault(''),
  // 修剪AI生成的事件奖励，防止经济过宽松
  energy_delta: z.coerce.number().transform(v => _.clamp(v, -30, 15)).prefault(0),
  stardust_delta: z.coerce.number().transform(v => _.clamp(v, -5, 10)).prefault(0),
  mood_delta: z.coerce.number().transform(v => _.clamp(v, -15, 20)).prefault(0),
  mood_target: z.string().optional(),
  is_silly: z.boolean().prefault(false),
  // 可选 buff：AI 可在选项中附加持续效果
  buff: z.object({
    type: z.string().prefault(''),
    target: z.string().prefault('global'),
    value: z.coerce.number().prefault(0),
    duration: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
    description: z.string().prefault(''),
  }).optional(),
  // 可选事件链标记
  flag_set: z.string().optional(),
});

// ── Buff 效果 [代码管理] ──
const BuffSchema = z.object({
  type: z.string().prefault(''),
  target: z.string().prefault('global'),
  value: z.coerce.number().prefault(0),
  duration: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
  description: z.string().prefault(''),
});

// ── 游戏事件 [AI 生成] ──
const GameEventSchema = z.object({
  description: z.string().prefault(''),
  related_characters: z.string().prefault(''),
  options: z.record(z.string(), EventOptionSchema).prefault({}),
});

// ── 收养提案 [AI 生成] ──
const AdoptionProposalSchema = z.object({
  name: z.string().prefault(''),
  breed: z.string().prefault(''),
  personality: z.string().prefault(''),
  basePower: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(5),
  preference: z.string().prefault(''),
  story: z.string().prefault(''),
});

// ── 鼠居民 ──
const HamsterSchema = z.object({
  name: z.string().prefault(''),
  breed: z.string().prefault(''),
  personality: z.string().prefault(''),
  story: z.string().prefault(''),
  basePower: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(5),
  preference: z.string().prefault(''),

  // [代码] 机械属性
  mood: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(70),
  stamina: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(100),
  /** 居住设施 ID（收养后必须分配） */
  livingAt: z.string().nullable().prefault(null),
  /** 工作设施 ID（可选，工作时消耗体力） */
  workingAt: z.string().nullable().prefault(null),

  // [AI] 个体记忆
  memory: z.record(z.string(), z.string()).prefault({}),
});

// ── 鼠天使 ──
const AngelSchema = z.object({
  name: z.string().prefault(''),

  // [代码] 机械属性
  level: z.coerce.number().transform(v => _.clamp(v, 1, 5)).prefault(1),
  exp: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
  manageDomain: z.string().prefault(''),
  assignedFacility: z.string().nullable().prefault(null),
  skills: z.record(z.string(), SkillStateSchema).prefault({}),

  // [AI] 个体记忆
  memory: z.record(z.string(), z.string()).prefault({}),
});

// ── 设施 [代码管理] ──
const FacilitySchema = z.object({
  type: z.string().prefault(''),
  level: z.coerce.number().transform(v => _.clamp(v, 1, 3)).prefault(1),
  capacity: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
  occupants: z.record(z.string(), z.boolean()).prefault({}),
  managedBy: z.string().nullable().prefault(null),
  requiredAngelLevel: z.coerce.number().transform(v => _.clamp(v, 1, 5)).prefault(1),
});

// ── 游戏全局状态 ──
export const Schema = z.object({
  // [代码] 资源与进度
  energy: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(80),
  energyCap: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(100),
  stardust: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
  turn: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
  happiness: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(70),

  // [代码] 角色与设施
  hamsters: z.record(z.string(), HamsterSchema).prefault({}),
  angels: z.record(z.string(), AngelSchema).prefault({}),
  facilities: z.record(z.string(), FacilitySchema).prefault({}),

  // [代码] 成就
  achievements: z.record(z.string(), z.boolean()).prefault({}),

  // [代码] Buff 效果
  buffs: z.record(z.string(), BuffSchema).prefault({}),

  // [代码] 事件链标记（value = 设置时的 turn 号）
  event_flags: z.record(z.string(), z.coerce.number().prefault(0)).prefault({}),

  // [AI] 事件与提案
  pending_events: z.record(z.string(), GameEventSchema).prefault({}),
  adoption_proposal: AdoptionProposalSchema.nullable().prefault(null),
});

// 导出推断类型
export type GameState = z.output<typeof Schema>;
export type Hamster = z.output<typeof HamsterSchema>;
export type Angel = z.output<typeof AngelSchema>;
export type Facility = z.output<typeof FacilitySchema>;
export type SkillState = z.output<typeof SkillStateSchema>;
export type GameEvent = z.output<typeof GameEventSchema>;
export type EventOption = z.output<typeof EventOptionSchema>;
export type AdoptionProposal = z.output<typeof AdoptionProposalSchema>;
export type Buff = z.output<typeof BuffSchema>;
