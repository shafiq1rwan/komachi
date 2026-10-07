"""Prepare the existing Komachi brand icon as a transparent channel watermark."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/youtube'
OUT.mkdir(parents=True, exist_ok=True)
source = Image.open(ROOT / 'assets/brand/komachi-icon.png').convert('RGBA')
# Trim the transparent margin and stray pixels outside the existing icon.
icon = source.crop((95, 100, 1160, 1185))
icon = ImageOps.contain(icon, (464, 464), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (512, 512))
canvas.alpha_composite(icon, ((512 - icon.width) // 2, (512 - icon.height) // 2))
# A fine cream keyline keeps the brand visible against both day and night footage.
alpha = canvas.getchannel('A')
outline = Image.new('RGBA', canvas.size, '#fff8e9')
outline.putalpha(alpha.filter(ImageFilter.MaxFilter(5)))
outline.alpha_composite(canvas)
target = OUT / 'komachi-video-watermark.png'
outline.save(target, optimize=True)
assert target.stat().st_size < 1_000_000
assert Image.open(target).size == (512, 512)
assert Image.open(target).getpixel((0, 0))[3] == 0
preview = Image.new('RGB', (680, 240), '#fff8e9')
draw = ImageDraw.Draw(preview)
draw.rectangle((340, 0, 680, 240), fill='#123833')
for x, colour in [(0, '#284834'), (340, '#fff8e9')]:
    for offset, size in [(35, 150), (235, 48)]:
        small = outline.resize((size, size), Image.Resampling.LANCZOS)
        preview.paste(small, (x + offset, 35), small)
        draw.text((x + offset, 195), f'{size}px preview', fill=colour)
preview.save(OUT / 'watermark-preview.jpg', quality=94)
(OUT / 'watermark-readme.txt').write_text(
    'Komachi channel video watermark\n512 x 512 transparent PNG, under 1 MB. Derived from the existing brand icon.\n'
    'YouTube Studio > Customization > Profile > Video watermark > upload komachi-video-watermark.png > Entire video > Publish.\n'
    'YouTube documents this watermark for landscape playback; it is not a reliable way to brand the Shorts feed. The existing Short already includes Komachi captions and an end card.\n'
    'Official guidance: https://support.google.com/youtube/answer/10456525?hl=en\n', encoding='utf-8')
print(f'{target}: {target.stat().st_size / 1024:.1f} KB; transparent RGBA, 512 x 512')
