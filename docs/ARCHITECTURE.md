# StoryForge 架构文档

> 与 AI 协作的 Galgame 实时开发生产引擎。本文档面向后续开发续接，记录技术架构与关键设计决策。

## 1. 目录结构

```
StoryForge/
├── docs/            # 文档（PLAN.md 方案 / ARCHITECTURE.md 架构 / PROGRESS.md 进度）
├── shared/          # @storyforge/shared：TS 数据模型（权威类型，单源）
│   └── src/types/   # beat / character / scene / foreshadow / state / asset / project
├── server/          # FastAPI 服务（端口 8790）+ JSON 工程存储 + 媒体静态挂载
│   ├── app/         # main/config/models/store/logic + routers(projects, ai)
│   ├── data/        # 工程 JSON 文件（demo-youbao.json 等）
│   └── smoke_test.py
├── editor/          # React 18 + Vite + zustand（可视化脚本编辑器，端口 5173）
│   └── src/         # App / store / api + components(ScriptView, SectionEditor, AssetView)
└── runtime/         # Pixi.js 7 播放器（端口 5174，读 beat 渲染背景/立绘/对白）
```

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 数据模型 | TypeScript（`@storyforge/shared`，字段 camelCase，JSON 契约与 Python 一致） |
| 编辑器 UI | React 18 + zustand + Vite |
| 游戏运行时 | Pixi.js 7（背景 cover / 立绘撑满高度） |
| 服务 | FastAPI + Pydantic v2，权威存储为 JSON 工程文件（git 友好），SQLite 索引后置 |
| 打包发布 | Electron + electron-builder（P3，尚未开始） |

## 3. 数据模型（层级）

```
Project
├── characters[]   角色（含 expressions[]：name + assetPath 立绘）
├── scenes[]       场景（layers[] 多层视差）
├── assets[]       资产库（引用计数，ready=false = 待创作）
└── chapters[]（按 chapterOrder 排序）
     └── subChapters[]  子章节（如「000 突如其来的夏日」）
          └── sections[]  小节（一个时间段）
               ├── summary      剧情概要（写作指引）
               ├── condense     StateDelta 剧情浓缩（压缩上下文）
               ├── tags / foreshadows / anchors
               └── beats[]      结构化剧本最小单元
```

### Beat 判别联合（kind）

`dialogue`（角色/表情/对白/立绘/头像/场景/CG）、`narration`（旁白）、`scene`（切场景）、
`character`（立绘变化）、`bgm`、`sfx`、`choice`（分支）、`jump`、`curtain`、`end`。

核心概念：**叙事状态压缩**——`WorldState`（世界状态快照）+ `StateDelta`（每节的状态差量/浓缩）。
AI 写任意小节只需「快照 + 附近锚点」，不必读全文。

## 4. 数据流

```
editor (5173) ──fetch──▶ server (8790) ──读/写──▶ server/data/*.json
runtime (5174) ──fetch──▶ server (8790) ──GET /api/projects/{id}
                         server ──静态挂载──▶ /media/sprites  → E:\Share_folder\PicUP\悠宝的日常
                         　　　　　　　　　  /media/backgrounds → E:\output
```

- 编辑器与播放器均通过 `http://127.0.0.1:8790` 访问服务（CORS 已开放 `*`）。
- 资产路径在工程里存**相对路径**（如 `sprites/悠宝/立绘基本/xxx.png`），前端用 `mediaUrl()` 拼成完整 URL。

## 5. 关键 API（P0）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/projects` | 列出 / 新建工程（POST 只需 `{name}`） |
| GET/PUT/DELETE | `/api/projects/{id}` | 读 / 全量更新 / 删 |
| GET | `/api/projects/{id}/context?at=…` | 叙事世界状态快照 |
| POST | `/api/projects/{id}/sections/{sid}/beats` | 提交 beat（锚点保护，mode=append/replace） |
| POST | `/api/projects/{id}/sections/{sid}/condense` | 写入剧情浓缩 |
| POST | `/api/projects/{id}/sections/{sid}/foreshadow[/{fid}/resolve]` | 登记/回收伏笔 |
| GET | `/api/projects/{id}/check` | 一致性检查（机械校验） |

## 6. 关键设计决策

1. **权威存储 = JSON 工程文件**（对齐 LetsGal 思路，git 友好）；SQLite 仅作后续索引，暂未引入。
2. **四层剧情层级**：大章节 → 子章节 → 小节 → beat（依据用户反馈新增「子章节」层）。
3. **资产库与脚本编辑分页**：编辑器两视图切换，不混在同一页。
4. **外部 AI 协作**：语义生成（写剧情/浓缩/查错）由外部 agent 调用 API 完成；服务只做数据层 + 机械校验。
5. **媒体不复制进仓库**：server 直接挂载用户外部素材目录（机器相关路径见 config.py）。
