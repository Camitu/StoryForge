# StoryForge ↔ LetsGal 数据对应关系

> 更新：2026-08-18（v3 第一版完成）
> 维护同步层 / 排查同步问题必读。

---

## 1. 层级对应总览

| StoryForge | LetsGal | 说明 |
|:---|:---|:---|
| 工程 Project | LetsGal 工程目录（绑定） | `storageDir` / `letsgalDir` |
| 大章节 Chapter | ——（无对应） | 仅 StoryForge 分组/折叠 |
| 小章节 SubChapter | 章节文件 `chapters/{name}.json` | 文件名 = 小章节名（唯一） |
| `sub.lines[]`（标准行） | 章节文件内 `main` fragment 的 blocks | 对白/旁白/切场景 |
| `sub.fragments[]` | 命名 fragment（main 之外） | 可被 callFragment / branch 调用 |
| `sub.externalBlocks[]` | 非文本 block（特效/分支/音效/镜头等） | 只读占位，编辑在 LetsGal |
| `sub.freeText`（自由写作） | **不同步** | StoryForge 内部草稿 |
| characters / scenes | `characters.json` / `scenes.json` + `assets/.manifest.json` | 缺失自动创建占位 |

## 2. 行 ↔ block 对应

| StoryForge line.kind | LetsGal block.type | 说明 |
|:---|:---|:---|
| `dialogue` | `dialogue` | 角色/表情/文本；content = `[{type:text, text, styles}]` |
| `narration` | `narration` | 旁白 |
| `scene` | `scene` | 切场景（sceneId/sceneName） |
| ——（不支持编辑） | `branch` / `particle` / `sound` / `curtain` / `floatingText` / `camera` / `background` / `transition` / `wait` 等 | 演出块：反向导入记为 externalBlocks 占位；正向导出**原样保留原位** |

## 3. ID 规则（⚠️ 关键坑）

- **所有 ID 必须是标准 UUID 格式（带连字符）**：章节 id、fragment id、block id、角色 id、场景 id、manifest asset id。
- StoryForge 内部行 id 是 32hex（`uuid4().hex`），**不能直接用作 block id**——LetsGal 解析会失败（表现为"章节脚本为空"）。
- 确定性 UUID 生成：`placeholder_id(seed) = uuid5(NAMESPACE_URL, f"storyforge::{seed}")`，保证重复同步幂等。
  - fragment id：`placeholder_id(f"fragment::{sub_id}::{fragment_name}")`
  - block id：`placeholder_id(f"block::{sub_id}::{line_id}")`
- LetsGal 系统章节（`开始` / `游戏结束` / `终章`）反向导入时跳过，避免污染写作层。

## 4. 增量同步机制

### 4.1 映射文件 `server/data/{project_id}.sync.json`

```json
{
  "projectId": "...",
  "letsgalDir": "E:\\GamePro\\empty",
  "chapters": {
    "<subChapterId>": {
      "chapterName": "序章2",
      "chapterFile": "chapters/序章2.json",
      "fragmentName": "main",
      "beats": { "<sf_line_id>": "<letsgal_block_id>", ... }
    }
  }
}
```

- `beats`：StoryForge 行 id → LetsGal block id，增量更新的核心。
- 子片段的行映射 key 加前缀：`"{sub_id}::{fragment_name}"` 区分。

### 4.2 正向导出（exporter.py，StoryForge → LetsGal）

1. 小章节 → `chapters/{name}.json`；`lines` → `main` fragment；`fragments[]` → 命名 fragment。
2. 按 `beats` 映射定位既有 block：
   - 命中 → 合并更新（`_merge_text_block` 保留 LetsGal 侧 props，只更新文本类字段 + content）。
   - 未命中（新增行）→ 生成新 block（UUID id），记录映射。
3. **顺序合并（⚠️ 勿改回）**：按 LetsGal 原 blocks 顺序遍历——文本块原位替换、特效/分支块**原位保留**、新增文本块追加末尾。禁止 `preserved + new_blocks`（会把特效/分支全部挪到章节开头）。
4. 角色/场景缺失 → `characters.json` / `scenes.json` / manifest 创建占位（`未命名` 占位角色）。
5. 更新 LetsGal `project.json`：**chapterOrder + chapterTreeOrder**（新版 LetsGal 靠 chapterTreeOrder 渲染章节列表）。
6. 同名章节文件冲突：自动 `-2` 后缀（`_resolve_chapter_file`）。
7. 自由写作（无标准内容的 free 章节）跳过；**free 模式但有 lines/fragments 照常导出**。

### 4.3 反向导入（importer.py，LetsGal → StoryForge）

1. 每个 LetsGal 章节文件 → 小章节；`main` fragment → `lines`，命名 fragment → 子片段（自动新建）。
2. 文本块按 block id 匹配更新既有行；新块追加并记录映射。
3. **非文本块（特效/分支等）→ `externalBlocks[]`**：记录 `{id, type, label, afterLineIndex}`（前面的文本行数，用于行列表定位展示）；不在 StoryForge 侧编辑。
4. 新建章节自动归入「默认」大章节。
5. 只修改 StoryForge 工程 JSON，不触碰 LetsGal 文件。

## 5. 外部演出块（externalBlocks）

```json
{
  "id": "<letsgal_block_id>",
  "type": "branch",
  "label": "分支选项：选择片段1 / 选择片段2",
  "afterLineIndex": 6
}
```

- `afterLineIndex` = 该块前面有多少个文本行 → 前端把它插入到第 N 行之后展示。
- label 由 `_block_label()` 生成：branch 解析 choices 文本、particle 带 preset、sound 带类型/uri、curtain 带 op 等。
- 已有项目需**再跑一次反向导入**才会填充。

## 6. 同步常见坑（踩坑记录）

1. **block id 非 UUID** → LetsGal 忽略整段 blocks（"文件生成了但脚本为空"）。必须用 `placeholder_id`。
2. **只更新 chapterOrder 不更新 chapterTreeOrder** → 新章节不在 LetsGal 章节列表显示。
3. **多 server 实例并发写** → project.json 损坏。启动脚本有端口检测；store 有跨进程锁 + 原子写。
4. **特效/分支顺序被打乱** → 合并必须按原顺序 merge（见 4.2 第 3 条）。
5. **`未命名` 占位角色** → StoryForge 某行对白没选角色，同步时自动创建。写作时应给每行选角色。
6. **mapping 脏数据**（旧版 b01/32hex block id）→ 清空 `sync.json` 的 `chapters` 后重新同步。

## 7. 一次完整闭环流程（推荐）

```
StoryForge 写章节 → 正向同步 → LetsGal 预览
LetsGal 加特效/分支/改文本 → 反向同步 → StoryForge 显示占位+文本回写
再正向同步 → LetsGal 特效/分支位置不变、文本更新
```
