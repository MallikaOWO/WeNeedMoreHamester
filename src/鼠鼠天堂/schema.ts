// 鼠鼠天堂 游戏状态 Schema
// 供 dump_schema.ts 生成 schema.json，同时作为全项目类型基础

// ── 个体记忆条目 ──
const MemoryEntrySchema = z.object({
  turn: z.number().int().min(0),
  text: z.string(),
  important: z.boolean(),
});

// ── 技能状态 ──
const SkillStateSchema = z.object({
  skillId: z.string(),
  level: z.number().int().min(1),
  cooldownLeft: z.number().int().min(0),
  unlockedAtAngelLevel: z.number().int().min(1).max(5),
});

// ── 鼠居民 ──
const HamsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  breed: z.string(),
  personality: z.array(z.string()),
  mood: z.number().int().min(0).max(100),
  stamina: z.number().int().min(0).max(100),
  preference: z.string(),
  basePower: z.number().int().min(0),
  story: z.string(),
  assignedTo: z.string().nullable(),
  memory: z.array(MemoryEntrySchema),
});

// ── 鼠天使 ──
const AngelSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(1).max(5),
  manageDomain: z.enum(['life', 'power', 'stardust', 'social', 'special']),
  assignedFacility: z.string().nullable(),
  skills: z.array(SkillStateSchema),
  memory: z.array(MemoryEntrySchema),
  exp: z.number().int().min(0),
});

// ── 设施 ──
const FacilitySchema = z.object({
  id: z.string(),
  type: z.string(),
  level: z.number().int().min(1).max(3),
  capacity: z.number().int().min(0),
  occupants: z.array(z.string()),
  managedBy: z.string().nullable(),
  requiredAngelLevel: z.number().int().min(1).max(5),
});

// ── 事件选项 ──
const EventOptionSchema = z.object({
  label: z.string(),
  energyDelta: z.number(),
  stardustDelta: z.number(),
  moodDelta: z.number(),
  moodTarget: z.string().optional(),
  isSilly: z.boolean().optional(),
});

// ── 游戏事件 ──
const GameEventSchema = z.object({
  id: z.string(),
  description: z.string(),
  relatedCharacters: z.array(z.string()),
  options: z.array(EventOptionSchema),
});

// ── 游戏全局状态 ──
const GameStateSchema = z.object({
  energy: z.number().int().min(0),
  energyCap: z.number().int().min(0),
  stardust: z.number().int().min(0),
  turn: z.number().int().min(0),
  happiness: z.number().int().min(0).max(100),
  hamsters: z.array(HamsterSchema),
  facilities: z.array(FacilitySchema),
  angels: z.array(AngelSchema),
  achievements: z.array(z.string()),
  pendingEvents: z.array(GameEventSchema),
});

// dump_schema.ts 查找此导出
export const Schema = GameStateSchema;

// 导出子 schema 供引擎和前端使用
export {
  MemoryEntrySchema,
  SkillStateSchema,
  HamsterSchema,
  AngelSchema,
  FacilitySchema,
  EventOptionSchema,
  GameEventSchema,
  GameStateSchema,
};

// 导出推断类型
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type SkillState = z.infer<typeof SkillStateSchema>;
export type Hamster = z.infer<typeof HamsterSchema>;
export type Angel = z.infer<typeof AngelSchema>;
export type Facility = z.infer<typeof FacilitySchema>;
export type EventOption = z.infer<typeof EventOptionSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
