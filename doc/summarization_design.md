# 叙事自动总结与历史消息隐藏 — 实现方案

## 1. 问题背景

随着回合推进，AI 消息中的 `<Narrative>` 叙事内容不断累积，膨胀上下文。MVU 变量更新部分（`<UpdateVariable>`）已通过正则从 prompt 隐藏，但叙事文本仍全量发送。需要每 20 回合自动总结叙事，隐藏旧消息楼层，并通过正则清理无用的用户输入。

### 关键发现

- `buildTurnPrompt` 是死代码（仅定义未调用），实际回合提示词由 EJS 世界书模板 `状态摘要.txt` 生成
- 已有正则：隐藏 `<UpdateVariable>` 从 prompt+display，隐藏 `<Narrative>` 标签仅从 display
- 记忆系统已有压缩（仓鼠 15 条/天使 20 条上限），无需额外处理
- 互动系统已验证 `generate()` + `overrides` + `injects` 的选择性发送模式可行

## 2. Schema 新增字段（三层同步）

**`src/鼠鼠天堂/schema.ts`** — Schema 对象内新增：

```typescript
// [代码] 叙事总结
narrative_summary: z.string().prefault(''),
last_summary_turn: z.coerce.number().transform(v => Math.max(0, Math.round(v))).prefault(0),
```

**`鼠鼠天堂/世界书/变量/initvar.yaml`** — 末尾新增：

```yaml
narrative_summary: ""
last_summary_turn: 0
```

**`src/鼠鼠天堂/data/init.ts`** — `createInitialGameState()` 返回值新增：

```typescript
narrative_summary: '',
last_summary_turn: 0,
```

## 3. 新建总结引擎模块

**新文件 `src/鼠鼠天堂/engine/summarize.ts`**

三个纯函数：

### extractNarratives

```typescript
extractNarratives(messages: ChatMessage[]): {turn: number, text: string}[]
```

- 遍历 assistant 消息，用正则提取 `<Narrative>` 内容
- 从对应 user 消息提取回合号（匹配 `[推进到回合 N]`）
- 互动消息的叙事也一并提取（标注为"互动"而非回合号）

### buildSummarizationPrompt

```typescript
buildSummarizationPrompt(
  prevSummary: string,
  lastSummaryTurn: number,
  narratives: {turn: number, text: string}[]
): string
```

组装总结提示词（见第 7 节提示词设计）。

### parseSummaryResponse

```typescript
parseSummaryResponse(aiText: string): string | null
```

从 AI 输出提取 `<Summary>...</Summary>` 标签内容。

## 4. store.tsx 集成

### 触发时机

在 `advanceTurnAndGenerate` 的 `sendAndGenerate` 之后、`RELOAD` 之前：

```typescript
if (game.turn > 0 && game.turn % 20 === 0) {
  try {
    await summarizeAndHide(game);
  } catch (e) {
    console.error('[鼠鼠天堂] 叙事总结失败（不影响游戏继续）:', e);
  }
}
```

### summarizeAndHide 流程

1. **收集叙事**：`getChatMessages('0-' + getLastMessageId(), {role: 'all', hide_state: 'unhidden'})` 获取所有未隐藏消息，用 `extractNarratives` 提取叙事片段
2. **跳过检查**：如果无叙事片段，直接返回
3. **组装提示词**：`buildSummarizationPrompt(state.narrative_summary, state.last_summary_turn, narratives)`
4. **AI 生成总结**：

```typescript
const summaryText = await generate({
  should_stream: false,
  max_chat_history: 0,
  overrides: {
    world_info_before: '', world_info_after: '',
    char_description: '', char_personality: '',
    scenario: '', dialogue_examples: '',
    chat_history: { with_depth_entries: false },
  },
  injects: [{
    role: 'system', content: summarizationPrompt,
    position: 'in_chat', depth: 0, should_scan: false,
  }],
});
```

5. **解析结果**：`parseSummaryResponse(summaryText)` 提取 `<Summary>` 内容
6. **更新状态**：将总结写入 `state.narrative_summary`，更新 `state.last_summary_turn`，保存到 MVU
7. **隐藏旧消息**：用 `setChatMessages` 隐藏总结范围内的旧楼层（保留 message 0、message 1、最近 2 条消息）
8. **清理临时消息**：总结生成会产生 user+assistant 消息，使用 `should_silence: true` 或生成后立即删除

### 字段保护

在 `interactAndGenerate` 和 `sendAndGenerate` 的保护字段列表中加入 `narrative_summary` 和 `last_summary_turn`。

