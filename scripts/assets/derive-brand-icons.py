"""Derive the approved Logo A locally; never calls an image provider."""

from base64 import b64encode
from io import BytesIO
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "src/assets/yozi-mascot/00-reference-front-512.webp"
image = Image.open(MASTER).convert("RGBA")
body = image.crop(image.getchannel("A").getbbox())
head = body.crop((0, 0, body.width, round(body.height * 0.62)))


def fit(source, size, ratio=0.92, background=None):
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    item = source.copy()
    item.thumbnail((round(size * ratio), round(size * ratio)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(item, ((size - item.width) // 2, (size - item.height) // 2))
    return canvas


def png(destination, source):
    path = ROOT / destination
    path.parent.mkdir(parents=True, exist_ok=True)
    source.save(path, format="PNG", optimize=True)


png("src/static/images/logo.png", fit(head, 256))
png("src/static/brand/yozi-mini-icon.png", fit(head, 128))
for size in (192, 512):
    png(f"public/static/pwa-icons/icon-{size}x{size}.png", fit(body, size))
png("public/static/pwa-icons/icon-512x512-maskable.png", fit(body, 512, 0.68, "#eae8fc"))
for name, size in (("32x32", 32), ("128x128", 128), ("128x128@2x", 256)):
    png(f"src-tauri/icons/{name}.png", fit(body, size, 0.86))
fit(body, 512, 0.86).save(ROOT / "src-tauri/icons/icon.icns", format="ICNS")

# PNG-compressed ICO entries preserve transparency, including a legible head at 16/24px.
sizes = (16, 24, 32, 48, 64, 128, 256)
payloads = []
for size in sizes:
    buffer = BytesIO()
    fit(head if size <= 24 else body, size).save(buffer, format="PNG")
    payloads.append(buffer.getvalue())
offset = 6 + 16 * len(sizes)
entries = []
for size, data in zip(sizes, payloads):
    entries.append(struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
    offset += len(data)
(ROOT / "src-tauri/icons/icon.ico").write_bytes(
    struct.pack("<HHH", 0, 1, len(sizes)) + b"".join(entries + payloads)
)

for name, maskable in (("icon.svg", False), ("icon-maskable.svg", True)):
    output = BytesIO()
    fit(body, 512, 0.68 if maskable else 0.92, "#eae8fc" if maskable else None).save(
        output, format="PNG"
    )
    data = b64encode(output.getvalue()).decode("ascii")
    (ROOT / "src/static/brand" / name).write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<image width="512" height="512" href="data:image/png;base64,{data}"/></svg>\n'
    )
print("Derived Logo A favicon, PWA, ICNS and ICO from the approved 512px master.")
