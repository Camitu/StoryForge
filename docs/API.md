# StoryForge API 文档（供 AI 协作调用）

> 更新：2026-08-19（v3.2.1 后，新增 AI 友好查询接口）
> **AI 无需阅读源码**：所有读写操作均通过本页 API 完成；文件读写只发生在 server 内部。

---

## 0. 快速开始

- Base URL：`http://127.0.0.1:8790`
- 无认证；请求体一律 `Content-Type: application/json; charset=utf-8`（中文用 UTF-8）
- 所有内容接口前缀：`/api/projects/{project_id}`（下文省略前缀，标注为 `{pid}`）
- 项目 id 从 `GET /api/projects` 获取
- 错误格式：`{"detail": "..."}`，HTTP 状态码 400（业务错误）/ 404（不存在）/ 409（冲突，如被引用）

### AI 工作流建议

```
1. GET /api/projects                          → 找到目标项目 id
2. GET /api/projects/{pid}/overview           → 一次获取项目全貌（世界观/角色名/场景名/章节树/伏笔）
3. GET /api/projects/{pid}/condense           → 浓缩剧情时间线（超大项目掌握剧情走向）
4. 按需：GET .../characters/{cid} 取角色详情；GET .../characters/{cid}/expressions 取该角色表情库；GET .../subchapters/{sid} 取章节正文
5. 写作：POST .../chapters/{cid}/subchapters 建小章节 → POST .../subchapters/{sid}/lines 写行（对白行 expression 参考第 4 步表情库，有近似就复用）
6. 校验：GET .../check                        → 一致性检查
```

> 详细分场景流程见 `docs/AI-WORKFLOW.md`，提示词模板见 `docs/AI-PROMPTS.md`。

---

## 1. 工程管理（/api/projects）

### 1.1 列出工程
`GET /api/projects`
```json
[{"id": "be9518d4...", "name": "NewTest", "version": "0.3.0", "storageDir": "E:\\Apps\\StoryForge\\projects\\NewTest"}]
```

### 1.2 创建工程
`POST /api/projects`
```json
{"name": "我的新故事", "storageDir": "E:\\Apps\\StoryForge\\projects"}
```
- `storageDir` 可选：**父目录**，自动在下面创建 `<项目名>` 文件夹（默认 `E:\Apps\StoryForge\projects`）
- 返回完整 Project（201）

### 1.3 读取工程（全量 JSON）
`GET /api/projects/{pid}` — 返回整个 Project 对象（含所有章节/行）

### 1.4 更新工程（全量覆盖）
`PUT /api/projects/{pid}` — body 为完整 Project JSON（慎用，建议用下面的细粒度接口）

### 1.5 删除工程
`DELETE /api/projects/{pid}` — 204；删除本地工程文件（不影响 LetsGal 项目）

### 1.6 弹出目录选择框（仅交互式桌面可用）
`POST /api/projects/choose-directory` → `{"path": "E:\\..."}`（取消为 null）

---

## 2. 项目概览（AI 快速了解项目）

### 2.1 项目概览
`GET /api/projects/{pid}/overview`

返回：世界观全文、角色名列表、场景名列表、章节树骨架（含小章节 lineCount/fragmentNames）、伏笔概要。**AI 开始工作前先调这个。**

```json
{
  "id": "be9518d4...", "name": "NewTest", "version": "0.3.0",
  "worldview": "晨光镇是一个被晨雾笼罩的海边小镇……",
  "characters": [{"id": "1bb5...", "name": "林小满"}],
  "scenes": [{"id": "bb13...", "name": "晨光镇·紫雾码头"}],
  "chapters": [{"id": "...", "name": "默认", "subChapters": [{"id": "...", "name": "第一章", "lineCount": 3, "fragmentNames": []}]}],
  "foreshadows": [{"id": "...", "content": "……", "status": "open", "plantedSubChapterId": "..."}]
}
```

### 2.2 浓缩剧情时间线（超大项目必备）
`GET /api/projects/{pid}/condense`

按章节顺序返回各小章节的 **日期/概要/浓缩/标签**，不含正文行 —— 几十万字项目下 AI 先读这个即可掌握剧情走向与伏笔分布，再按需取单章全文。

```json
{"chapters": [{"id": "...", "name": "第一章 · 雾起", "subChapters": [
  {"id": "...", "name": "雾夜码头", "date": "雾历十七年 深秋",
   "summary": "林小满在雾夜码头遇见神秘旅人阿澈…",
   "condense": "林小满与阿澈在码头初遇；韩伯认出阿澈的鲸骨吊坠。",
   "tags": ["初遇","灯塔"], "mode": "standard", "lineCount": 13, "fragmentCount": 0}
]}]}
```

---

