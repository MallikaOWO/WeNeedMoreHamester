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
4. saveGameState() → 写入 MVU
5. createChatMessages(user) → 静默创建 user 楼层（包含动态提示词）
6. generate() → 调用 LLM
7. AI 输出 <UpdateVariable><JSONPatch> → MVU 自动解析更新 stat_data
8. VARIABLE_UPDATE_ENDED 事件触发 → 引擎后处理结算
9. 前端刷新
```

### 4.3 AI 回复解析

AI 回复使用标准 MVU `<UpdateVariable><JSONPatch>` 格式，由 MVU 框架自动解析并更新 `stat_data`。代码通过 `VARIABLE_UPDATE_ENDED` 事件钩子获取更新后的 GameState，执行引擎结算（产能、体力、成就等）。不需要自定义 XML 解析器。

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

**目标**：撰写全部提示词，确保 AI 输出格式稳定、叙事质量达标。

提示词分布在三个位置：
- **预设**（`空白预设/空白预设.yaml`）— 身份定义、全局指令等与角色卡无关的系统级提示词
- **角色卡世界书**（`鼠鼠天堂/鼠鼠天堂.yaml` 的条目）— 鼠天使人设、MVU 变量规则、输出格式等与角色卡绑定的内容
- **提示词模板**（EJS 语法）— 世界书条目中使用，根据 MVU 变量动态生成提示词内容

预设结构说明：预设负责将人设、世界书、系统提示词、聊天记录组合成最终发送给 AI 的 prompt。以 `id:` 开头的条目（如 `id: 角色定义之前`、`id: 聊天记录`）是酒馆内置的不可修改项，对应角色卡中提取的内容；自定义的 `名称:` 条目可自由编辑。

提示词模板说明（参考 `doc/提示词模板用法.md`）：在世界书条目中使用 EJS 语法，通过 `getvar()` 读取 MVU 变量，实现全蓝灯世界书下的动态提示词。例如：
```
<% if (getvar('stat_data.turn', { defaults: 0 }) > 10) { %>
乐园已进入发展期，事件可以更复杂。
<% } %>
```
变量路径对应 `stat_data` 下的 GameState 字段（如 `stat_data.energy`、`stat_data.hamsters` 等）。

### 5.1 预设：系统提示词

文件：`空白预设/空白预设.yaml` → `提示词` 列表中的自定义条目

- **身份**（已有占位）：AI 作为"鼠鼠天堂叙事引擎"的职责边界、输出规范
- **Auxiliary Prompt**（已有空位）：世界观背景、基调约定
- **Post-History Instructions**（已有空位）：每轮末尾提醒（格式合规、资源上限等）

### 5.2 世界书：鼠天使人设

角色卡世界书新增条目，每位天使的独立人设卡：
- 外表描述、语气特征、口癖
- 性格深度（不是单一标签，要有层次）
- 与其他天使的关系
- 插入位置：角色定义之前，按需激活（关键词或蓝灯）

### 5.3 世界书：动态回合提示词

世界书条目使用提示词模板（EJS），根据 MVU 变量动态生成每回合注入的内容：
- 当前资源状态（从 `stat_data.energy/stardust/happiness` 读取）
- 鼠鼠简表（遍历 `stat_data.hamsters`）
- 天使简表+冷却状态（遍历 `stat_data.angels`）
- 事件生成指令（数量、类型、关联角色）
- 按回合阶段切换提示词（如 `stat_data.turn > 10` 时引入更复杂事件）
- [按需] 个体记忆

注意：此处的提示词模板替代了 Phase 2 中 `buildTurnPrompt()` 的部分职责 — 静态提示词模板用 EJS 在世界书中实现，`buildTurnPrompt()` 仍负责 Phase 4 中通过代码动态组装的部分（如事件槽位指令）。

### 5.4 世界书：变量更新规则与输出格式

使用标准 MVU 格式，AI 通过 `<UpdateVariable><JSONPatch>` 更新 `stat_data`：
- `变量更新规则` — 告知 AI 各字段含义、路径、取值范围，指导 AI 生成正确的 JSONPatch 操作
- `变量输出格式` — 定义 `<UpdateVariable><Analysis>...</Analysis><JSONPatch>[...]</JSONPatch></UpdateVariable>` 标准格式
- 所有游戏内容（事件叙事、选项、新鼠鼠、记忆等）都是 `stat_data` 中的字段，通过 JSONPatch 更新
- Schema.ts 的 Zod 校验自动修正越界值（如 `z.transform(v => _.clamp(v, 0, 100))`），AI 不需要精确计算边界

### 5.5 预设：摘要提示词

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

---

## 工作记录

### Phase 0 ✅

- `src/鼠鼠天堂/schema.ts` — zod v4 定义 GameState 及所有子类型，导出 `Schema` 供 dump 和 MVU 使用，导出各类型的 TS type
- `src/鼠鼠天堂/data/` — 6 个静态数据文件：
  - `skills.ts`(8技能，每天使2个) → `angels.ts`(4预设+???，`getStarterAngels()`) → `facilities.ts`(13设施，含升级费用计算) → `achievements.ts`(8成就，含 check 函数) → `breeds.ts`(8品种) → `personalities.ts`(8性格，3个有偏好设施关联)
- `src/鼠鼠天堂/data/init.ts` — `createInitialGameState()` → ⚡50/100 ✨0 💛70 回合0 4天使Lv.1
- `pnpm dump` → `schema.json` 生成正常（需 `node --experimental-strip-types` 或 `tsx`，原始 `node dump_schema.ts` 在当前环境报错）

### Phase 1 ✅

`src/鼠鼠天堂/engine/` 7个模块，全部纯函数 GameState→GameState：

- `turn.ts` — `settleTurn`: 设施产能(等级×偏好×心情乘数)、体力消耗(15/回合，≤20自动回窝)、休息恢复(20，食堂×1.5)、生活设施心情回复、星尘祭坛(2/回合)、全局心情=平均值
- `facility.ts` — `canBuild/buildFacility`(自动分配同方向空闲天使)、`canUpgrade/upgradeFacility`(天使等级门槛)、`assignAngelToFacility`
- `angel.ts` — `canLevelUp`(星尘+设施等级前提：Lv2需管理设施,Lv3需Lv2设施,Lv4需2个Lv3,Lv5需全部Lv3+)、`levelUpAngel`、`useSkill`(8种effectType分支)、`tickCooldowns`
- `hamster.ts` — `adoptHamster`(费用15⚡，住所容量检查)、`assignHamster/unassignHamster`
- `event.ts` — `rollEventSlots`(2-3个，日常50%/机遇30%/挑战15%/特殊5%)、`applyEventChoice`(资源变更+心情，支持全局/指定角色)、`validateEventOptions`(负面≤10%当前资源)
- `memory.ts` — `appendMemory/compressMemory`(鼠鼠15条上限，天使20条，保留important)、`getMemoryForPrompt`(格式化输出)、`appendMemoryToState`
- `achievement.ts` — `checkAchievements` → 返回新解锁列表+发放星尘奖励

集成验证跑通完整流程：建造→收养→分配→结算→事件→记忆→成就→技能→Schema校验PASSED。

### Phase 2 ✅

MVU 集成，关键设计：**AI 使用标准 `<UpdateVariable><JSONPatch>` 格式更新变量**，Schema.ts 通过 Zod 校验保证数据正确性，代码在 `VARIABLE_UPDATE_ENDED` 钩子中执行游戏引擎结算。

角色卡目录 `鼠鼠天堂/`：
- `世界书/变量/initvar.yaml` — 初始状态 YAML（与 createInitialGameState 一致）
- `世界书/变量/变量列表.txt` — `{{format_message_variable::stat_data}}`
- `世界书/变量/变量更新规则.yaml` — 告知 AI 各字段含义、路径、取值范围，指导生成正确的 JSONPatch
- `世界书/变量/变量输出格式.yaml` — 定义标准 `<UpdateVariable><Analysis>...<JSONPatch>[...]</JSONPatch></UpdateVariable>` 格式
- `鼠鼠天堂.yaml` — 添加世界书条目（initvar/列表/规则/输出格式）+ 脚本库（MVU/变量结构）

源码 `src/鼠鼠天堂/`：
- `脚本/MVU/index.ts` — 加载 MVU 框架
- `脚本/变量结构/index.ts` — `registerMvuSchema(Schema)`
- `bridge/state.ts` — `loadGameState`(从MVU读取+Schema.parse) / `saveGameState`(写回MVU) / `getStateForPrompt`(资源+角色简表+设施简表)
- `bridge/prompt.ts` — `buildTurnPrompt`(状态+事件指令+按需记忆) / `buildInteractionPrompt`(角色互动专用)

所有 URL 已从 localhost 改为 jsdelivr CDN (`testingcf.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester/dist/0.0.0/...`)。
webpack 构建通过，脚本输出到 `dist/0.0.0/鼠鼠天堂/脚本/`。

### Phase 3 ✅

React 前端界面，运行在 SillyTavern iframe 内。

`src/鼠鼠天堂/界面/主界面/`：
- `store.tsx` — React Context + useReducer 全局状态管理，自动从 MVU 加载/保存 GameState，所有操作通过 dispatch action 调用 engine 函数；加载失败时 fallback 到初始状态
- `App.tsx` — 6 标签页切换布局（总览|鼠鼠|设施|天使|事件|日志）
- `styles.css` — Tailwind CSS 4 入口 + 功能性基础样式（卡片、进度条、标签栏、按钮、资源变化标注）
- `index.tsx` — 引入 styles.css，挂载 React 到 #root
- `views/Overview.tsx` — 资源栏(⚡/✨/💛进度条)、回合数、产能预览、待处理事件提示、推进回合按钮
- `views/Events.tsx` — 事件卡片列表、选项按钮(标注资源delta)、恶搞选项虚线边框
- `views/Facilities.tsx` — 已建设施卡片(等级/容量/管理天使)、建造面板(按类别分组，灰显不满足条件)、升级按钮
- `views/Hamsters.tsx` — 鼠鼠卡片(心情/体力进度条)、展开详情(故事/偏好/记忆)、分配到设施选择器
- `views/Angels.tsx` — 天使卡片(等级/领域/管理设施)、技能按钮(冷却/锁定状态)、需目标选择的技能弹出面板、升级按钮
- `views/Log.tsx` — 成就进度(8/8列表带解锁状态)、事件日志(按回合倒序，带类型图标)

修复：`loadGameState` 改用 `safeParse` 避免校验失败阻塞加载；store catch 块增加 fallback dispatch。

已知限制：Phase 3 阶段无 AI 交互，对话停留在 message 0，变量在重载时被 `<initvar>` 覆盖，持久化需 Phase 4 创建新消息楼层后解决。

### Phase 5 ✅

提示词工程，分布在预设 + 世界书 + 提示词模板（EJS）三个位置。

预设 `空白预设/空白预设.yaml`：
- **身份** — AI 作为叙事引擎的职责（生成事件/RP天使/生成新鼠鼠/维护记忆连续性）+ 不做的事（不输出变量更新/不自行结算/不跳出治愈基调）+ 叙事风格（温馨幽默、第三人称、2-4句简洁叙事）
- **Auxiliary Prompt** — 世界观（云朵乐园、快乐电力、星尘资源）
- **Post-History Instructions** — 回复检查清单（8项：UpdateVariable/JSONPatch格式、选项标注、memory字段、StatusPlaceHolderImpl占位符等）— ⚠️ 待更新为标准MVU格式描述
- **摘要提示词** — 压缩对话时保留重大事件/选择后果/角色关系，省略重复日常/纯数值变动

世界书 `鼠鼠天堂/鼠鼠天堂.yaml` 新增条目：
- `世界书/天使人设/` — 4位天使独立人设（外表/性格表里层/口癖语气/与其他天使关系/管理风格）：棉花(温柔治愈)、螺丝(暴躁认真)、星星(神秘安静)、泡芙(话多乐天)
- `世界书/回合/状态摘要.txt` — EJS 模板，用 `getvar('stat_data.*')` 动态生成资源/鼠鼠/天使/设施简表
- `世界书/回合/事件指令.txt` — EJS 模板，按回合阶段(≤3新手引导/≤10新手期/≤30发展期/30+成熟期)生成不同事件指令，含新鼠鼠属性范围和资源扣除上限

角色卡 yaml 注册了全部新条目：天使人设文件夹(4条目，蓝灯，角色定义之前)、回合文件夹(状态摘要+事件指令，蓝灯，指定深度0)。