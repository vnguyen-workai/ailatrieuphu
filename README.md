# Thử Thách Triệu Phú

Trò chơi đố vui 15 câu hỏi bằng tiếng Việt, với 776 câu hỏi thuộc 6 chủ đề.

## Chơi

Mở `index.html` bằng trình duyệt, hoặc chạy máy chủ tĩnh:

```bash
python3 -m http.server 8765
```

rồi vào http://localhost:8765. Có thể đưa nguyên thư mục lên GitHub Pages hoặc Netlify, không cần build.

## Thêm hoặc sửa câu hỏi

Câu hỏi nằm trong `questions/*.json`, mỗi câu có dạng:

```json
{"t": "khoa-hoc", "d": 2, "q": "Câu hỏi?", "a": ["Đáp án đúng", "Sai 1", "Sai 2", "Sai 3"]}
```

- `a[0]` luôn là đáp án đúng; thứ tự được xáo trộn khi chơi.
- `d`: 1 = dễ (câu 1–5), 2 = trung bình (câu 6–10), 3 = khó (câu 11–15).

Sau khi sửa, chạy lại để tạo `questions.js`, kiểm tra trùng lặp và lỗi định dạng:

```bash
python3 build.py
```
