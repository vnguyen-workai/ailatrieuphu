#!/usr/bin/env python3
"""Gộp và kiểm tra các file questions/*.json thành questions.js cho trang web.

Mỗi câu hỏi: {"t": chủ đề, "d": 1|2|3, "q": câu hỏi, "a": [đáp án đúng, sai, sai, sai]}
Chạy: python3 build.py
"""
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "questions"
OUT = ROOT / "questions.js"
BANNED = re.compile(r"tất cả|cả hai|\bcả a\b|không có đáp án|đều đúng|đều sai", re.I)


def norm(s):
    s = unicodedata.normalize("NFC", s).lower()
    return re.sub(r"[^\w]+", " ", s).strip()


def stamp_versions():
    """Gắn ?v=<mã băm nội dung> vào link CSS/JS trong index.html để trình duyệt không dùng bản cũ trong bộ nhớ đệm."""
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")
    for name in ("style.css", "game.js", "questions.js"):
        digest = hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:8]
        html = re.sub(rf'"{re.escape(name)}(\?v=[^"]*)?"', f'"{name}?v={digest}"', html)
    page.write_text(html, encoding="utf-8")


def main():
    bank, seen, problems = [], {}, []
    for path in sorted(SRC.glob("*.json")):
        try:
            items = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems.append(f"{path.name}: JSON lỗi: {e}")
            continue
        for i, q in enumerate(items):
            where = f"{path.name}#{i}"
            if set(q) != {"t", "d", "q", "a"}:
                problems.append(f"{where}: sai khóa {sorted(q)}")
                continue
            q = {k: unicodedata.normalize("NFC", v) if isinstance(v, str) else v for k, v in q.items()}
            q["a"] = [unicodedata.normalize("NFC", str(x)).strip() for x in q["a"]]
            q["q"] = q["q"].strip()
            if q["d"] not in (1, 2, 3):
                problems.append(f"{where}: độ khó không hợp lệ {q['d']}")
                continue
            if len(q["a"]) != 4 or len({norm(x) for x in q["a"]}) != 4:
                problems.append(f"{where}: cần 4 đáp án khác nhau: {q['a']}")
                continue
            if any(BANNED.search(x) for x in q["a"]):
                problems.append(f"{where}: đáp án kiểu 'tất cả/không có': {q['a']}")
                continue
            key = norm(q["q"])
            if key in seen:
                problems.append(f"{where}: trùng với {seen[key]}: {q['q']}")
                continue
            seen[key] = where
            bank.append(q)

    OUT.write_text(
        "// Tự động tạo bởi build.py — không sửa trực tiếp, hãy sửa questions/*.json\n"
        "window.QUESTION_BANK = "
        + json.dumps(bank, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n{")
        + ";\n",
        encoding="utf-8",
    )

    stamp_versions()
    print(f"Đã ghi {len(bank)} câu hỏi vào {OUT.name}")
    for t, n in sorted(Counter(q["t"] for q in bank).items()):
        by_d = Counter(q["d"] for q in bank if q["t"] == t)
        print(f"  {t:22} {n:4}  (dễ {by_d[1]}, TB {by_d[2]}, khó {by_d[3]})")
    if problems:
        print(f"\n{len(problems)} câu bị loại:")
        for p in problems:
            print("  -", p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
