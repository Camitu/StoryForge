# -*- coding: utf-8 -*-
"""一次性验证：行插入 afterId（Enter 续行定位插入）。运行：.venv\Scripts\python verify_afterid.py
   完成后自清理，不影响既有数据。"""
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
TMP = Path(tempfile.gettempdir()) / f"sf_verify_afterid_{uuid.uuid4().hex[:8]}"
pid = None
sid = None


def _lines():
    r = client.get(f"/api/projects/{pid}/subchapters/{sid}")
    return r.json()["lines"]


def main():
    global pid, sid
    TMP.mkdir(parents=True, exist_ok=True)
    r = client.post("/api/projects", json={"name": "afterId验证", "storageDir": str(TMP)})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    try:
        chid = client.post(f"/api/projects/{pid}/chapters", json={"name": "幕"}).json()["id"]
        sid = client.post(f"/api/projects/{pid}/chapters/{chid}/subchapters",
                          json={"name": "章"}).json()["id"]

        def add(text, after=None):
            body = {"kind": "narration", "text": text}
            if after:
                body["afterId"] = after
            rr = client.post(f"/api/projects/{pid}/subchapters/{sid}/lines", json=body)
            assert rr.status_code == 201, rr.text
            return rr.json()

        a = add("A")
        b = add("B")
        assert [l["text"] for l in _lines()] == ["A", "B"], _lines()

        c = add("C", after=a["id"])  # 插入到 A 之后
        assert [l["text"] for l in _lines()] == ["A", "C", "B"], _lines()

        d = add("D", after=a["id"])  # 再插到 A 之后 → A, D, C, B
        assert [l["text"] for l in _lines()] == ["A", "D", "C", "B"], _lines()

        e = add("E", after="不存在-id")  # afterId 失效 → 追加末尾
        assert [l["text"] for l in _lines()] == ["A", "D", "C", "B", "E"], _lines()

        # 行数据里不应包含 afterId 字段
        for l in _lines():
            assert "afterId" not in l, l

        # 片段行同样支持
        frag = client.post(f"/api/projects/{pid}/subchapters/{sid}/fragments",
                           json={"name": "f1"}).json()
        fa = client.post(f"/api/projects/{pid}/subchapters/{sid}/fragments/{frag['id']}/lines",
                         json={"kind": "dialogue", "characterId": "", "characterName": "某人", "text": "FA"}).json()
        fb = client.post(f"/api/projects/{pid}/subchapters/{sid}/fragments/{frag['id']}/lines",
                         json={"kind": "dialogue", "characterId": "", "characterName": "某人", "text": "FB", "afterId": fa["id"]}).json()
        r = client.get(f"/api/projects/{pid}/subchapters/{sid}")
        frag_lines = [x["text"] for x in r.json()["fragments"][0]["lines"]]
        assert frag_lines == ["FA", "FB"], frag_lines

        # 更新行时 afterId 不应被写入行对象
        client.put(f"/api/projects/{pid}/subchapters/{sid}/lines/{a['id']}",
                   json={"kind": "narration", "text": "A2", "afterId": "不应写入"})
        r = client.get(f"/api/projects/{pid}/subchapters/{sid}")
        line_a = next(x for x in r.json()["lines"] if x["id"] == a["id"])
        assert "afterId" not in line_a and line_a["text"] == "A2", line_a

        print("AFTERID_INSERT_ALL_OK")
    finally:
        client.delete(f"/api/projects/{pid}")
        shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    main()
