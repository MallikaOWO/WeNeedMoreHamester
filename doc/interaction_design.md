# 互动按钮：选择性提示词发送方案

## 1. 问题分析

### 现状

点击鼠鼠/天使的"互动"按钮时，`interactWithCharacter()` 调用 `sendAndGenerate()`，流程与推进回合完全相同：

```
store.tsx interactWithCharacter()
  → sendAndGenerate(`[与${name}互动]`, state.game)
    → ① saveGameState()
    → ② createChatMessages(user + MVU data)
    → ③ generate({ should_stream: true })  ← 发送全部提示词
    → ④ Mvu.parseMessage()                 ← 解析全部变量更新
    → ⑤ createChatMessages(assistant + parsed data)
  → dispatch(RELOAD)  ← 重载全部状态
```

`generate()` 不带任何 `overrides` 参数，导致 SillyTavern 将以下内容全部发送给 AI：

| 来源 | 内容 | 互动是否需要 |
|------|------|-------------|
| 预设 `身份` | 叙事引擎身份定义 | 需要（部分） |
| 预设 `Auxiliary Prompt` | 世界观描述 | 需要 |
| 预设 `Post-History Instructions` | XML输出格式 + 事件结构规则 | **不需要** |
| 世界书 `变量列表` | EJS 全量状态表 | **不需要** |
| 世界书 `[mvu_update]变量更新规则` | 可更新字段约束 | **不需要**（互动只更新记忆） |
| 世界书 `[mvu_update]变量输出格式` | UpdateVariable/JSONPatch 格式 | **不需要** |
| 世界书 `[天使]棉花/螺丝/星星/泡芙` | 四个天使人设（全部） | **只需目标角色** |
| 世界书 `状态摘要` | EJS 游戏状态 | **不需要**（用简化版替代） |
| 世界书 `事件指令` | EJS 事件生成规则 | **不需要** |

结果：AI 将互动当成回合推进，生成事件、更新变量、改变资源。

### 目标

互动应该是一次轻量的角色对话：
- 只发送目标角色的人设 + 简化状态 + 互动指令
- AI 输出纯角色扮演内容（`<Narrative>`）
- 可选更新角色记忆（`<UpdateVariable>` 仅限 memory 字段）
- 不生成事件，不改变资源/设施/心情等代码管理字段

## 2. API 参考

### 2.1 `generate(config)` — 使用预设 + 覆盖

```typescript
// @types/function/generate.d.ts
declare function generate(config: {
  user_input?: string;
  should_stream?: boolean;
  overrides?: {
    world_info_before?: string;   // 覆盖世界书（角色定义前）
    world_info_after?: string;    // 覆盖世界书（角色定义后）
    char_description?: string;    // 覆盖角色描述
    char_personality?: string;
    scenario?: string;
    dialogue_examples?: string;
    chat_history?: {
      with_depth_entries?: boolean;  // 禁用深度插入的世界书条目
      author_note?: string;
      prompts?: RolePrompt[];
    };
  };
  injects?: {
    role: 'system' | 'assistant' | 'user';
    content: string;
    position: 'in_chat' | 'none';
    depth: number;
    should_scan?: boolean;
  }[];
  max_chat_history?: 'all' | number;
}): Promise<string>;
```

### 2.2 参考实现：`sample_script/预设配置.js` 一键总结

```javascript
// 1. 修改预设状态：启用总结条目，禁用写作任务
await updatePresetWith("in_use", (preset) => {
  for (const p of preset.prompts) {
    if (p.name === "创作日志（大总结）") p.enabled = true;
    else if (p.name === "写作任务定义") p.enabled = false;
  }
});
// 2. 生成
const aiReply = await generate({ user_input: triggerMessage });
// 3. 恢复预设
await updatePresetWith("in_use", (preset) => { /* restore */ });
```

### 2.3 世界书条目激活策略

所有条目均为"蓝灯"（无条件激活），插入位置为"指定深度 0 系统角色"：

```yaml
激活策略:
  类型: 蓝灯
插入位置:
  类型: 指定深度
  角色: 系统
  深度: 0
```

因此 `overrides.chat_history.with_depth_entries = false` 可禁用所有世界书条目。

## 3. 实现方案

### 3.1 核心思路

使用 `generate()` + `overrides` + `injects`：

1. **overrides** 屏蔽所有世界书条目和不需要的预设段
2. **injects** 注入互动专用提示词（角色人设 + 简化状态 + 输出规则）
3. **限制聊天历史**到最近 6 条，减少上下文消耗
4. **响应解析**只提取 Narrative + 记忆更新，忽略其他变量修改

### 3.2 发送给 AI 的最终提示词结构

