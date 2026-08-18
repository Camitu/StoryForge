# StoryForge 进度文档（v3）

> 更新：2026-08-18 —— **v3 第一版开发完成，明天开始实际写作测试**
> 详细架构见 ARCHITECTURE.md；同步数据对应关系见 SYNC-MAPPING.md。

---

## 快速启动

```bat
cd /d E:\Apps\StoryForge
start-dev-windows.bat          # 启动（清理旧实例 + 自动开网页）
start-dev-windows.bat stop     # 一键停止
```

- Server: http://127.0.0.1:8790/docs · Editor: http://127.0.0.1:5173
- 环境：`server/.venv`（系统 Python 3.11）；bat 为 GBK 编码，编辑需 iconv 转码。

## 当前状态：v3 第一版 ✅（2026-08-18）

StoryForge = LetsGal 上游剧情写作工具，核心链路全部打通：
**写作 → 正向同步 → LetsGal 预览 → LetsGal 改演出 → 反向同步 → 回写**。

### 已完成

- **数据模型**：Project → 大章节（分组）→ 小章节（= LetsGal 章节）→ lines / 子片段 / externalBlocks；人设 / 场景 / 伏笔 / 时间线浓缩。
- **编辑器**：
  - 5 Tab；MemoVault 风格双主题。
  - 标准写作（LetsGal 风格行 UI：序号聚焦高亮、无边框流、同行操作按钮）/ 自由写作（Markdown + 行号 + 自适应高度）。
  - 编辑/预览全局切换；滚轮衔接上下章节（Word 式分页）。
  - 防抖自动保存（行 800ms / 属性 3s / 切换强制 flush）+ 全局保存。
  - 右侧属性侧边栏；全局工具栏（时间轴/写作类型/编辑预览/保存）。
  - 目录树三级缩进 + 子片段独立编辑视图（标准/自由写作分开存储）。
  - 角色/场景选择器（可输入新建）；场景管理栏；伏笔锚点图标（🚩 埋设 / ✅ 回收，悬浮显示内容）。
  - 全局搜索（含片段文本，命中跳转片段）。
  - 时间线 Tab：垂直时间线（只显示有浓缩的章节，只读展示 + 定位跳转）。
- **后端**：全量读写 API（含子片段/伏笔/搜索/检查）；原子写 + 跨进程锁。
- **同步**：双向增量同步；特效/分支原位保留；外部演出块占位展示；角色/场景自动创建。
- **运维**：一键启停脚本（防多实例）；系统 Python 3.11 专用 venv。

### 验证

- server smoke_test 12 项 ✅；editor tsc + vite build ✅。
- 端到端：正向同步（章节/子片段/角色/场景/章节树）✅；反向同步（文本/新章节/新片段）✅；特效分支位置保持 ✅；外部演出块占位 ✅。

## 待办（下一步）

- [ ] **LetsGal 完整闭环实测**：真实写作若干章 → 同步 → LetsGal 预览 → 加演出 → 反向 → 确认全链路。
- [ ] 分支写作（StoryForge 内简单分支，已有子片段基础）。
- [ ] AI 协作 API 文档（为内置 AI 准备）。
- [ ] 自由写作 → AI 转标准写作接口（提示词模板）。
- [ ] 编辑器体验：行内新建角色/场景的已有；`未命名` 占位角色提示。
- [ ] git 提交（大量改动尚未提交，用户确认后推送）。

## 踩坑速查（详见 SYNC-MAPPING.md）

1. 所有 ID 必须标准 UUID（block id 用 `placeholder_id`，勿用 32hex line id）。
2. LetsGal 章节列表靠 `chapterTreeOrder`，两个 order 都要更新。
3. 特效/分支合并必须按原顺序 merge，禁止 `preserved + new_blocks`。
4. 多实例并发写会坏 project.json → 用一键脚本 + 锁 + 原子写。