## 3. 世界观

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 读取 | `GET /api/projects/{pid}/worldview` | `{"worldview": "..."}` |
| 写入/覆盖 | `PUT /api/projects/{pid}/worldview` | body `{"worldview": "..."}`（单值，PUT 即创建+修改） |

---

## 4. 人设（角色）

字段：`id / name / note(备注) / baseSetting(设定) / imagePath / plotTimeline[{date, content}]`

**表情差分说明**：对白行 `expression` 字段对应 LetsGal 角色立绘差分。建议格式：
- 纯表情：`开心` / `难过`
- 服装·表情：`衬衫·开心` / `睡衣·困倦`（同一服装下不同表情）
写作时编辑器表情框：**下拉候选仅显示当前角色的已用表情**（按使用频率排序，未用过则无下拉），同时支持直接输入新增；同义表情（如 开心/高兴）建议统一，用批量替换归纳。

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 角色名列表 | `GET /api/projects/{pid}/overview` 的 `characters` | 轻量：id+name |
| 全部角色（含设定） | `GET /api/projects/{pid}/characters` | 完整数组 |
| 单个角色详情 | `GET /api/projects/{pid}/characters/{cid}` | 含全部设定字段 |
| 新建 | `POST /api/projects/{pid}/characters` | body `{"name","note","baseSetting","imagePath","plotTimeline"}`，重名 400 |
| 修改 | `PUT /api/projects/{pid}/characters/{cid}` | body 同上（全量更新） |
| 删除 | `DELETE /api/projects/{pid}/characters/{cid}` | 被章节引用时 409 |
| 引用检查 | `GET /api/projects/{pid}/characters/{cid}/refs` | `{"refs": ["第一章: 第2行"]}` |
| 表情差分统计 | `GET /api/projects/{pid}/characters/{cid}/expressions` | 该角色全部剧情已用表情 `[{expression, count}]` + total |
| 表情批量替换 | `POST /api/projects/{pid}/characters/{cid}/expressions/replace` | body `{"from":"旧表情","to":"新表情"}`，to 空串=清除；返回 `{replaced}` |

示例（表情差分统计 + 批量替换）：
```json
GET /api/projects/{pid}/characters/{cid}/expressions
→ {"characterId": "84a9...", "characterName": "韩伯",
   "expressions": [{"expression": "无奈", "count": 2},
                   {"expression": "低语", "count": 1},
                   {"expression": "冷笑", "count": 1},
                   {"expression": "沉声", "count": 1}],
   "total": 5}

POST /api/projects/{pid}/characters/{cid}/expressions/replace
{"from": "开心", "to": "高兴"}        → {"replaced": 3}   // 归纳同义表情
{"from": "衬衫·严肃", "to": "衬衫·郑重"} → {"replaced": 1}   // 服装·表情
{"from": "旧表情", "to": ""}            → {"replaced": 2}   // 清除表情
```

示例（新建+修改）：
```json
POST /api/projects/{pid}/characters
{"name": "林小满", "note": "灯塔守护者家族的少女", "baseSetting": "18岁，倔强好奇"}
→ {"id": "1bb5...", "name": "林小满", ...}

PUT /api/projects/{pid}/characters/1bb5...
{"name": "林小满", "note": "已觉醒", "baseSetting": "18岁……左手腕有灯塔印记。"}
```

---

## 5. 场景

字段：`id / name / note / imagePath`（形象图相对路径，16:9 卡片预览用）

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 场景名列表 | `GET /api/projects/{pid}/overview` 的 `scenes` | 轻量 |
| 全部场景 | `GET /api/projects/{pid}/scenes` | 完整数组 |
| 单个场景 | `GET /api/projects/{pid}/scenes/{sid}` | 详情 |
| 新建 | `POST /api/projects/{pid}/scenes` | body `{"name","note","imagePath"?}`，重名 400 |
| 修改（含改名/换图） | `PUT /api/projects/{pid}/scenes/{sid}` | body `{"name","note","imagePath"?}` |
| 删除 | `DELETE /api/projects/{pid}/scenes/{sid}` | 204 |

---

## 6. 大章节 / 小章节

层级：`Project → chapters[]（大章节）→ subChapters[]（小章节，= LetsGal 章节名）→ lines / fragments`

### 6.1 大章节

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 列表 | `GET /api/projects/{pid}/chapters` | 完整树 |
| 新建 | `POST /api/projects/{pid}/chapters` | body `{"name","summary"}` |
| 修改 | `PUT /api/projects/{pid}/chapters/{cid}` | body `{"name","summary"}` |
| 删除 | `DELETE /api/projects/{pid}/chapters/{cid}` | 非空 409 |
| 排序 | `POST /api/projects/{pid}/chapters/{cid}/move` | body `{"delta": -1\|1}` |