```
[system] 预设「身份」— 保留（叙事引擎身份，角色扮演职责）
[system] 预设「Auxiliary Prompt」— 保留（世界观上下文）
[system] 预设「Post-History Instructions」— 保留但被 inject 覆盖行为
--- chat_history（最近 6 条，无深度世界书条目）---
[user]   [与棉花互动]
[system] (inject, depth 0) → 互动专用提示词：
         - 互动模式声明
         - 目标角色完整人设（天使YAML / 鼠鼠GameState数据）
         - 简化资源状态
         - 周围角色列表
         - 角色记忆
         - 简化输出规则（Narrative + 可选 memory UpdateVariable）
```

**被排除的内容**：
- 所有世界书条目（10个，通过 `with_depth_entries: false`）
- `char_description`、`char_personality`、`scenario`、`dialogue_examples`（通过 overrides 置空）

### 3.3 generate 调用参数

```typescript
const aiText = await generate({
  should_stream: true,
  max_chat_history: 6,
  overrides: {
    world_info_before: '',
    world_info_after: '',
    char_description: '',
    char_personality: '',
    scenario: '',
    dialogue_examples: '',
    chat_history: {
      with_depth_entries: false,
    },
  },
  injects: [{
    role: 'system',
    content: interactionPrompt,  // buildInteractionSystemPrompt() 输出
    position: 'in_chat',
    depth: 0,
    should_scan: false,
  }],
});
```

### 3.4 Post-History Instructions 冲突处理

预设中的 `Post-History Instructions` 包含事件格式规则（要求生成 2-3 个事件选项），会与互动模式冲突。

**方案 A（推荐，先试）**：依赖 inject 的后置优先级。inject 在 depth 0 插入，出现在 Post-History Instructions 之后，其"禁止生成事件"指令对 LLM 有更高权重。

**方案 B（兜底）**：若方案 A 效果不佳，在 generate 前后用 `updatePresetWith()` 临时禁用/恢复 Post-History Instructions，参照一键总结模式。

## 4. 文件修改清单

### 4.1 新增：`src/鼠鼠天堂/data/angel-personas.ts`

天使人设文本模块。

> **实现说明**：世界书 YAML 文件中含有不规范引号（如 `"……嗯。"开头的` 和连续双引号 `"哎呀哎呀""你猜怎么着！"`），导致 yaml-loader 解析失败。最终采用备选方案：在 `angel-personas.ts` 中直接嵌入人设文本为模板字符串常量。

```typescript
const ANGEL_PERSONAS: Record<string, string> = {
  mianhua: `# 鼠天使 — 棉花（Mianhua）\n...`,
  luosi: `...`,
  xingxing: `...`,
  paofu: `...`,
};

