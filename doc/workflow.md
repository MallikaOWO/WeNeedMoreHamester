# 项目落地工作流

基于 design_doc.md 的设计，分阶段实现。每个阶段的产出应可独立验证。

---

## Phase 0: 数据层

**目标**：定义全部游戏数据结构，使后续所有模块有统一的类型基础。

### 0.1 schema 定义

文件：`鼠鼠天堂/schema.ts`

用 zod 定义完整游戏状态 schema，包括：
- `GameState`（能源/星尘/心情/回合数/成就）
- `Hamster`（属性、记忆、分配状态）
- `Angel`（预设ID、等级、经验、技能冷却、记忆、管理设施）
- `Facility`（类型、等级、容量、占用者、管理天使、需求天使等级）
- `GameEvent` / `EventOption`（事件结构、选项资源标注）
- `MemoryEntry`（回合、文本、重要标记）

运行 `pnpm dump` 验证 schema.json 产出。

### 0.2 静态数据表

文件：`src/鼠鼠天堂/data/`

- `angels.ts` — 预设鼠天使定义（棉花/螺丝/星星/泡芙/???），含初始技能、管理方向
- `facilities.ts` — 设施类型定义（造价、容量、产能、需求天使等级、管理方向）
- `skills.ts` — 技能定义（效果类型、冷却、解锁等级）
- `achievements.ts` — 成就定义（条件、奖励）
- `breeds.ts` — 鼠鼠品种列表（名称、描述模板）
- `personalities.ts` — 性格标签列表（名称、偏好设施类型关联）

### 0.3 初始状态工厂

文件：`src/鼠鼠天堂/data/init.ts`

`createInitialGameState()` → 返回新游戏的 GameState：
- 初始资源（⚡50, ✨0, 💛70）
- 预设天使列表（全部 Lv.1）
- 空鼠居民 / 空设施
- 回合 0

**验收**：schema 通过 dump，类型无报错，初始状态通过 schema 校验。

---

## Phase 1: 游戏引擎（纯逻辑，无 UI）

**目标**：所有数值结算逻辑可独立于 UI 运行和测试。

### 1.1 回合结算

文件：`src/鼠鼠天堂/engine/turn.ts`

`settleTurn(state: GameState): GameState`

- 遍历设施 → 计算每个设施的产能（基础 × 鼠鼠偏好加成 × 心情乘数）
- 累加能源（不超过上限）
- 扣减体力，低体力鼠鼠自动回窝
- 休息中鼠鼠恢复体力（食堂加成）
- 生活设施回复心情
- 星尘祭坛被动产出
- 更新全局心情值（所有鼠鼠平均）

### 1.2 建造 / 升级

文件：`src/鼠鼠天堂/engine/facility.ts`

- `canBuild(state, facilityType)` → 检查资源 + 天使等级前提
- `buildFacility(state, facilityType)` → 扣资源，创建设施，分配天使
- `canUpgrade(state, facilityId)` → 检查资源 + 天使等级
- `upgradeFacility(state, facilityId)` → 扣资源，提升等级

### 1.3 天使系统

文件：`src/鼠鼠天堂/engine/angel.ts`

- `canLevelUp(state, angelId)` → 检查星尘 + 设施等级前提
- `levelUpAngel(state, angelId)` → 扣星尘，升级，解锁技能
- `useSkill(state, angelId, skillId, target?)` → 检查冷却 → 应用效果 → 设置冷却
- `tickCooldowns(state)` → 每回合冷却 -1

### 1.4 鼠鼠管理

文件：`src/鼠鼠天堂/engine/hamster.ts`

- `adoptHamster(state, hamsterData)` → 检查容量 → 扣资源 → 添加鼠鼠
- `assignHamster(state, hamsterId, facilityId)` → 检查设施容量 → 分配
- `unassignHamster(state, hamsterId)` → 从设施移除

### 1.5 事件结算

文件：`src/鼠鼠天堂/engine/event.ts`

- `rollEventSlots(state)` → 返回本回合事件数量(2-3)和各槽位类型
- `applyEventChoice(state, eventId, optionIndex)` → 应用选项的资源变动
- `validateEventOptions(state, options)` → 确保负面选项不超过资源10%

