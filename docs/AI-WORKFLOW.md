# StoryForge AI 写作工作流手册（AI-WORKFLOW）

> 版本：2026-08-19 · 状态：核心链路已实测（标注 ✅），其余为 API 面覆盖（标注 ⚠️ 待验证）
> 配套：`API.md`（接口字典）· `AI-PROMPTS.md`（可粘贴的 system prompt）
> **目标：任何 AI 在零上下文下，按本手册即可用最佳状态为 StoryForge 项目写作。**

---

## 0. 三句话上手

1. **AI 只负责写作层**（章节/行/角色/场景/伏笔/浓缩），演出、素材、预览、打包归 LetsGal，AI 不碰。
2. **动笔前必做侦察**：`overview`（全貌）→ `condense`（剧情走向）→ 按需单章全文。
3. **所有操作走 HTTP API**（`http://127.0.0.1:8790`），绝不直接读写项目文件；写完必跑 `check`。

Base URL：`http://127.0.0.1:8790`；内容接口前缀 `/api/projects/{project_id}`（下文写 `{pid}`）。

---

## 1. 角色与边界

| 归属 StoryForge（AI 可写） | 归属 LetsGal（AI 不碰） |
|---|---|
| 大章节/小章节/子片段、标准写作行、自由写作 | 特效/动画/音效/分支/镜头/转场 |
| 人设（name/note/baseSetting/形象图/剧情设定） | 素材文件管理、实时预览、打包发布 |
| 场景（name/note/形象图）、世界观 | —— |
| 伏笔登记/回收、剧情浓缩、时间线 | —— |

⚠️ 未实测边界提示：`externalBlocks[]`（LetsGal 演出块占位）在 StoryForge 侧**只读**，AI 不得新增/修改，只能感知其存在（`afterLineIndex` 定位）。

---

## 2. 启动侦察 SOP（动笔前必做）✅

```
① GET /api/projects                      → 找到目标项目 id
② GET /api/projects/{pid}/overview       → 世界观全文 + 角色名/场景名列表 + 章节树骨架 + 伏笔概要
③ GET /api/projects/{pid}/condense       → 按章节顺序的 date/summary/condense/tags（剧情走向，超大项目核心入口）
④ 需要某章细节时：GET .../subchapters/{sid}（含全部行）
⑤ 查设定关键词：GET .../search?q=关键词（命中世界观/角色/场景/伏笔/章节/台词）
```

**原则**：先掌握「已有的」，再决定「新增什么」。避免凭空造角色/场景导致重名 400，避免剧情与已有设定冲突。

---

## 3. 四类场景 SOP

### S1 新写章节 ✅（已实测）

```
1. POST .../chapters                {"name":"第一章 · 雾起","summary":"..."}        → chapterId
2. POST .../chapters/{cid}/subchapters
   {"name":"雾夜码头","date","summary","tags":[],"condense","mode":"standard"}     → subId
   （小章节名全局唯一；chapterId 可省 → 自动归入「默认」大章节）
3. 涉及新角色/新场景时先建（见 S1.1），拿到 id 供正文引用
4. POST .../subchapters/{sid}/lines  ×N（正文，行结构见 §4）
5. 需要分支/补充时：POST .../subchapters/{sid}/fragments → POST .../fragments/{fid}/lines
6. GET .../check                     → 必须 ok, issue_count=0
7. GET .../search?q=关键剧情词        → 确认可检索
```

**S1.1 新建角色/场景（在写正文前建好）✅**

```
POST .../characters   {"name":"韩伯","note":"...","baseSetting":"..."}   → charId
POST .../scenes       {"name":"海崖灯塔","note":"...","imagePath":null}  → sceneId
```

**S1.3 表情差分（立绘）规范 ✅**
- 对白行 `expression` 对应 LetsGal 角色立绘差分，格式建议：
  - 纯表情：`开心` / `难过` / `困倦`
  - 服装·表情：`衬衫·开心` / `睡衣·困倦`（同服装不同表情）
