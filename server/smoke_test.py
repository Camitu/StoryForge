# -*- coding: utf-8 -*-
"""端到端冒烟测试：覆盖工程 CRUD、上下文快照、beat 提交（锚点保护）、浓缩、伏笔、一致性检查。

运行：.venv\\Scripts\\python smoke_test.py
"""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
SAMPLE = Path(__file__).parent.parent / "shared" / "examples" / "sample-project.json"


def main():
    sample = json.loads(SAMPLE.read_text(encoding="utf-8"))
    pid = sample["id"]

    # 1. 创建工程
    r = client.post("/api/projects", json=sample)
    print("1 CREATE", r.status_code)
    assert r.status_code == 201, r.text

    # 2. 读取工程
    r = client.get(f"/api/projects/{pid}")
    print("2 GET", r.status_code, "→", r.json()["name"])
    assert r.status_code == 200

    # 3. 上下文快照
    r = client.get(f"/api/projects/{pid}/context")
    ctx = r.json()
    print("3 CONTEXT", r.status_code, f"atTime={ctx['atTime']!r} openForeshadows={len(ctx['openForeshadows'])}")
    assert r.status_code == 200

    # 4. 追加 beat
    beats = [{"kind": "narration", "time": "7月8日 傍晚", "text": "雪花落在肩头。"}]
    r = client.post(f"/api/projects/{pid}/sections/sec-001/beats", json=beats, params={"mode": "append"})
    print("4 APPEND", r.status_code, "→", r.json())
    assert r.status_code == 200

    # 5. 锚点保护：试图用同 id 重写锚点 beat-004，应被拒 409
    bad = [{"id": "beat-004", "kind": "narration", "time": "x", "text": "试图修改锚点"}]
    r = client.post(f"/api/projects/{pid}/sections/sec-001/beats", json=bad, params={"mode": "replace"})
    print("5 ANCHOR_REJECT", r.status_code)
    assert r.status_code == 409

    # 6. 浓缩
    delta = {
        "sectionId": "sec-001",
        "characterStateChanges": {},
        "flagChanges": {"重逢": True},
        "foreshadowsPlanted": [],
        "foreshadowsResolved": [],
        "summary": "主角与少女重逢，得知少女将去东京。",
    }
    r = client.post(f"/api/projects/{pid}/sections/sec-001/condense", json=delta)
    print("6 CONDENSE", r.status_code)
    assert r.status_code == 200

    # 7. 登记 + 回收伏笔
    r = client.post(f"/api/projects/{pid}/sections/sec-001/foreshadow", json={"content": "测试伏笔", "tags": ["测试"]})
    fid = r.json()["id"]
    print("7a FORESHADOW_REGISTER", r.status_code, "→", fid)
    assert r.status_code == 201

    r = client.post(f"/api/projects/{pid}/sections/sec-001/foreshadow/{fid}/resolve", json={"note": "已回收"})
    print("7b FORESHADOW_RESOLVE", r.status_code, "→", r.json()["status"])
    assert r.status_code == 200

    # 8. 一致性检查（预期：报告未回收伏笔 fs-001）
    r = client.get(f"/api/projects/{pid}/check")
    chk = r.json()
    print("8 CHECK", r.status_code, f"ok={chk['ok']} issues={chk['issue_count']}")
    for i in chk["issues"]:
        print("   -", i)
    assert r.status_code == 200

    # 9. 清理测试工程
    r = client.delete(f"/api/projects/{pid}")
    print("9 CLEANUP", r.status_code)

    print("\nSMOKE_TEST_ALL_OK")


if __name__ == "__main__":
    main()
