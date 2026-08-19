# StoryForge

> 故事锻造工坊 —— **LetsGal 的上游剧情写作与 AI 协作工具**。

StoryForge 专注 **游戏剧情写作本身**：章节管理、AI 协作写作、剧情浓缩、伏笔回收、一致性检查、资产占位声明。
演出编排（BGM/音效/动画/转场）、素材资产管理、实时预览、打包发布，全部交给 **LetsGal** 完成。

**一句话定位**：StoryForge 解决「LetsGal 不方便写长篇剧情」的问题；LetsGal 解决「演出、素材、预览、打包」的问题。

---

## 为什么这么做

- LetsGal 已具备：资产管理、实时预览、打包、演出编排（摄像机/粒子/转场/音频）。
- LetsGal 的短板：**没有面向长篇剧情写作的管理界面**（章节树/标准写作行/自由写作、AI 协作、浓缩）。
- 自研运行时（PixiJS）实测效果不佳、维护成本高 → 放弃。

## 分工

| 能力 | 归属 |
|---|---|
| 章节结构管理（大章节/小章节/子片段） | StoryForge |
| AI 协作写作（续写/扩写/浓缩） | StoryForge |
| 剧情浓缩（StateDelta/WorldState） | StoryForge |
| 伏笔登记/回收/一致性检查 | StoryForge |
| 资产占位声明（角色/场景/立绘/背景） | StoryForge |
| 素材文件管理/导入 | LetsGal |
| 演出编排（BGM/SFX/动画/转场/摄像机） | LetsGal |
| 实时预览/热重载 | LetsGal |
| 打包发布 | LetsGal |

## 同步链路

```
StoryForge（上游写作）
   │  导出剧本 JSON
   ▼
Sync Bridge（符号对齐 + 编译）
   │  写 chapters/*.json + characters.json + scenes.json + manifest
   ▼
LetsGal Studio（热重载 → 实时预览）
```

- 角色/场景/立绘/背景缺失时，Sync Bridge 自动创建**占位资产**，保证新剧情能跑通。
- 反向同步（LetsGal 人工演出调整回上游）**暂不做**，避免覆盖人工成果。

## 目录结构

```
StoryForge/
├── docs/          # PLAN-v2.md（新方案）/ ARCHITECTURE.md / PROGRESS.md
├── shared/        # TS 数据模型（聚焦剧情）
├── server/        # FastAPI：工程存储 + AI 协作 API（:8790）
├── editor/        # React 写作编辑器（:5173）
└── sync_bridge/   # （规划）StoryForge → LetsGal 同步编译层
```

## 快速开始（开发）

推荐在 **Windows 主机** 运行：

```bat
cd /d E:\Apps\StoryForge
start-dev-windows.bat
```

- Server: http://127.0.0.1:8790/docs
- Editor: http://127.0.0.1:5173

## 文档

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) —— 技术架构
- [`docs/API.md`](docs/API.md) —— 完整 API 文档（供 AI 调用，无需读源码）
- [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md) —— AI 写作工作流手册（分场景 SOP / 红线 / 质量门禁）
- [`docs/AI-PROMPTS.md`](docs/AI-PROMPTS.md) —— AI 协作 system prompt 模板（可粘贴给任意 LLM）
- [`docs/PROGRESS.md`](docs/PROGRESS.md) —— 进度
- [`docs/SYNC-MAPPING.md`](docs/SYNC-MAPPING.md) —— 同步数据对应关系
