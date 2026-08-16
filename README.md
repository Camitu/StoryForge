# StoryForge

> 故事锻造工坊 —— 与 AI 协作的 Galgame 实时开发生产引擎。

一套 **可视化剧本写作流水线 / 生产管理引擎**。Galgame 是首个落地场景，核心写作层设计为通用型，可复用于 RPG、AI 影视、动漫脚本。

**一句话定位**：让 AI 在「上下文极其有限」的前提下，也能写出全局统一、伏笔回收、不跑偏的几十万字剧情。

---

## 核心设计

**叙事状态压缩（Narrative State Diff）** 是全系统的灵魂：

> 时间线 + 人物状态 + 未回收伏笔 + 各节点浓缩 = 一个可随时「快照」的叙事世界状态。

AI 写任何一个小节，只需「当前世界状态快照 + 该小节附近锚点」，不必读几十万字全文。

## 三大支柱

1. **可视化剧情脚本创作 / 章节管理 / 分支管理**（通用写作层）
2. **ComfyUI 素材创作 + 资产库绑定**（素材需求清单驱动）
3. **在线实时预览 + 调试**（自建轻量运行时）

## 权威存储格式

- **Galgame**：结构化 beat 作为权威存储；Markdown 仅作「视图」。
- **通用写作**：自由 Markdown + 可选模板。

```
beat = {时间, 场景, 角色, 表情, 对白, 立绘, 头像, CG, 旁白}
```

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 | TypeScript（编辑器 + 运行时）+ Python（项目服务） |
| 编辑器 UI | React 18 + zustand + React Flow + dnd-kit |
| 游戏运行时 | Pixi.js 7 + pixi-filters + howler + tween.js |
| 桌面打包 | Electron + electron-builder（另支持 web 导出） |
| 项目服务 / AI API | FastAPI + SQLite（本地 HTTP） |
| 权威存储 | JSON 工程文件（git 友好） |

## 目录结构

```
StoryForge/
├── docs/       # 方案文档（PLAN.md 为最终方案）
├── shared/     # 共享 TS 类型：beat 模型、block 定义
├── server/     # FastAPI + SQLite（AI 协作 API + beat 数据层）
├── editor/     # React 18 + Vite + TS（可视化脚本编辑器）
└── runtime/    # Pixi.js 7（Galgame 运行时 / 播放器）
```

## 快速开始

### 服务端（AI 协作 API，端口 8790）

```bash
cd server
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8790
# 冒烟测试
.venv\Scripts\python smoke_test.py
```

### 编辑器

```bash
cd editor
npm install
npm run dev
```

### 播放器

```bash
cd runtime
npm install
npm run dev
```

## 路线图

- **P0（纵向切片）**：结构化 beat 模型 + 章节/时间线/人物/伏笔 + 锚点 + 浓缩 + 本地 AI API + 最简对话播放器。
- **P1**：资产库 + ComfyUI 接入 + 批量生成素材。
- **P2**：完整预览/调试运行时（点击播放/改表情/换场景/插音效/转场）。
- **P3**：路线分支图、打包发布、UI 定制。

> 完整方案见 [`docs/PLAN.md`](docs/PLAN.md)，或在 MemoVault 知识库中查看条目《AI-Galgame 实时开发生产引擎 — 最终方案》（id 63）。

## 文档索引

- [`docs/PLAN.md`](docs/PLAN.md) —— 最终方案（设计共识）
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) —— 技术架构 / 数据模型 / 数据流 / API
- [`docs/PROGRESS.md`](docs/PROGRESS.md) —— 进度 / 待办 / 启动方式（**续接开发先读这个**）