export function getAngelPersonaText(angelId: string): string | null {
  return ANGEL_PERSONAS[angelId] ?? null;
}
```

### 4.2 修改：`src/鼠鼠天堂/bridge/prompt.ts`

增强已有的 `buildInteractionPrompt()`，改名为 `buildInteractionSystemPrompt()`：

```typescript
export function buildInteractionSystemPrompt(
  state: GameState,
  characterId: string,
  angelPersonaText?: string | null,
): string {
  const parts: string[] = [];

  // 模式声明
  parts.push('你正在进行一次角色互动对话（非回合推进）。');
  parts.push('以该角色的视角和语气，与园长进行一段生动的对话互动。');

  // 简化状态
  parts.push('');
  parts.push(`【当前状态】回合${state.turn} ⚡${state.energy}/${state.energyCap} ✨${state.stardust} 💛${state.happiness}`);

  // 目标角色
  const angel = state.angels[characterId];
  const hamster = state.hamsters[characterId];

  if (angel) {
    parts.push('');
    parts.push(`【互动对象：鼠天使 ${angel.name}】`);
    if (angelPersonaText) {
      parts.push(angelPersonaText);  // 完整 YAML 人设
    } else {
      parts.push(`等级：Lv.${angel.level} | 管理方向：${angel.manageDomain}`);
    }
    // 该天使管理的设施
    const managed = Object.entries(state.facilities)
      .filter(([, f]) => f.managedBy === characterId)
      .map(([, f]) => getFacilityDef(f.type)?.name ?? f.type);
    if (managed.length > 0) {
      parts.push(`管理设施：${managed.join('、')}`);
    }
  } else if (hamster) {
    parts.push('');
    parts.push(`【互动对象：鼠居民 ${hamster.name}】`);
    parts.push(`品种：${hamster.breed} | 性格：${hamster.personality}`);
    parts.push(`心情：${hamster.mood} | 体力：${hamster.stamina}`);
    parts.push(`背景：${hamster.story}`);
    // 住所和工作信息
    if (hamster.livingAt) {
      const fac = state.facilities[hamster.livingAt];
      parts.push(`住在：${getFacilityDef(fac?.type)?.name ?? '未知'}`);
    }
  }

  // 周围角色（天使互动时列出鼠鼠，鼠鼠互动时列出附近天使）
  if (angel) {
    const hamsterList = Object.entries(state.hamsters);
    if (hamsterList.length > 0) {
      parts.push('');
      parts.push('【乐园里的鼠居民】');
      for (const [, h] of hamsterList) {
        parts.push(`  ${h.name}(${h.breed}) 性格:${h.personality} 心情:${h.mood}`);
      }
    }
  } else if (hamster) {
    // 列出管理该鼠鼠住所/工作地的天使
    const relevantAngels = new Set<string>();
    if (hamster.livingAt) {
      const mgr = state.facilities[hamster.livingAt]?.managedBy;
      if (mgr) relevantAngels.add(mgr);
    }
    if (hamster.workingAt) {
      const mgr = state.facilities[hamster.workingAt]?.managedBy;
      if (mgr) relevantAngels.add(mgr);
    }
    if (relevantAngels.size > 0) {
      parts.push('');
      parts.push('【附近的天使】');
      for (const aId of relevantAngels) {
        const a = state.angels[aId];
        if (a) parts.push(`  ${a.name}（${a.manageDomain}方向）`);
      }
    }
  }

  // 角色记忆
  const memoryText = getMemoryForPrompt(state, [characterId]);
  if (memoryText) {
    parts.push('');
    parts.push(memoryText);
  }

  // 输出规则
  parts.push('');
  parts.push('【输出规则】');
  parts.push('1. 输出 <Narrative> 标签，包含互动场景描写（2-6句，体现角色性格和语气）');
  parts.push('2. 可选输出 <UpdateVariable>，但仅允许更新记忆字段：');
  parts.push('   - 天使记忆：/angels/{ID}/memory/{key}');
  parts.push('   - 鼠鼠记忆：/hamsters/{ID}/memory/{key}');
  parts.push('3. 禁止：生成事件（pending_events）、修改资源、修改非记忆字段');
  parts.push('4. 记忆key格式：t{回合}_{关键词}，value为一句话描述互动要点');

  return parts.join('\n');
}
```

### 4.3 修改：`src/鼠鼠天堂/界面/主界面/store.tsx`

#### 新增 `interactAndGenerate` 函数

替换 `interactWithCharacter` 中的 `sendAndGenerate` 调用：

```typescript
import { getAngelPersonaText } from '../../data/angel-personas';
import { buildInteractionSystemPrompt } from '../../bridge/prompt';

