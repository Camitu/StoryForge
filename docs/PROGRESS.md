# StoryForge 进度文档（v3）

> 更新：2026-08-19 —— **v3.2.2 AI 协作能力 + 表情差分管理 + UI 打磨**
> 详细架构见 ARCHITECTURE.md；同步数据对应关系见 SYNC-MAPPING.md；完整 API 见 API.md；AI 写作流程见 AI-WORKFLOW.md / AI-PROMPTS.md。

---

## 快速启动

```bat
cd /d E:\Apps\StoryForge
start-dev-windows.bat          # 启动（清理旧实例 + 自动开网页）
start-dev-windows.bat stop     # 一键停止
```

- Server: http://127.0.0.1:8790/docs · Editor: http://127.0.0.1:5173
- 环境：`server/.venv`（系统 Python 3.11）；bat 为 GBK 编码，编辑需 iconv 转码。

## 当前状态：v3.2.2 AI 协作 + 表情差分 + UI 打磨 ✅（2026-08-19）

### v3.2.2 本轮新增（AI 协作测试全程驱动）

**AI 友好 API（新增/扩展）**
- `GET /api/projects/{pid}/overview`：项目概览（世界观/角色名/场景名/章节树/伏笔）——AI 动笔前必查
- `GET /api/projects/{pid}/condense`：浓缩剧情时间线（超大项目掌握剧情走向）
- `GET /api/projects/{pid}/characters/{cid}`、`GET /api/projects/{pid}/scenes/{sid}`：单实体详情
- `GET /api/projects/{pid}/search`：扩展为覆盖世界观/角色/场景/伏笔/章节/台词（结果带 scope）
- `POST /api/projects/{pid}/subchapters/{sid}/convert-to-standard`：自由写作 → 标准写作（预览/落库 + promptTemplate）
- `POST /api/projects/{pid}/characters/{cid}/expressions` 统计 + `/expressions/replace` 批量替换：**表情差分管理**
- `GET /api/fs/drives`、`GET /api/fs/list`：文件系统浏览（全屏文件夹选择器）
- 场景模型新增 `imagePath` 字段（16:9 卡片预览图）

**编辑器 UI**
- 项目创建：默认存储 `E:\Apps\StoryForge\projects\<项目名>`；📁 全屏文件夹选择器（新建项目 + LetsGal 绑定目录共用）
- 角色卡：形象图撑满卡片、选图即保存、清除图像、名左按钮右布局；场景改 16:9 图片卡片（可选图/清除）
- 表情输入框：改为组合框——下拉仅显示**当前角色已用表情**（按频率排序），支持自由输入新表情；IME 输入流畅（本地 draft + 防抖）
- 角色卡「表情差分」按钮 → 弹窗总览该角色全部已用表情 + 行内下拉批量替换（可清除）

**文档（本次新增/重写）**
- `docs/API.md`：完整 AI 调用文档（15+ 章，含全部新接口与示例）
- `docs/AI-WORKFLOW.md`：AI 写作工作流手册（侦察 SOP / 7 类场景 SOP / 红线 / 质量门禁 / 错误处置）
- `docs/AI-PROMPTS.md`：可粘贴给任意 LLM 的 system prompt 模板（A 完整版 / B 精简 / C 转换专用）

### v3.2.1 细节修复（2026-08-18）

- **行内滚动条常显**：auto-grow 用 `scrollHeight` 直接赋给 border-box 高度，未补偿上下边框（2px），内容区被挤小导致单行也常显滚动条。修复：`height = scrollHeight + (offsetHeight - clientHeight)` 补偿边框；仅在内容超过 300px 上限（显示不完全）时才出现内部滚动条。
- **文本框内滚轮误翻章**：滚轮衔接的排除范围加入 `textarea`，在文本框内部滚动不再触发上下章节切换。
- **时间轴圆点恢复旧样式**：未选中=空心圆（灰描边 14px），选中=实心圆（accent），恢复 v3 第一版观感；其余章节树间距保持 v3.1 新设计。

## v3.2（同步竞态与 UI 修复）

StoryForge = LetsGal 上游剧情写作工具，核心链路全部打通：
**写作 → 正向同步 → LetsGal 预览 → LetsGal 改演出 → 反向同步 → 回写**。

### v3.2 本轮修复

