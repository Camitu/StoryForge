# -*- coding: utf-8 -*-
"""端到端冒烟测试（v3）：工程 CRUD、世界观/人设/场景/章节/行/伏笔/搜索/检查。

运行：.venv\\Scripts\\python smoke_test.py
"""
import json
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
TMP = Path(tempfile.gettempdir()) / f"sf_smoke_{uuid.uuid4().hex[:8]}"


def main():
    TMP.mkdir(parents=True, exist_ok=True)

    # 1. 新建工程（storageDir）
    r = client.post("/api/projects", json={"name": "冒烟测试", "storageDir": str(TMP)})
    print("1 CREATE", r.status_code, "→", r.json().get("name"))
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert (TMP / "project.json").exists()

    # 2. 读取工程
    r = client.get(f"/api/projects/{pid}")
    print("2 GET", r.status_code, "→", r.json()["name"])
    assert r.status_code == 200

    # 3. 世界观
    r = client.put(f"/api/projects/{pid}/worldview", json={"worldview": "现代都市恋爱"})
    print("3 WORLDVIEW", r.status_code, "→", r.json()["worldview"])
    assert r.status_code == 200

    # 4. 人设
    r = client.post(f"/api/projects/{pid}/characters", json={"name": "刘苏", "note": "男主角"})
    print("4 CHAR", r.status_code)
    assert r.status_code == 201
    cid = r.json()["id"]

    # 5. 场景
    r = client.post(f"/api/projects/{pid}/scenes", json={"name": "秋谷浴场"})
    print("5 SCENE", r.status_code)
    assert r.status_code == 201
    scid = r.json()["id"]

    # 6. 大章节 + 小章节
    r = client.post(f"/api/projects/{pid}/chapters", json={"name": "第一幕"})
    assert r.status_code == 201
    chid = r.json()["id"]
    r = client.post(f"/api/projects/{pid}/chapters/{chid}/subchapters",
                    json={"name": "序章", "date": "07-01", "summary": "初到浴场"})
    print("6 SUBCHAPTER", r.status_code)
    assert r.status_code == 201
    sid = r.json()["id"]

    # 7. 行
    r = client.post(f"/api/projects/{pid}/subchapters/{sid}/lines",
                    json={"kind": "dialogue", "characterId": cid, "characterName": "刘苏",
                          "text": "这里就是浴场吗？", "sceneId": scid, "sceneName": "秋谷浴场"})
    print("7 LINE", r.status_code, "→", r.json()["kind"])
    assert r.status_code == 201

    # 8. 伏笔登记 + 回收
    r = client.post(f"/api/projects/{pid}/foreshadows", json={"content": "姑姑的秘密", "subChapterId": sid})
    assert r.status_code == 201
    fid = r.json()["id"]
    r = client.post(f"/api/projects/{pid}/foreshadows/{fid}/resolve", json={"subChapterId": sid, "note": "真相大白"})
    print("8 FORESHADOW", r.status_code, "→", r.json()["status"])
    assert r.status_code == 200

    # 9. 搜索
    r = client.get(f"/api/projects/{pid}/search?q=浴场")
    print("9 SEARCH", r.status_code, "results:", len(r.json()))
    assert r.status_code == 200 and len(r.json()) >= 1

    # 10. 一致性检查
    r = client.get(f"/api/projects/{pid}/check")
    print("10 CHECK", r.status_code, "ok:", r.json()["ok"])
    assert r.status_code == 200

    # 11. 删除角色引用保护
    r = client.delete(f"/api/projects/{pid}/characters/{cid}")
    print("11 DELETE_CHAR_GUARD", r.status_code, "(expect 409)")
    assert r.status_code == 409

    # 12. 清理
    r = client.delete(f"/api/projects/{pid}")
    print("12 CLEANUP", r.status_code)
    assert r.status_code == 204
    shutil.rmtree(TMP, ignore_errors=True)

    print("\nSMOKE_TEST_ALL_OK")


if __name__ == "__main__":
    main()