### 6.2 小章节（SubChapter）

字段：`id / name / date / summary / tags[] / condense / mode(standard|free) / freeText / lines / externalBlocks / fragments`

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 新建 | `POST /api/projects/{pid}/chapters/{cid}/subchapters` | body `{"name","date","summary","tags","condense","mode","freeText"}`；**名称全局唯一**；cid 不存在时自动归入「默认」大章节 |
| 详情 | `GET /api/projects/{pid}/subchapters/{sid}` | 完整（含行） |
| 修改 | `PUT /api/projects/{pid}/subchapters/{sid}` | body 同上 |
| 删除 | `DELETE /api/projects/{pid}/subchapters/{sid}` | 204 |
| 排序/跨章节移动 | `POST /api/projects/{pid}/subchapters/{sid}/move` | body `{"delta": -1\|1}` 或 `{"chapterId": "..."}` |

---

## 7. 标准写作行（ScriptLine）

三种 kind：`dialogue`（对白）/ `narration`（旁白）/ `scene`（切场景）

| kind | 必填 | 说明 |
|---|---|---|
| dialogue | `characterId` + `text` | 可选 `characterName/expression/sceneId/sceneName` |
| narration | `text` | 可选 `sceneId/sceneName` |
| scene | `sceneId` | 可选 `sceneName` |

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 新增行 | `POST /api/projects/{pid}/subchapters/{sid}/lines` | body 见下；`afterId` 可选（插到某行后，缺省追加末尾） |
| 修改行 | `PUT /api/projects/{pid}/subchapters/{sid}/lines/{lid}` | body 见下（部分字段更新） |
| 删除行 | `DELETE /api/projects/{pid}/subchapters/{sid}/lines/{lid}` | 204 |
| 移动行 | `POST /api/projects/{pid}/subchapters/{sid}/lines/{lid}/move` | body `{"delta": -1\|1}` |

示例：
```json
POST /api/projects/{pid}/subchapters/{sid}/lines
{"kind": "dialogue", "characterId": "1bb5...", "characterName": "林小满", "expression": "疑惑", "text": "灯塔为什么会发光？", "afterId": null}

POST /api/projects/{pid}/subchapters/{sid}/lines
{"kind": "narration", "text": "晨雾中，码头木桩上的贝壳闪着微光。"}

POST /api/projects/{pid}/subchapters/{sid}/lines
{"kind": "scene", "sceneId": "bb13...", "sceneName": "晨光镇·紫雾码头"}
```

---

## 8. 自由写作 → 标准写作转换

小章节 `mode=free` 时内容存于 `freeText`（Markdown，不同步 LetsGal）。

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 写入自由写作 | `PUT /api/projects/{pid}/subchapters/{sid}` | body `{"mode":"free","freeText":"# 场景名\n\n角色（表情）：台词\n旁白…"}` |
| 读取自由写作 | `GET /api/projects/{pid}/subchapters/{sid}` | 返回 `freeText` 全文 |
| 转为标准行 | `POST /api/projects/{pid}/subchapters/{sid}/convert-to-standard` | body `{"apply": true\|false}`，见下 |

转换规则（启发式，中文友好）：
- `# 场景名` → `scene` 行
- `角色名（表情）：台词` 或 `角色名：台词` → `dialogue` 行
- 其余文本按空行分段 → `narration` 行
- 角色/场景不存在时：`apply=true` 自动创建并写入；`apply=false`（默认）仅预览

返回：
```json
{"lines": [{"kind":"scene","sceneId":"...","sceneName":"海崖灯塔"}, ...],
 "createdCharacters": [], "createdScenes": [],
 "applied": false, "mode": "free",
 "promptTemplate": "你是剧本结构化助手。请把下面的自由写作草稿转换为标准写作行 JSON 数组…"}
```
- `promptTemplate`：供外部 LLM 精修/兜底用的提示词模板（含角色/场景 id 对照）。
- `apply=true` 后 `mode` 变为 `standard`，`freeText` 保留，后续可正常同步 LetsGal。

---

## 9. 子片段（Fragment）

小章节下的命名片段（= LetsGal 命名 fragment，可被 callFragment/branch 调用）。

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 新建 | `POST /api/projects/{pid}/subchapters/{sid}/fragments` | body `{"name","freeText"}`；`main` 为保留名 |
| 修改 | `PUT /api/projects/{pid}/subchapters/{sid}/fragments/{fid}` | body `{"name","freeText"}` |
| 删除 | `DELETE /api/projects/{pid}/subchapters/{sid}/fragments/{fid}` | 204 |
| 片段加行 | `POST /api/projects/{pid}/subchapters/{sid}/fragments/{fid}/lines` | body 同标准行 |
| 片段改行 | `PUT /api/projects/{pid}/subchapters/{sid}/fragments/{fid}/lines/{lid}` | |
| 片段删行 | `DELETE /api/projects/{pid}/subchapters/{sid}/fragments/{fid}/lines/{lid}` | |
| 片段行移动 | `POST /api/projects/{pid}/subchapters/{sid}/fragments/{fid}/lines/{lid}/move` | body `{"delta": -1\|1}` |