- **对白/旁白默认两行高**：`<textarea>` 默认 `rows=2`，auto-grow 时 `height:auto` 回落到两行、`scrollHeight` 也量出两行 → 显式 `rows={1}`，单行内容即单行高度，角色名/表情/文本恢复对齐。
- **章节树 UI 重设计**：大章节改为分组卡片标题（左侧 accent 竖条 + 阴影 + hover 浮起），小章节为主行（紧凑 4px 间距、圆角 hover、选中 accent 实底），子片段为次级行（更深缩进、浅色 12px 字、2px 间距），替换原先混乱的 gap+margin 混合间距。
- **同步竞态（404/500/CORS 随机报错）**：
  - 根因 1：删除一行后，该行残留的防抖/卸载 flush 仍会 PUT 已删除的行 → 404。修复：行删除确认后置 `deletedRef`，防抖与卸载 flush 跳过。
  - 根因 2：多个 server 实例并发读写同一 `project.json`（文档踩坑 #4）→ 随机 404/500/无 CORS 头。修复：统一为单实例运行（**不要同时手动开终端跑服务**，一律用 `start-dev-windows.bat` 或由会话统一管理）。
  - 兜底：store 操作失败统一 `opFail()`——404（目标已被删除）静默并重载对齐，不再弹错误横幅；其他错误照常提示。
- 新增回归测试 `server/verify_afterid.py`（行插入 afterId 定位），`AFTERID_INSERT_ALL_OK` ✅。

### 验证

- editor `tsc -b` + `vite build` ✅；dev 服务单实例运行中（8790 / 5173），模块转换 200，projects API 正常。

## v3.1（编辑器写作体验优化）

- **写作键盘流**：对白/旁白自适应高度文本域；`Enter` 续同类行并聚焦（对白继承角色/表情）、`Shift+Enter` 软换行、`Ctrl+Enter` 旁白、`Alt+Enter` 对白、场景行 `Enter` 续场景；`Alt+↑/↓` 移行、`Alt+Delete` 删行、`Alt+E` 循环表情、复制行、全局 `Ctrl+S` 强制 flush。
- **保存性能**：行/章节/片段/小章节增删改改为 store 本地 patch（乐观更新），不再每次全量 `loadChapters()`；API 失败自动重拉对齐；行草稿感知外部更新（反向同步后自动同步显示）。
- **UI 打磨**：全部 `window.prompt/confirm/alert` 替换为应用内 Modal/Toast；全局搜索 300ms 防抖；未选角色对白行橙色 ⚠️ 提示。
- **后端**：`LineIn.afterId` 定位插入（Enter 续行插到当前行后而非章节末尾）。
- **修复**：自由写作预览单换行横排（`remark-breaks`）；滚轮衔接适配自适应 textarea；伏笔「回收说明」误传 lineId。

## 历史：v3 第一版（2026-08-18）

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

### 验证（v3 第一版）

- server smoke_test 12 项 ✅；editor tsc + vite build ✅。
- 端到端：正向同步（章节/子片段/角色/场景/章节树）✅；反向同步（文本/新章节/新片段）✅；特效分支位置保持 ✅；外部演出块占位 ✅。

## 待办（下一步）

- [ ] **LetsGal 完整闭环实测**：真实写作若干章 → 同步 → LetsGal 预览 → 加演出 → 反向 → 确认全链路（接口已就绪：bind/export/import/status）。
- [ ] 分支写作（StoryForge 内简单分支，已有子片段基础）。
- [x] AI 协作 API 文档 → 已完成（docs/API.md）。
- [x] 自由写作 → 转标准写作接口（含提示词模板）→ 已完成（convert-to-standard + AI-PROMPTS.md 模板 C）。
- [x] AI 写作工作流技能化 → 已完成（docs/AI-WORKFLOW.md + docs/AI-PROMPTS.md）。
- [ ] 行编辑增强后续项：跨大章节移动小章节的 UI、行内字数统计。
- [ ] git 提交（大量改动尚未提交，用户确认后推送）。

## 踩坑速查（详见 SYNC-MAPPING.md）

1. 所有 ID 必须标准 UUID（block id 用 `placeholder_id`，勿用 32hex line id）。
2. LetsGal 章节列表靠 `chapterTreeOrder`，两个 order 都要更新。
3. 特效/分支合并必须按原顺序 merge，禁止 `preserved + new_blocks`。
4. 多实例并发写会坏 project.json → 用一键脚本 + 锁 + 原子写。
