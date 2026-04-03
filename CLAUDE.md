# 鼠鼠天堂 — 项目指南

## 项目概述

SillyTavern 同层前端经营游戏角色卡。玩家管理一座收养被遗弃宠物鼠的梦幻乐园。

技术栈：React 19 + TypeScript + Zod v4 + Tailwind CSS 4 + Webpack 5，运行在 SillyTavern iframe 中。

## 关键架构

### 三层分离

- **引擎层** `src/鼠鼠天堂/engine/` — 纯函数 `GameState → GameState`，无副作用
- **桥接层** `src/鼠鼠天堂/bridge/` — 连接引擎与酒馆 MVU 变量系统
- **界面层** `src/鼠鼠天堂/界面/主界面/` — React UI，运行在 iframe 内

### MVU 变量系统

- 游戏状态存储在 MVU 的 `stat_data` 字段中，绑定到消息楼层
- **AI 使用标准 MVU 格式更新变量**：`<UpdateVariable><Analysis>...</Analysis><JSONPatch>[...]</JSONPatch></UpdateVariable>`
  - AI 输出 JSONPatch 操作（replace/add/remove），MVU 框架自动应用到 `stat_data`
  - 所有游戏内容（事件叙事、选项、新鼠鼠数据、记忆等）都作为 `stat_data` 的字段通过 JSONPatch 更新
  - 叙事文本就是 JSONPatch 中的字符串值，不需要自定义 XML 标签
- **Schema.ts 保证数据正确性**：使用 Zod v4 的 `z.coerce.number()`、`z.transform(v => _.clamp(v, min, max))`、`z.prefault()` 等特性，AI 输出经 schema 校验后自动修正为合法值
- **`Mvu.parseMessage(message, old_data)`**：解析 AI 输出中的 UpdateVariable 标签，返回更新后的变量对象（不自动写入）
- **`VARIABLE_UPDATE_ENDED` 事件**：MVU 变量更新完成后触发，代码在此钩子中执行游戏引擎结算（产能、体力、成就等）
- Message 0 的变量在重载时会被 `<initvar>` 覆盖，持久化数据需保存在 message 1+ 上
- Schema 约定：优先用 `z.record()` 而非 `z.array()`（键值对天然幂等），操作必须幂等（重复执行结果不变）

### 提示词分布

提示词分布在三个位置，分工明确：

- **预设**（`空白预设/空白预设.yaml`）— 系统级提示词：身份定义、全局指令、摘要规则
  - 以 `id:` 开头的条目是酒馆内置不可修改项（角色定义之前/之后、聊天记录等）
  - 自定义 `名称:` 条目可自由编辑
- **角色卡世界书**（`鼠鼠天堂/鼠鼠天堂.yaml`）— 角色卡绑定的内容：鼠天使人设、MVU 变量规则、输出格式
- **提示词模板**（EJS 语法，用于世界书条目内）— 根据 MVU 变量动态生成提示词
  - 通过 `getvar('stat_data.字段', { defaults: 默认值 })` 读取 GameState
  - 用 `<% if/for %>` 实现条件/循环，全蓝灯世界书下实现动态内容
  - 参考：`doc/提示词模板用法.md`

### CDN 分发

所有运行时资源通过 jsdelivr CDN 引用：
`https://testingcf.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester/dist/0.0.0/...`

## 目录结构

```
空白预设/空白预设.yaml        — 预设配置（系统提示词、AI参数）
鼠鼠天堂/                    — 角色卡产物目录（tavern_sync 输出）
  鼠鼠天堂.yaml              — 角色卡主配置（世界书条目、正则、脚本库）
  世界书/变量/                — MVU 变量相关世界书条目
  第一条消息/                 — 首条消息（加载前端界面）
src/鼠鼠天堂/                — 源码
  schema.ts                  — Zod 类型定义（GameState 及子类型）
  data/                      — 静态数据表（天使/设施/技能/成就/品种/性格）
  engine/                    — 游戏引擎（回合结算/建造/天使/鼠鼠/事件/记忆/成就）
  bridge/                    — MVU 桥接（状态读写/提示词组装）
  界面/主界面/               — React 前端（store/App/6个标签页视图）
  脚本/                      — 酒馆脚本（MVU加载/变量结构注册）
doc/                         — 设计文档和工作流
```

## 构建命令

- `pnpm build` — 生产构建
- `pnpm build:dev` — 开发构建
- `pnpm watch` — 开发监听模式
- `pnpm dump` — 生成 schema.json