const interactAndGenerate = useCallback(async (
  characterId: string,
  gameState: GameState,
): Promise<string> => {
  await saveGameState(gameState);
  const baseMvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });

  const character = gameState.hamsters[characterId] || gameState.angels[characterId];
  const name = character?.name ?? characterId;

  // 创建 user 楼层
  await createChatMessages(
    [{ role: 'user', message: `[与${name}互动]`, data: _.cloneDeep(baseMvuData) }],
    { refresh: 'none' },
  );

  // 构建互动专用提示词
  const angelPersona = getAngelPersonaText(characterId);
  const interactionPrompt = buildInteractionSystemPrompt(gameState, characterId, angelPersona);

  let aiText: string;
  try {
    aiText = await generate({
      should_stream: true,
      max_chat_history: 6,
      overrides: {
        world_info_before: '',
        world_info_after: '',
        char_description: '',
        char_personality: '',
        scenario: '',
        dialogue_examples: '',
        chat_history: { with_depth_entries: false },
      },
      injects: [{
        role: 'system',
        content: interactionPrompt,
        position: 'in_chat',
        depth: 0,
        should_scan: false,
      }],
    });
  } catch (e) {
    console.error('[鼠鼠天堂] 互动生成失败:', e);
    const lastId = getLastMessageId();
    if (lastId > 0) await deleteChatMessages([lastId], { refresh: 'none' });
    throw e;
  }

  // 解析响应 — 只允许记忆更新
  const parsedData = await Mvu.parseMessage(aiText, _.cloneDeep(baseMvuData));
  const finalData = parsedData ?? baseMvuData;

  if (parsedData) {
    const base = _.get(baseMvuData, 'stat_data') as any ?? {};
    const final = _.get(finalData, 'stat_data') as any ?? {};

    // 恢复所有顶层代码管理字段
    for (const key of ['energy', 'energyCap', 'stardust', 'turn', 'happiness',
                        'facilities', 'achievements', 'buffs', 'event_flags',
                        'pending_events', 'adoption_proposal']) {
      if (key in base) _.set(finalData, `stat_data.${key}`, base[key]);
    }

    // 鼠鼠：只保留 memory 更新，其余恢复
    for (const id of Object.keys(final.hamsters ?? {})) {
      if (!base.hamsters?.[id]) { delete final.hamsters[id]; continue; }
      for (const field of ['name','breed','personality','story','basePower',
                           'preference','mood','stamina','livingAt','workingAt']) {
        _.set(finalData, `stat_data.hamsters.${id}.${field}`, base.hamsters[id][field]);
      }
    }

    // 天使：只保留 memory 更新，其余恢复
    for (const id of Object.keys(final.angels ?? {})) {
      if (!base.angels?.[id]) { delete final.angels[id]; continue; }
      for (const field of ['name','level','exp','manageDomain','assignedFacility','skills']) {
        _.set(finalData, `stat_data.angels.${id}.${field}`, base.angels[id][field]);
      }
    }
  }

  // 创建 assistant 楼层
  await createChatMessages(
    [{ role: 'assistant', message: aiText, data: finalData }],
    { refresh: 'none' },
  );

  return aiText;
}, []);
```

#### 修改 `interactWithCharacter`

```typescript
const interactWithCharacter = useCallback(async (characterId: string) => {
  if (state.generating) return;
  dispatch({ type: 'SET_GENERATING', generating: true });
  try {
    const aiText = await interactAndGenerate(characterId, state.game);
    dispatch({ type: 'SET_AI_OUTPUT', narrative: parseNarrative(aiText), rawOutput: aiText });
    dispatch({ type: 'RELOAD' });  // 重载以获取记忆更新
  } catch (e) {
    console.error('[鼠鼠天堂] 互动失败:', e);
    dispatch({ type: 'SET_GENERATING', generating: false });
  }
}, [state.game, state.generating, interactAndGenerate]);
```

## 5. 提示词 token 对比

| 场景 | 估算 tokens | 说明 |
|------|------------|------|
| 当前互动（= 推进回合） | ~4000-5000 | 10个世界书条目 + 完整预设 + 全量聊天历史 |
| 改造后互动 | ~800-1500 | 预设(身份+世界观) + inject(人设+状态+规则) + 6条历史 |

节省约 60-70% 的上下文开销。

## 6. 兼容性考量

### 6.1 MVU 数据流

互动消息仍通过 `createChatMessages` 创建并携带 MVU 数据，保持持久化层兼容：
- user 楼层：携带当前 baseMvuData
- assistant 楼层：携带 parsedData（仅记忆字段有变化）

### 6.2 VARIABLE_UPDATE_ENDED 钩子

`脚本/变量结构/index.ts` 中的钩子会在 MVU 更新后运行，执行记忆压缩等操作。互动产生的记忆更新会正确触发此钩子，无需修改。

### 6.3 正则条目

角色卡的正则条目（`[界面]隐藏变量更新`、`[界面]清除叙事标签`）基于 `<Narrative>` 和 `<UpdateVariable>` 标签工作，互动输出使用相同标签，兼容无问题。

### 6.4 聊天历史

互动消息会进入聊天历史。后续推进回合时 AI 会看到互动记录（`max_chat_history: 'all'`），这有利于叙事连续性。互动模式限制 `max_chat_history: 6`，避免拉入过多回合历史。

### 6.5 DOM 隐藏

`隐藏楼层/index.ts` 脚本已将所有非首条消息在 DOM 层面隐藏，用户不会看到互动消息楼层，只通过游戏 UI 的叙事面板查看互动内容。

## 7. 潜在风险与应对

| 风险 | 应对策略 |
|------|---------|
| Post-History Instructions 仍指示AI生成事件 | 方案A：inject 后置覆盖；方案B：`updatePresetWith()` 临时禁用 |
| YAML 导入路径跨目录解析失败 | 备选：在 `data/angels.ts` 中嵌入人设文本常量 |
| AI 仍尝试修改非记忆字段 | 代码层面强制恢复（第4.3节的字段恢复逻辑） |
| 互动记忆积累过快 | 已有 `compressMemory()` 机制（天使20条/鼠鼠15条上限） |

## 8. 验证方法

1. **构建验证**：`pnpm build` 通过
2. **功能验证**（MCP Chrome iframe）：
   - 点击天使"互动"按钮，确认 AI 输出为角色对话而非事件列表
   - 检查互动后 `stat_data` 只有记忆字段变化
   - 确认能源/星尘/心情等资源未被修改
3. **console 验证**：
   - 在 `interactAndGenerate` 入口添加 `console.log('[互动模式]')` 确认走新分支
   - 对比 `baseMvuData` 和 `finalData` 确认只有 memory 字段差异
4. **回归验证**：互动后推进回合，确认正常生成事件、正常结算