### 1.6 记忆管理

文件：`src/鼠鼠天堂/engine/memory.ts`

- `appendMemory(character, entry)` → 追加记忆条目
- `compressMemory(character)` → 超限时压缩旧条目（保留 important）
- `getMemoryForPrompt(state, characterIds)` → 提取指定角色的记忆文本

### 1.7 成就检测

文件：`src/鼠鼠天堂/engine/achievement.ts`

- `checkAchievements(state)` → 遍历未解锁成就，检查条件，返回新解锁列表

**验收**：所有 engine 函数可在控制台手动调用验证，输入 GameState 输出新 GameState，无副作用。

---

## Phase 2: MVU 集成

**目标**：将游戏状态接入酒馆变量系统，实现持久化。

### 2.1 变量结构设计

世界书条目（变量/）：
- `initvar` — 初始变量（调用 createInitialGameState）
- `updatevar` — 变量更新规则（AI 输出如何映射到 GameState 变更）
- `outputvar` — 输出格式（注入 AI 提示词的状态摘要模板）

### 2.2 状态读写桥接

文件：`src/鼠鼠天堂/bridge/state.ts`

- `loadGameState()` → 从 MVU 读取当前 GameState
- `saveGameState(state)` → 写回 MVU
- `getStateForPrompt(state)` → 生成简洁的状态摘要字符串（供 AI 提示词）

### 2.3 记忆按需注入

文件：`src/鼠鼠天堂/bridge/prompt.ts`

- `buildTurnPrompt(state, involvedCharacterIds)` → 组装本回合提示词：
  - 必定部分：资源、鼠鼠简表、天使简表、事件槽位指令
  - 按需部分：涉及角色的个体记忆

**验收**：在酒馆中加载角色卡，变量正确初始化，手动修改变量后 reload 能恢复。

---

## Phase 3: 前端界面

**目标**：React UI 实现所有玩家交互。

### 3.1 全局状态管理

文件：`src/鼠鼠天堂/界面/主界面/store.ts`

用 React Context 或 zustand 管理前端状态：
- 从 MVU 加载 GameState
- 操作分发（dispatch action → engine 函数 → saveGameState）

### 3.2 布局框架

文件：`src/鼠鼠天堂/界面/主界面/App.tsx`

标签页切换布局：总览 | 鼠鼠 | 设施 | 天使 | 事件 | 日志

### 3.3 各标签页组件

按优先级排序：

1. **总览页** `views/Overview.tsx`
   - 资源栏（⚡/✨/💛 + 进度条）
   - 回合数、本回合产能预览
   - "推进回合"按钮

2. **事件页** `views/Events.tsx`（核心交互）
   - 事件卡片列表
   - 每个事件：叙事文本 + 选项按钮（标注资源变化）
   - 选择后显示结果
   - 恶搞选项特殊样式

3. **设施页** `views/Facilities.tsx`
   - 已建造设施卡片（等级、容量、使用者、管理天使）
   - 建造按钮 → 可建造列表（灰显不满足条件的）
   - 升级按钮

4. **鼠鼠页** `views/Hamsters.tsx`
   - 鼠鼠卡片列表（名字、品种、心情条、体力条）
   - 展开详情（性格、故事、偏好）
   - 分配设施 / 互动按钮

5. **天使页** `views/Angels.tsx`
   - 天使卡片（等级、管理设施、技能+冷却）
   - 使用技能 / 互动 / 升级按钮

6. **日志页** `views/Log.tsx`
   - 事件历史、成就进度

### 3.4 样式

Tailwind CSS，在 iframe 内运行，与酒馆样式隔离。温馨治愈风格留到后期让 gemini 美化。先做功能性布局。

**验收**：在酒馆中加载，所有标签页可切换，按钮点击能正确修改 GameState 并刷新显示。

---

## Phase 4: AI 交互回路

**目标**：打通 玩家操作 → AI 生成 → 状态更新 的完整闭环。

### 4.1 同层交互脚本

文件：`src/鼠鼠天堂/脚本/隐藏楼层/index.ts`