## 5. EJS 模板注入总结

**修改 `鼠鼠天堂/世界书/回合/状态摘要.txt`**，在 `</game_state>` 之前加入：

```ejs
<% var narrativeSummary = getvar('stat_data.narrative_summary', {defaults: ''}); _%>
<% if (narrativeSummary) { _%>

<narrative_history>
<%= narrativeSummary %>
</narrative_history>
<% } _%>
```

AI 生成新回合内容时能看到历史叙事摘要，保持叙事连续性。

## 6. 正则规则

**修改 `鼠鼠天堂/鼠鼠天堂.yaml`**，在 `扩展字段.正则` 中新增：

### 规则 1：隐藏回合推进消息（从 prompt）

```yaml
- 正则名称: "[提示词]隐藏回合推进消息"
  id: e83g3fgh-cc73-6d48-bdf9-47ihc7516657
  启用: true
  查找表达式: \[推进到回合\s*\d+\]
  内容: ""
  来源:
    用户输入: true
    AI输出: false
  作用于:
    仅格式显示: false
    仅格式提示词: true
```

### 规则 2：隐藏互动消息（从 prompt）

```yaml
- 正则名称: "[提示词]隐藏互动消息"
  id: f94h4ghi-dd84-7e59-ceg0-58jid8627768
  启用: true
  查找表达式: \[与.+?互动\]
  内容: ""
  来源:
    用户输入: true
    AI输出: false
  作用于:
    仅格式显示: false
    仅格式提示词: true
```

## 7. 总结提示词设计

```
你是"鼠鼠天堂"的叙事摘要引擎。请将以下叙事片段整合为一份简洁的前情提要。

规则：
- 保留：重大事件（收养、建造、升级、特殊事件）、玩家的选择及其后果、角色之间的关系变化
- 省略：日常琐碎细节、纯数值变动描述、已记录到角色记忆中的内容
- 格式：按时间段落组织，用「回合X-Y」标注时间范围
- 长度：不超过800字
- 输出用 <Summary> 标签包裹，标签外不要输出其他内容
- 所有内容使用中文

{如果有上次摘要:}
【上次摘要（回合1-{last_summary_turn}）】
{previous_summary}

【新叙事片段（回合{start}-{end}）】
回合{N}: {narrative_text}
回合{M}: {narrative_text}
...

请输出整合后的完整摘要：
```

## 8. 消息隐藏策略

总结完成后：

- **保留不隐藏**：message 0（initvar/UI）、message 1（持久化层）、最近 2 条消息（当前回合的 user+assistant）
- **隐藏**：其余所有 message 2 ~ (lastMessageId - 2) 范围内的消息
- 已隐藏的消息不会重复处理（`getChatMessages` 用 `hide_state: 'unhidden'` 过滤）
- `setChatMessages` 批量设置 `is_hidden: true`，`refresh: 'none'`

## 9. 边界情况

- **前 20 回合**：不触发总结，`narrative_summary` 为空，EJS 模板跳过注入
- **总结失败**：try/catch 包裹，失败不影响游戏继续，下次触发时重试
- **无叙事内容**：跳过总结流程
- **累积增长控制**：每次总结替换（非追加）上次摘要，AI 被要求产出 ≤800 字的整合版本
- **总结过程的临时消息**：使用 `should_silence: true` 避免产生可见消息，或生成后立即删除

## 10. 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/鼠鼠天堂/schema.ts` | 修改 | 新增 narrative_summary, last_summary_turn |
| `src/鼠鼠天堂/data/init.ts` | 修改 | 三层默认值同步 |
| `鼠鼠天堂/世界书/变量/initvar.yaml` | 修改 | 三层默认值同步 |
| `src/鼠鼠天堂/engine/summarize.ts` | 新建 | 叙事提取、提示词组装、响应解析 |
| `src/鼠鼠天堂/界面/主界面/store.tsx` | 修改 | 新增 summarizeAndHide，集成到回合流程，保护新字段 |
| `鼠鼠天堂/世界书/回合/状态摘要.txt` | 修改 | 注入 narrative_summary |
| `鼠鼠天堂/鼠鼠天堂.yaml` | 修改 | 新增 2 条正则规则 |

## 11. 验证方式

1. `pnpm build` 构建通过
2. 开新游戏，推进 20 回合后观察：
   - Console 输出总结日志
   - 旧消息楼层被隐藏
   - 新回合 AI 输出仍保持叙事连续性
3. 检查 MVU 数据中 `narrative_summary` 字段已填充
4. 推进到 40 回合确认累积总结正常工作
