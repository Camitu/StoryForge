# StoryForge Server

StoryForge 项目服务：本地 FastAPI + JSON 工程文件存储，为外部 AI Agent（如 DSH）提供协作 API。

- **权威存储**：JSON 工程文件（`data/projects/<id>.json`），与 `@storyforge/shared` 类型一一对应，git 友好。
- **服务地址**：`http://127.0.0.1:8790`（与 MemoVault 的 8721 区分）。
- **API 文档**：启动后访问 `http://127.0.0.1:8790/docs`。

## 运行

```bash
cd server
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8790
```

## AI 协作 API（P0）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/projects` | 列出工程 |
| POST | `/api/projects` | 新建工程 |
| GET | `/api/projects/{id}` | 获取工程 |
| PUT | `/api/projects/{id}` | 更新工程 |
| DELETE | `/api/projects/{id}` | 删除工程 |
| GET | `/api/projects/{id}/context?at=…` | 取叙事世界状态快照（浓缩上下文） |
| POST | `/api/projects/{id}/sections/{sid}/beats` | 提交/改写 beat（锚点保护） |
| POST | `/api/projects/{id}/sections/{sid}/condense` | 写入剧情浓缩（StateDelta） |
| POST | `/api/projects/{id}/sections/{sid}/foreshadow` | 登记伏笔 |
| POST | `/api/projects/{id}/sections/{sid}/foreshadow/{fid}/resolve` | 回收伏笔 |
| GET | `/api/projects/{id}/check` | 一致性检查（机械校验） |

> 语义生成（写剧情、生成浓缩、语义查错）由外部 AI Agent 完成；本服务负责数据层 + 机械校验。