- **表情归属角色**：表情只属于单个角色（对应其立绘差分集合），不同角色常用表情不同。
- **编辑器行为**：对白行表情框下拉候选**仅显示当前角色的已用表情**（按使用频率排序；未用过则无下拉，仅自由输入）；支持直接输入新表情（如 `衬衫·开心`）。
- **AI 写作时**：查 `GET .../characters/{cid}/expressions`（该角色已用表情+次数）→ 有近似就用、没有才新增——避免同义表情爆炸（如 开心/高兴）。
- **收尾归纳**：写完一段后用 `POST .../characters/{cid}/expressions/replace` `{"from":"开心","to":"高兴"}` 批量合并同义表情（返回 replaced 行数；to 空串=清除），比在 LetsGal 逐个替换高效。
- **管理入口**：人设世界观 Tab → 角色卡「表情差分」按钮 → 总览该角色全部已用表情（含次数）+ 行内下拉批量替换。
- AI 建议流程：侦察阶段查一次该角色表情库 → 写作时直接引用 → 收尾批量归纳。

**S1.2 写作顺序惯例**：`scene` 切场行开头 → `narration` 氛围 → `dialogue` 对话推进 → 段落交替。每行一个请求，全部 201。

### S2 续写 / 扩写 ✅

```
1. GET .../condense 或 GET .../subchapters/{sid}   → 定位续写点（最后一行 id = lastId）
2. POST .../subchapters/{sid}/lines  {"afterId": lastId, ...}
   → 插到该行之后；afterId 缺省追加末尾
3. 新角色/场景同样先建后引
4. check + search 验证
```

**注意**：续写**不重建章节**——小章节名唯一，重复 POST 同名会 400；先 GET 确认是否已存在。

### S3 优化 / 改写 ✅

```
1. GET .../subchapters/{sid}     → 拿到目标行 id 与当前内容
2. PUT .../subchapters/{sid}/lines/{lid}
   body 可只传要改的字段（kind/characterId/characterName/expression/text/sceneId/sceneName），
   但 dialogue 必须带 characterId（改 characterName 时同时带 characterId）
3. 改角色设定：PUT .../characters/{cid}（全量字段）
4. 改场景名：PUT .../scenes/{sid}（重名会 400，改名需查重）
5. check 验证
```

**原则**：改写保留行 id（行 id 是同步映射 key，变了会断链）。

### S4 自由写作 → 标准写作 ✅

```
1. PUT .../subchapters/{sid}   {"mode":"free","freeText":"# 场景名\n\n角色（表情）：台词\n旁白…"}  → 写入草稿
2. GET .../subchapters/{sid}   → 读取 freeText
3. POST .../subchapters/{sid}/convert-to-standard  {"apply":false}   → 预览转换结果（不落库）
4. 检查 lines / createdCharacters / createdScenes / promptTemplate
5. POST .../subchapters/{sid}/convert-to-standard  {"apply":true}    → 落库（自动建缺失角色/场景，mode→standard）
6. check 验证
```

**转换规则**：`# 场景名`→scene；`角色（表情）：台词`/`角色：台词`→dialogue；其余段落→narration。
**注意**：apply=true 会**替换**该小章节现有 lines 并自动创建缺失角色/场景；freeText 保留。

### S5 伏笔登记 / 回收（⚠️ 待验证，接口已就绪）

```
登记：POST .../foreshadows   {"content":"...","subChapterId":"...","lineId":"..."?}
回收：POST .../foreshadows/{fid}/resolve  {"subChapterId":"...","lineId":"..."?,"note":"..."}
重开：POST .../foreshadows/{fid}/reopen
查询：GET  .../foreshadows
```

**建议**：登记伏笔时 `plantedAt.subChapterId` 指向实际埋设章节；回收时 `note` 写清如何回收。

### S6 剧情浓缩 / 时间线 ✅

```
写入浓缩：PUT .../subchapters/{sid}  {"condense":"本回核心事件一句话"}   （与其它字段一起全量提交）
读取浓缩：GET .../condense  （所有章节浓缩时间线）
角色剧情设定：PUT .../characters/{cid}  {"plotTimeline":[{"date":"...","content":"..."}]}
```

**原则**：condense 是「本回发生了什么」的摘要，AI 每写完一章应更新它——这是超大项目下其他 AI/人快速掌握剧情的关键。

### S7 LetsGal 同步（⚠️ 待验证闭环，接口已就绪）

