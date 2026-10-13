#!/usr/bin/env python3
"""
Tạo trang chia sẻ riêng cho từng nhân vật (để dán link lên Discord / Facebook / Zalo
hiện đúng tên + mô tả nhân vật thay vì thông tin chung của cả web).

Cách dùng (chạy ở thư mục gốc của web, nơi có characters.html):

    python3 tools/build_share_pages.py
    python3 tools/build_share_pages.py --site-url https://ten-mien-cua-ban.com --image images/og-cover.jpg

Kết quả:
    share/<slug>.html   mỗi nhân vật một trang (người xem được chuyển thẳng tới modal nhân vật)
    share/map.json      bảng tên nhân vật -> slug (script.js dùng để tạo link chia sẻ)

Chạy lại script mỗi khi thêm / đổi tên nhân vật trong characters.html.
"""
import argparse
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote


def clean(text: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def slugify(name: str) -> str:
    s = name.replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "nv-" + hashlib.md5(name.encode("utf-8")).hexdigest()[:8]


def share_key(name: str) -> str:
    # Phải khớp hàm shareKey() trong script.js
    return unicodedata.normalize("NFC", name).strip().lower()


def parse_characters(src: str):
    names = list(re.finditer(r'class="bot-name"[^>]*>(.*?)</h3>', src, re.S))
    chars = []
    prev_end = 0
    for i, m in enumerate(names):
        name = clean(m.group(1))
        before = src[prev_end:m.start()]
        seg_end = names[i + 1].start() if i + 1 < len(names) else len(src)
        seg = src[m.end():seg_end]
        prev_end = m.end()

        if not name or name == "Coming Soon..." or "secret-cat-card" in before[-600:]:
            continue

        tags = re.search(r'class="bot-tags"[^>]*>(.*?)</div>', seg, re.S)
        desc = re.search(r'class="bot-desc"[^>]*>(.*?)</p>', seg, re.S)
        chars.append({
            "name": name,
            "tags": clean(tags.group(1)) if tags else "",
            "desc": clean(desc.group(1)) if desc else "",
        })
    return chars


PAGE = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Tiệm Sách Evans" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
{extra_meta}  <meta http-equiv="refresh" content="0;url={target}" />
</head>
<body style="font-family: sans-serif; background: #3a3226; color: #f4e8d1; text-align: center; padding: 40px;">
  <p>Đang mở <a style="color: #e5b95d;" href="{target}">{name}</a>…</p>
  <script>location.replace({target_js});</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default="characters.html", help="đường dẫn characters.html")
    ap.add_argument("--out", default="share", help="thư mục xuất")
    ap.add_argument("--site-url", default="", help="địa chỉ web, vd https://example.com (để có og:url / og:image tuyệt đối)")
    ap.add_argument("--image", default="", help="ảnh xem trước, đường dẫn tính từ gốc web, vd images/og-cover.jpg")
    args = ap.parse_args()

    src = Path(args.html).read_text(encoding="utf-8")
    chars = parse_characters(src)
    if not chars:
        raise SystemExit("Không tìm thấy nhân vật nào trong " + args.html)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    site = args.site_url.rstrip("/")

    used, mapping = set(), {}
    for c in chars:
        slug = base = slugify(c["name"])
        n = 2
        while slug in used:
            slug = f"{base}-{n}"
            n += 1
        used.add(slug)
        mapping[share_key(c["name"])] = slug

        desc = c["desc"].strip('"“”') or "Nhân vật trong Tiệm Sách Evans"
        if c["tags"]:
            desc = f"{desc} — {c['tags']}"
        desc = (desc[:197] + "…") if len(desc) > 200 else desc

        title = f"{c['name']} — Tiệm Sách Evans"
        target = "../characters.html#nv=" + quote(c["name"], safe="")
        extra = ""
        if site:
            extra += f'  <meta property="og:url" content="{html.escape(site + "/share/" + slug + ".html")}" />\n'
        if args.image:
            img = site + "/" + args.image.lstrip("/") if site else args.image
            extra += f'  <meta property="og:image" content="{html.escape(img)}" />\n'
            extra += '  <meta name="twitter:card" content="summary_large_image" />\n'
        else:
            extra += '  <meta name="twitter:card" content="summary" />\n'

        page = PAGE.format(
            title=html.escape(title),
            desc=html.escape(desc),
            name=html.escape(c["name"]),
            target=html.escape(target),
            target_js=json.dumps(target),
            extra_meta=extra,
        )
        (out / f"{slug}.html").write_text(page, encoding="utf-8")

    (out / "map.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Đã tạo {len(chars)} trang trong {out}/ và {out}/map.json")
    if not site:
        print("Gợi ý: thêm --site-url (và --image) để link chia sẻ có ảnh xem trước đầy đủ.")


if __name__ == "__main__":
    main()
