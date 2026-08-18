# StoryForge 架构文档（v3 最终版）

> 更新：2026-08-18（v3 第一版开发完成）
> StoryForge = LetsGal 的**上游剧情写作与 AI 协作工具**。演出 / 素材 / 预览 / 打包全部交给 LetsGal。

---

## 1. 项目定位

- StoryForge 负责**剧情写作层**：章节结构、标准写作行、自由写作草稿、人设、场景、伏笔、时间线/浓缩。
- LetsGal 负责**演出层**：特效、动画、音效、分支、立绘、打包发布。
- 双向同步：StoryForge 写剧情 → 导出到 LetsGal 工程；LetsGal 改动（含特效/分支）→ 反向导入回 StoryForge。

## 2. 技术栈

| 层 | 技术 | 目录 |
|:---|:---|:---|
| 共享类型 | TypeScript（camelCase 契约） | `shared/src/types/` |
| 后端 | Python 3.11 + FastAPI + Pydantic + uvicorn | `server/app/` |
| 前端 | React 18 + Vite + TypeScript + zustand | `editor/` |
| 同步层 | Python（独立模块，server 调用） | `sync_bridge/` |

## 3. 数据模型

```
Project（工程）
├── worldview            整体世界观
├── characters[]         人设（name/note/baseSetting/imagePath/plotTimeline）
├── scenes[]             场景（名称唯一）
├── chapterOrder[]       大章节顺序
├── chapters[]           大章节（仅 StoryForge 分组用）
│   └── subChapters[]    小章节（= LetsGal 章节，名称唯一）
│       ├── date/summary/tags/condense    时间线/概要/标签/浓缩
│       ├── mode           standard | free
│       ├── freeText      自由写作草稿（Markdown，不同步 LetsGal）
│       ├── lines[]       标准写作行（= LetsGal main fragment）
│       ├── externalBlocks[]  外部演出块占位（LetsGal 特效/分支，只读）
│       └── fragments[]   子片段（= LetsGal 命名 fragment）
│           ├── lines[]       片段内容行
│           ├── externalBlocks[]
│           └── freeText      片段自由写作（不同步）
└── foreshadows[]        伏笔（plantedAt/resolvedAt 指向 subChapterId+lineId）
```

标准写作行（ScriptLine）：`dialogue`（角色/表情/文本）/ `narration`（文本）/ `scene`（场景）。

## 4. 存储

- 工程文件：用户指定 `storageDir/project.json`（无则 `server/data/{id}.json`）。
- 索引：`server/data/projects.json`（id/name/storageDir）。
- **写入安全**：`_atomic_write_text` = 跨进程文件锁（msvcrt）+ 临时文件 + `os.replace`，防止多实例并发写坏文件。
- 同步映射：`server/data/{project_id}.sync.json`（详见 SYNC-MAPPING.md）。

## 5. API 概览（server/app/routers/ai.py）

全部可读写，供 AI 调用：

- 工程 CRUD（name + storageDir）、世界观
- 人设 CRUD（删除前引用检查 409）、场景 CRUD
- 大章节 CRUD + 排序；小章节 CRUD + 排序 + 跨大章节移动
- 行 CRUD + 排序；子片段 CRUD + 片段行 CRUD + 排序
- 伏笔：登记 / 回收（记录 lineId）/ 重开 / 删除
- 全局搜索（含片段文本，命中返回 fragmentId 跳转）、一致性检查
- 图片上传 / 媒体读取（目录穿越防护）
- 同步：`/sync/bind` `/sync/export` `/sync/import` `/sync/status`

## 6. 编辑器（editor/）

- **5 Tab**：人设世界观 / 章节写作管理 / 剧情伏笔与回收 / 时间线与浓缩剧情 / LetsGal 同步。
- **写作类型**：标准写作（结构化行）/ 自由写作（Markdown），全局切换。
- **编辑/预览**：全局工具栏切换；标准预览 = 只读行渲染，自由预览 = Markdown 渲染。
- **滚轮衔接**：正文滚到顶/底自动切换上一章末尾/下一章头部（Word 式分页）。
- **自动保存**：行文本 800ms 防抖；章节属性/自由写作 3s 防抖；切换章节时强制 flush；全局「保存」按钮。
- **右侧属性侧边栏**：时间线日期 / 标签 / 剧情概要 / 剧情浓缩（sticky 跟随）。
- **目录树**：大章节（全宽、右侧 ＋新建小章节/✕）→ 小章节（▲▼＋✕）→ 子片段（└ 前缀、✕）；时间轴同 grid 对齐。
- **外部演出块占位**：行列表中显示 LetsGal 特效/分支（只读橙色虚线行）。
- 双主题（浅/暗）、MemoVault 视觉风格。

## 7. 同步层（sync_bridge/）

| 文件 | 职责 |
|:---|:---|
| `letsgal.py` | LetsGal 工程只读解析 + `placeholder_id()`（uuid5 确定性标准 UUID） |
| `exporter.py` | 正向导出（StoryForge → LetsGal） |
| `importer.py` | 反向导入（LetsGal → StoryForge），含外部演出块收集 |
| `mapping.py` | `{project_id}.sync.json`：line ↔ block id 映射（增量更新基础） |

核心策略：**增量更新**——按 block id 映射更新文本块，特效/分支块按原始顺序原位保留。

## 8. 启动与运维

- 一键启动：`start-dev-windows.bat`（清理旧实例 → 起 server+editor → 自动开网页）；`... stop` 停止。
- Server: `http://127.0.0.1:8790/docs`（API 文档）；Editor: `http://127.0.0.1:5173`。
- 环境：`server/.venv`（系统 Python 3.11 创建），依赖见 `server/requirements.txt`。
- ⚠️ bat 文件为 **GBK 编码**（cmd 限制），编辑需 iconv 转码；前端 build 需在 Windows 跑。

## 9. 数据模型改动规范

模型改动需同步四处：`shared/src/types/*` → `server/app/models.py` → `server/app/routers/ai.py` → `editor/src/*`。
