# StoryForge 进度文档

> 每次推进后更新此文件，记录「已完成 / 进行中 / 待办」，方便下次续接。

## 快速启动（开发）

```bash
# 终端1：server（改动后需重启；媒体挂载在 config.py）
cd E:\Apps\StoryForge\server
.venv\Scripts\python -m uvicorn app.main:app --port 8790

# 终端2：编辑器
cd E:\Apps\StoryForge\editor
npm run dev          # http://localhost:5173

# 终端3：播放器
cd E:\Apps\StoryForge\runtime
npm run dev          # http://localhost:5174 （默认播 demo-youbao，可 ?project=xxx）
```

> server 依赖装在 `server\.venv`（requirements.txt）；editor/runtime 用 `npm install`（已有 node_modules）。

## 已完成

- [x] **数据模型**：beat 判别联合 + 人物/场景/伏笔 + 叙事状态压缩（WorldState/StateDelta）+ 四层层级。
- [x] **server**：工程 CRUD + AI 协作 API + 一致性检查 + 媒体静态挂载 + 冒烟测试。
- [x] **编辑器**：三视图（脚本总览 / 资产库）+ 可折叠树 + 时间线侧栏 + 子章节/小节编辑 + 新建流程 + beat 逐条编辑（对白/旁白/切场景的增删改排序）。
- [x] **播放器**：fetch 工程 → 渲染真实背景/立绘/对白框，点击/空格推进，错误提示。
- [x] **demo 工程**：`悠宝的日常`（3 角色 / 2 场景 / 三层级结构）。

## 进行中 / 待办

- [ ] **beat 编辑补全**：choice/jump/bgm/sfx/curtain/end 等类型的可视化编辑（当前仅对白/旁白/切场景可编辑，其余只读显示）。
- [ ] **拖动排序**：大章节/子章节上下拖动（需引入 dnd-kit）。
- [ ] **子章节编辑弹窗化**（当前为右侧面板，功能等价，交互待打磨）。
- [ ] **章节操作**：复制、自动实例化资产素材。
- [ ] **AI 协作实战闭环**：外部 agent 走「取快照 → 带锚点写几节 → 生成浓缩 → 一致性检查」。
- [ ] **资产库管理**：上传/绑定/引用计数/空素材清单（当前资产库仅展示角色+场景，无管理操作）。
- [ ] **运行时进阶**：多角色同屏、转场、BGM/音效、分支跳转（当前线性播放）。

## 路线图

- **P0（纵向切片）**：✅ 基本完成——真实素材 → server → 编辑器管理 + 播放器可玩。
- **P1**：资产库管理 + ComfyUI 接入 + 批量生成素材。
- **P2**：完整预览/调试运行时（点击播放/改表情/换场景/插音效/转场）。
- **P3**：路线分支图、打包发布（Electron）、UI 定制。

## 注意事项

1. **媒体路径是机器相关的**：`server/app/config.py` 里 `SPRITE_DIR` / `BACKGROUND_DIR` 指向本机 `E:\Share_folder\...` 与 `E:\output`；换机器需改。
2. **GitHub 推送**：远程为 SSH（`git@github.com:Camitu/StoryForge.git`）；本机密钥有 passphrase，非交互推送需 `SSH_ASKPASS` 方式（密钥密码见密钥本身，勿写入仓库）。
3. **数据模型改动**需同步改：`shared/src/types/*` → `server/app/models.py` → `server/app/logic.py` / `routers/ai.py` → `editor` / `runtime` 的遍历逻辑 → demo/sample JSON。