隐藏历史楼层，只显示最后一层。

### 4.2 回合推进流程

文件：`src/鼠鼠天堂/界面/主界面/actions/turn.ts`

玩家点击"推进回合"或做出事件选择时：

```
1. applyEventChoice() → 结算玩家选择
2. settleTurn() → 回合结算（产能、体力、心情等）
3. checkAchievements() → 成就检测
4. rollEventSlots() → 决定下回合事件槽
5. buildTurnPrompt() → 组装提示词
6. saveGameState() → 写入 MVU
7. createChatMessages(user) → 静默创建 user 楼层
8. generate() → 调用 LLM
9. 解析 AI 回复 → 提取事件叙事、选项、新鼠鼠数据等
10. 更新 pendingEvents → saveGameState()
11. createChatMessages(assistant) → 静默创建 assistant 楼层
12. 前端刷新
```

### 4.3 AI 回复解析

文件：`src/鼠鼠天堂/bridge/parse.ts`

AI 回复需遵循约定格式（通过提示词约束），代码解析：
- 事件叙事和选项（含资源标注）
- 新鼠鼠数据（收养事件时）
- 记忆摘要文本（写入相关角色记忆）
- 鼠天使 RP 对话内容

### 4.4 个体互动流程

玩家选择"与某角色互动"：
1. 加载该角色记忆
2. 组装互动专用提示词（角色人设+记忆+当前状态）
3. generate() → AI 以该角色视角生成互动场景
4. 解析回复 → 更新心情等 → 追加记忆
5. 保存并刷新

**验收**：完整走通一个回合 — 推进→AI生成事件→玩家选择→结算→下一回合。

---

## Phase 5: 提示词工程

**目标**：撰写角色卡的全部提示词，确保 AI 输出格式稳定、叙事质量达标。

### 5.1 系统提示词

- 世界观设定（乐园背景、基调）
- AI 角色定义（作为"叙事引擎"的职责边界）
- 输出格式约定（事件结构、资源标注格式、标签规范）

### 5.2 鼠天使人设

每位天使的独立人设卡：
- 外表描述、语气特征、口癖
- 性格深度（不是单一标签，要有层次）
- 与其他天使的关系

### 5.3 回合提示词模板

每回合注入的动态提示词模板，slot 由 `buildTurnPrompt()` 填充：
- 当前资源状态
- 鼠鼠简表
- 天使简表+冷却状态
- 事件生成指令（数量、类型、关联角色）
- [按需] 个体记忆

### 5.4 输出格式与解析

定义 AI 回复的结构化标签（如 `<event>`, `<option>`, `<memory>` 等），需与 parse.ts 对齐。反复测试格式稳定性。

### 5.5 摘要提示词

用于酒馆摘要功能，压缩历史对话时保留关键游戏状态信息。

**验收**：多轮对话测试，AI 输出格式合规率 >90%，叙事风格符合温馨治愈基调。

---

## Phase 6: 打磨与分发

### 6.1 数值平衡

- 跑通 50+ 回合，调整资源产出/消耗曲线
- 确保升级节奏符合设计（新手10回合、发展30回合等）
- 恶搞选项的扣除量体感合理

### 6.2 UI 美化

交给 gemini 完成视觉设计，重点：
- 温馨治愈的配色和圆角风格
- 资源条动画
- 事件卡片过渡效果
- 鼠鼠/天使的 emoji 或小图标

### 6.3 角色卡打包

- `pnpm build` 生产构建
- `pnpm sync bundle` 打包角色卡
- 导出到 `release_src/`
- HuggingFace 分发

---

## 阶段依赖关系

```
Phase 0 (数据层)
  ↓
Phase 1 (引擎) ← 可独立验证
  ↓
Phase 2 (MVU集成) ← 需要酒馆环境
  ↓
Phase 3 (前端) + Phase 5 (提示词) ← 可并行
  ↓
Phase 4 (AI交互) ← 需要 Phase 3 + 5 都完成
  ↓
Phase 6 (打磨)
```

Phase 3 和 Phase 5 可以并行推进：前端不依赖具体提示词内容，提示词不依赖 UI 实现。两者在 Phase 4 汇合。