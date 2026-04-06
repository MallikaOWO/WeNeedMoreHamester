# 界面美化方案：从「卡片瀑布流」到「轻量手游」

## 现状问题分析

### 1. 配色不统一

当前 CSS 变量定义了一组马卡龙色系（奶酪黄、薄荷绿、西柚红、草莓粉），但各视图中大量硬编码了与主题无关的颜色：

- Overview 产能明细用 `#10B981`（Tailwind green-500），Buff 区用 `#166534`/`#15803d`/`#bbf7d0`（绿色系），与主题的暖色调脱节
- Events 用 `#b45309`/`#d97706`（琥珀色），Angels 用 `#DDD6FE`/`#EDE9FE`（紫色系），各自为政
- `guide-card` 用 `#F2F9F8`/`#4A7A76`（冷色），与暖底色 `#FFFDFB` 不协调
- 正值/负值颜色 `.delta-pos`(#5CB8A1) 和 `.delta-neg`(#F07A65) 与主题四色都不匹配

### 2. 间距和圆角过大

- `--radius-lg: 20px` 在移动端宽度下（max-width 500px）显得过于圆润，浪费空间
- `.card` 默认 `margin-bottom: 16px`，加上 `padding: 16px`，在每两个信息块之间形成 48px+ 的视觉断裂
- 建造列表中每个蓝图又是独立 `.card`，嵌套圆角+间距导致信息密度极低
- 按钮的 `border-radius: 12px` 和推进回合按钮的 `border-radius: 24px` 让 UI 看起来像 iOS 设置页而非游戏

### 3. 设施页缺乏成就感

当前设施页是纯列表：每个设施一张白色卡片，信息平铺。问题：
- 没有视觉层次区分已建/可建
- 建造成功后没有任何视觉反馈（新设施就是多了一张和其他完全一样的白卡）
- 设施之间没有空间关系，感觉不到「乐园在成长」
- Lv 标签淹没在文字中，升级带来的变化不直观

---

## 方案一：配色统一

### 原则

从现有四色（能源黄、星尘绿、心情红、幸福粉）派生所有 UI 颜色，杜绝硬编码。新增语义色变量，限制总色板。

### 新增 CSS 变量

```css
:root {
  /* 主题四色 — 保持不变 */
  --color-energy: #FFC454;
  --color-stardust: #6DD0C8;
  --color-mood: #FF9595;
  --color-happiness: #F68CB0;

  /* 从主题色派生的功能色 */
  --color-positive: #6DD0C8;     /* = stardust，正面反馈 */
  --color-negative: #FF9595;     /* = mood，负面反馈 */
  --color-warning: #FFC454;      /* = energy，警告/待处理 */
  --color-accent: #F68CB0;       /* = happiness，强调/CTA */

  /* 派生浅底色（用于区块背景） */
  --color-energy-bg: #FFF8E8;    /* energy 10% */
  --color-stardust-bg: #EEFAF8;  /* stardust 10% */
  --color-mood-bg: #FFF0F0;      /* mood 10% */
  --color-happiness-bg: #FFF5F8; /* happiness 10% */

  /* 中性色 — 保持暖调 */
  --color-bg: #FFFDFB;
  --color-card-bg: #FFFFFF;
  --color-surface: #FAF6F4;      /* 次级表面（替代各处的 rgba(0,0,0,0.02)） */
  --color-border: #F2E9E6;
  --color-border-strong: #E6D8D4;
  --color-text: #4A3F3D;
  --color-text-muted: #8A7B78;
  --color-text-light: #B5A8A4;   /* 极弱文字 */
}
```

### 替换规则

| 当前硬编码 | 替换为 | 位置 |
|-----------|--------|------|
| `#10B981`, `#22c55e`, `#166534` 等绿色 | `var(--color-positive)` | Overview 产能正值、Buff 面板 |
| `#ef4444`, `#dc2626`, `#F07A65` 等红色 | `var(--color-negative)` | Overview 负值、Events 警告 |
| `#b45309`, `#d97706`, `#FDE68A` 等琥珀色 | `var(--color-warning)` + `var(--color-energy-bg)` | Events 待处理、Log 成就 |
| `#DDD6FE`, `#EDE9FE`, `#F5F3FF` 等紫色 | `var(--color-stardust-bg)` + `var(--color-stardust)` | Angels 技能面板 |
| `#eff6ff`, `#3b82f6`, `#1e40af` 等蓝色 | `var(--color-stardust)` + `var(--color-stardust-bg)` | guide-card |
| `#f0fdf4`, `#dcfce7`, `#bbf7d0` 绿色渐变 | `var(--color-stardust-bg)` | Buff 面板底色 |
| `rgba(0,0,0,0.02)`, `#F3F4F6`, `#F9FAFB` | `var(--color-surface)` | 各处次级背景 |

### guide-card 和 silly-option 重新定义

```css
.guide-card {
  background: var(--color-stardust-bg);
  border-color: var(--color-stardust);
  color: var(--color-text);
}

.silly-option {
  border: 1px dashed var(--color-energy);
  background: var(--color-energy-bg);
}
```

### delta 标注统一

```css
.delta-pos { color: var(--color-positive); font-weight: bold; }
.delta-neg { color: var(--color-negative); font-weight: bold; }
```

---

## 方案二：从瀑布流到轻量手游布局

### 核心思路

参考的手游 UI 模式：**固定头部状态栏 + 紧凑内容区 + 底部操作区**。不是把所有信息塞进卡片然后纵向堆叠，而是用「区域」和「分隔线」组织信息，减少卡片嵌套。

### 2.1 全局布局调整

```
┌──────────────────────────────┐
│  [资源条] ⚡46 ✨187 💝70    │  ← 固定在顶部，始终可见
│  ░░░░░░░  ████████  ░░░░░░░  │
├──────────────────────────────┤
│  [Tab 栏]                    │
├──────────────────────────────┤
│                              │
│  [内容区 - 可滚动]            │
│                              │
│                              │
├──────────────────────────────┤
│  [底部操作按钮]               │  ← 推进回合 / 建造 等主 CTA
└──────────────────────────────┘
```

**变更点：**
- 资源栏从 Overview 内部提取到 App 级别，所有 Tab 页都能看到资源
- Tab 栏紧贴资源栏下方
- 推进回合按钮在总览页固定在底部（`position: sticky; bottom: 0`）
- `max-width` 保持 500px，但内部 `padding` 从 `16px 12px` 收紧为 `12px 10px`

### 2.2 圆角和间距收紧

```css
:root {
  --radius-lg: 14px;   /* 从 20px 降低 */
  --radius-md: 10px;   /* 从 12px 降低 */
  --radius-sm: 6px;    /* 新增，用于小元素 */
}

.card {
  padding: 12px;           /* 从 16px 收紧 */
  margin-bottom: 10px;     /* 从 16px 收紧 */
  border-radius: var(--radius-lg);
}

.card:hover {
  transform: none;         /* 移除 hover 上浮，手游不需要这个 */
  box-shadow: var(--shadow-soft);
}
```

### 2.3 信息密度提升

**资源显示**：横排紧凑条，不是每个资源独占一行

```
⚡ 能源 46/100 [████████░░░░] ✨ 星尘 187 💝 70/100 [██████████░░]
```

改为三列横排，每列：图标 + 数值 + 细进度条。省掉中文标签（图标自说明）。

**回合信息**：从大字居中改为左对齐单行

```
回合 23  ·  🐹×3  🏠×5  😇×2
```

**叙事面板**：保留但去掉装饰性元素（绝对定位的 ✨、text-shadow），行高从 1.8 降到 1.6。

**产能预估**：内联到资源栏下方，不独占卡片

```
下回合: ⚡+12(产24-维护12)  💝-3   [明细 ▼]
```

### 2.4 Tab 栏样式

当前胶囊式 tab 栏占用较多高度。改为更紧凑的下划线式：

```css
.tab-bar {
  display: flex;
  gap: 0;
  background: transparent;
  border-bottom: 2px solid var(--color-border);
  padding: 0;
  margin-bottom: 12px;
}

.tab-btn {
  flex: 1;
  padding: 8px 4px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.tab-btn.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
```

### 2.5 按钮风格

去掉 `box-shadow: 0 6px 0` 的立体按钮效果（那是端游风格），改为扁平+微妙底色区分：

```css
.btn-primary {
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  box-shadow: none;
}

.btn-primary:active:not(:disabled) {
  background: #E87CA0;
  transform: scale(0.97);
}
```

推进回合按钮：不需要 `border-radius: 24px` 和 `box-shadow: 0 6px 0 #D14D8E`，和普通 btn-primary 同样风格，只是 `width: 100%` + 稍大字号。

---

## 方案三：设施页重设计 — 「乐园地图」概念

### 问题

纯列表无法传达「我建造了一个乐园」的成就感。但没有美术素材，不能做真正的地图。

### 方案：网格化设施卡 + 类别分区 + 视觉密度

#### 3.1 从列表到网格

将设施从纵向列表改为 **2列网格**（手机屏幕下 500px 容器内每列约 230px，刚好放得下紧凑卡片）。

```
┌─────── 玩耍区 🎡 ───────┐
│ ┌──────┐  ┌──────┐      │
│ │仓鼠轮│  │滑梯  │      │
│ │Lv.2  │  │Lv.1  │      │
│ │🐹×2  │  │🐹×1  │      │
│ └──────┘  └──────┘      │
├─────── 生活区 🏠 ───────┤
│ ┌──────┐  ┌──────┐      │
│ │木屋  │  │高级窝│      │
│ │Lv.1  │  │Lv.2  │      │
│ │🐹×2  │  │🐹×3  │      │
│ └──────┘  └──────┘      │
├─────── 功能区 ⚙️ ───────┤
│ ┌──────┐                │
│ │星尘祭│                │
│ │Lv.1  │                │
│ └──────┘                │
└─────────────────────────┘
```

每张设施小卡片：
- 紧凑高度（约 80-100px）
- 用 CSS emoji 或 Unicode 方块做简易「建筑图标」
- 等级用背景色深度表示（Lv.1 浅色，Lv.2 中色，Lv.3 深色/发光）
- 鼠鼠数量用小圆点或 emoji 排列表示入住情况

```css
.facility-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.facility-tile {
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px;
  text-align: center;
  position: relative;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: border-color 0.2s;
}

.facility-tile[data-level="2"] {
  border-color: var(--color-stardust);
  background: linear-gradient(to bottom, var(--color-stardust-bg), white);
}

.facility-tile[data-level="3"] {
  border-color: var(--color-energy);
  background: linear-gradient(to bottom, var(--color-energy-bg), white);
  box-shadow: 0 0 12px rgba(255, 196, 84, 0.15);
}
```

#### 3.2 类别分区标题

每个类别用一条带图标的分区标题，而非独立卡片：

```css
.zone-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  padding: 8px 4px 4px;
  border-bottom: 1px dashed var(--color-border);
  margin-bottom: 8px;
}
```

#### 3.3 空位占位 — 「待建地块」

每个类别区域内，如果还有可建的设施类型，显示一个虚线边框的空地块：

```css
.facility-empty {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light);
  cursor: pointer;
  background: var(--color-surface);
}

.facility-empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

点击空地块展开该类别可建设施列表（而非底部一个大按钮展开全部蓝图）。这比「建造新设施」按钮更直观——玩家看到空地，自然想要填满。

#### 3.4 升级视觉

不用弹窗或独立按钮区。设施卡片右上角显示升级图标，点击直接升级：

```
┌──────────────┐
│          [⬆️] │  ← 可升级时显示，不可升级时隐藏
│    🎡        │
│  仓鼠跑轮    │
│   Lv.2       │
│  🐹🐹 / 3   │
│  ⚡+8/回合   │
└──────────────┘
```

点击 ⬆️ 时，卡片内联展开升级信息（费用、效果对比），确认后就地升级，无需跳转。

#### 3.5 乐园成长感

在设施页顶部增加一个「乐园概览」微型统计行：

```
乐园规模: ██████░░░░  6/10 设施  |  总产能 ⚡24/回合
```

进度条的「上限」可以设为当前可建设施总数（包括同类多个），让玩家看到乐园在生长。

---

## 实施优先级

| 阶段 | 内容 | 改动范围 | 影响 |
|------|------|---------|------|
| P0 | 配色变量统一 | styles.css + 所有 view 文件中的硬编码颜色 | 低风险，纯样式 |
| P1 | 间距/圆角收紧 + Tab 栏改下划线 | styles.css, App.tsx | 低风险，体感改善大 |
| P2 | 资源栏提取到 App 级别 | App.tsx, Overview.tsx, store.tsx | 中等改动，需要 state 传递调整 |
| P3 | 设施页网格化 + 空地块 | Facilities.tsx, styles.css | 较大改动，需仔细测试交互 |
| P4 | 推进回合按钮 sticky | Overview.tsx | 小改动 |

P0-P1 可以一次性完成，P2-P3 建议分步实施。

## 不做的事

- 不引入额外的 CSS 框架或 UI 库（已有 Tailwind）
- 不做动画密集的视觉效果（iframe 内性能有限）
- 不做真正的 2D 地图渲染（没有美术素材，用 CSS 网格模拟即可）
- 不改动 Gemini 已做的合理美化（渐变底色、emoji 装饰、fade-in 动画等），在其基础上统一