```
1. POST .../sync/bind        {"letsgalDir":"E:\\GamePro\\xxx"}        → 绑定（目录必须存在）
2. POST .../sync/export?dry_run=true   → 预览导出结果
3. POST .../sync/export?dry_run=false  → 真正导出（StoryForge → LetsGal，增量）
4. POST .../sync/import?dry_run=true   → 预览反向导入
5. POST .../sync/import?dry_run=false  → 真正导入（LetsGal → StoryForge，回写文本）
6. GET  .../sync/status      → 绑定状态 + LetsGal 章节/角色/场景数
```

**红线**（SYNC-MAPPING.md 详述）：
- 所有同步 id 必须标准 UUID（`placeholder_id` 生成，AI 无需自己造）
- 特效/分支块反向导入为 `externalBlocks` 占位，**原位保留、只读**
- 同步只在**单实例 server** 下进行；先 dry_run 后实跑

---

## 4. 标准写作行结构（写行必读）✅

| kind | 必填 | 可选 | 示例 |
|---|---|---|---|
| `dialogue` | `characterId` + `text` | `characterName`/`expression`/`sceneId`/`sceneName` | `{"kind":"dialogue","characterId":"...","characterName":"林小满","expression":"疑惑","text":"灯塔为什么会发光？"}` |
| `narration` | `text` | `sceneId`/`sceneName` | `{"kind":"narration","text":"晨雾中，码头木桩上的贝壳闪着微光。"}` |
| `scene` | `sceneId` | `sceneName` | `{"kind":"scene","sceneId":"...","sceneName":"晨光镇·紫雾码头"}` |

**规则**：
- 行 id 由服务端生成，**客户端/LLM 绝不自定义 id**
- dialogue 不给 `characterId` 会生成 `未命名` 占位角色（编辑页橙色 ⚠️ 提示）——先建角色拿 id
- 表情用「疑惑/愤怒/微笑/低声/沉默半晌」等自然中文短语

---

## 5. 红线规则（违反即返工）

1. **id 一律服务端生成**；写行/建实体不带 id。
2. **先查重后创建**：角色名/场景名/小章节名重复 → 400；用 overview/condense 先查。
3. **小章节名全局唯一**（= LetsGal 章节文件名）。
4. **dialogue 必须有 characterId**。
5. **只走 API，不直接读写 project.json**；server 单实例（多实例会并发写坏文件）。
6. **先 dry_run / apply=false 预览，确认后再落库**（同步导出、自由转标准）。
7. **改写保留行 id**（同步映射依赖）。

---

## 6. 质量门禁（每次写作任务收尾必做）✅

```
1. GET .../check          → {"ok":true,"issue_count":0} 才算完成
2. GET .../search?q=关键剧情词 → 确认新内容可检索、命中位置正确
3. 更新该章 condense（如本章剧情有推进）
4. 汇报：创建了什么（id 列表）、改了什么、check 结果
```

---

## 7. 常见错误处置表

| 状态码 | 含义 | 处置 |
|---|---|---|
| 400 | 重名 / 空名 / 边界 / 目录不存在 | 读 `detail`；先查重再改；移动操作已在边界 |
| 404 | 资源不存在（id 错/已删） | `overview`/`condense`/`chapters` 重新取 id |
| 409 | 删除被引用角色 / 非空大章节删除 | 先解除引用（改行 characterId）或移走小章节 |
| 422 | 参数校验失败 | 检查字段名/类型（camelCase！） |
| 500 | 服务端异常 | 联系维护者；检查是否多实例并发写 |

---

## 8. 写作风格建议（供 AI 参考，非强制）

- 对白符合人设：倔强少女不会说教式台词；海底王子用词带"雾/潮/城门"意象。
- 旁白制造画面感：场景行之后跟 1-2 句氛围旁白再进对话。
- 伏笔密度：每 3-5 章埋 1 个可回收伏笔；回收时写清"如何回收"。
- 每章 condense 一句话总结核心事件，便于后续 AI 接力。
- 子片段用于「可选/分支/补充」内容（对应 LetsGal 命名 fragment），正文主线放 lines。

---

## 9. 给集成方（内置 AI 功能）的建议

- 将 `AI-PROMPTS.md` 的 system prompt 作为 AI 协作入口的**默认上下文**。
- 用户意图 → 匹配 §3 的场景 SOP → 按步骤调 API → 汇报结果。
- 每轮写作后把「新建 id 清单 + check 结果」回传给用户确认，避免连锁错误。