---

## 10. 伏笔（Foreshadow）

字段：`id / content / plantedAt{subChapterId,lineId} / status(open|resolved) / resolutionNote`

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 列表 | `GET /api/projects/{pid}/foreshadows` | 全部 |
| 登记 | `POST /api/projects/{pid}/foreshadows` | body `{"content","subChapterId","lineId"?}` |
| 更新 | `PUT /api/projects/{pid}/foreshadows/{fid}` | body `{"content"?}` 等 |
| 回收 | `POST /api/projects/{pid}/foreshadows/{fid}/resolve` | body `{"subChapterId","lineId"?,"note"?}` |
| 重开 | `POST /api/projects/{pid}/foreshadows/{fid}/reopen` | 状态回到 open |
| 删除 | `DELETE /api/projects/{pid}/foreshadows/{fid}` | 204 |

---

## 11. 全局搜索

`GET /api/projects/{pid}/search?q=关键词`（URL 编码）

匹配范围（v3.2.1+）：**世界观、角色（名/备注/设定）、场景（名/说明）、伏笔、章节名/概要/浓缩、对白/旁白、子片段台词**。

返回：
```json
[{"scope": "worldview", "subChapterId": null, "chapterName": "世界观", "subChapterName": "整体世界观", "hits": ["世界观: ..."]},
 {"scope": "character", "subChapterId": null, "chapterName": "角色", "subChapterName": "林小满", "hits": ["设定: ..."]},
 {"scope": "chapter", "subChapterId": "...", "chapterName": "第一章", "subChapterName": "...", "date": "", "fragmentId": null, "hits": ["台词: ..."]}]
```
- `scope=chapter` 可跳转；其余为设定类结果。

---

## 12. 一致性检查

`GET /api/projects/{pid}/check`
```json
{"ok": true, "issue_count": 0, "issues": []}
```

---

## 13. 图片上传 / 媒体

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 上传图片 | `POST /api/projects/{pid}/upload` | multipart `file`，复制进 `storageDir/assets/images/`，返回相对路径 |
| 读取媒体 | `GET /api/projects/{pid}/media?path=...` | 工程目录内文件（目录穿越防护） |

## 13.1 文件系统浏览（前端全屏文件夹选择器）

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 盘符列表 | `GET /api/fs/drives` | `{"drives":["C:\\","D:\\",...]}` |
| 目录列表 | `GET /api/fs/list?path=E:\Apps` | 返回 `{path, parent, dirs}`；`path` 为空返回盘符列表 |
| 弹出系统选目录框 | `POST /api/projects/choose-directory` | 系统 FolderBrowserDialog，返回 `{path}`（取消 null） |

---

## 14. LetsGal 同步

| 操作 | 方法/路径 | 说明 |
|---|---|---|
| 绑定 | `POST /api/projects/{pid}/sync/bind` | body `{"letsgalDir": "E:\\GamePro\\xxx"}` |
| 正向导出 | `POST /api/projects/{pid}/sync/export?dry_run=false` | StoryForge → LetsGal（增量） |
| 反向导入 | `POST /api/projects/{pid}/sync/import?dry_run=false` | LetsGal → StoryForge（回写文本+外部演出块） |
| 状态 | `GET /api/projects/{pid}/sync/status` | `{"bound": true, "letsgalDir": "...", "chapterNames": [...]}` |

> `dry_run=true`（默认）只预览不写文件；确认无误再传 `false`。

---

## 15. 常见错误码

| 状态码 | 含义 | 处理 |
|---|---|---|
| 400 | 业务错误（重名/空名/边界） | 读 `detail` 调整请求 |
| 404 | 资源不存在（id 错/已删） | 用 overview/chapters 重新取 id |
| 409 | 被引用（删角色）或非空删除 | 先解除引用 |
| 422 | 参数校验失败 | 检查 body 字段名/类型 |

## 16. 注意事项

1. 所有 id 由服务端生成，客户端**不要**自定义 id。
2. 小章节名全局唯一（= LetsGal 章节文件名）；角色/场景名在各自集合内唯一。
3. 修改角色/场景用 PUT 全量字段；修改行可只传要改的字段（除 afterId）。
4. 编辑冲突：多客户端同时写同一行，后写覆盖；AI 建议先 GET 再 PUT。
