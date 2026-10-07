"""Create the vertical Komachi promotional Short from existing gameplay.

Requires Pillow and imageio-ffmpeg. Run: python scripts/edit-youtube-short.py
"""
from pathlib import Path
import array
import json
import math
import subprocess
import wave
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trailer/shorts'
OUT.mkdir(parents=True, exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = ROOT / 'output/trailer/komachi-trailer.mp4'
W, H = 1080, 1920
CREAM, GREEN, DARK = '#fff6e6', '#bedb9c', '#102b2c'


def run(args):
    result = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result


def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf', size)


SHOTS = [
    (21.8, ['Need a little', 'escape?'], 'A COSY JAPANESE TOWN BUILDER', 'A small world. A slower pace.'),
    (4.4, ['Build your', 'quiet corner.'], 'KOMACHI', 'Residents arrive by train.'),
    (8.9, ['Watch it', 'come alive.'], 'KOMACHI', 'Builders bring your town to life.'),
    (13.1, ['New arrivals.', 'Little journeys.'], 'KOMACHI', 'Cars come in on the ferry.'),
    (17.6, ['Let the days', 'drift by.'], 'KOMACHI', 'Rain falls. Life carries on.'),
    (26.0, ['Stay for', 'every season.'], 'KOMACHI', 'Snow settles over the rooftops.'),
    (22.2, ['A town to', 'call your own.'], 'KOMACHI', 'Build a little. Stay awhile.'),
    (0.4, [], '', ''),
]


def overlay(index, lines, kicker, detail):
    img = Image.new('RGBA', (W, H), DARK)
    draw = ImageDraw.Draw(img)
    # Real gameplay occupies the centre; text avoids Shorts controls and bottom UI.
    draw.rectangle((0, 440, W, 1460), fill=(0, 0, 0, 0))
    draw.text((82, 155), kicker, fill=GREEN, font=font(28, True))
    for n, line in enumerate(lines):
        draw.text((78, 220 + n * 90), line, fill=CREAM, font=font(76, True))
    draw.rounded_rectangle((82, 1515, 150, 1521), radius=3, fill=GREEN)
    draw.text((82, 1560), detail, fill=CREAM, font=font(34))
    draw.text((82, 1660), 'ACTUAL GAMEPLAY  /  SAISS', fill='#87a5a1', font=font(22, True))
    if index == 7:
        img = Image.new('RGBA', (W, H), DARK)
        draw = ImageDraw.Draw(img)
        draw.text((82, 180), 'YOUR LITTLE ESCAPE', fill=GREEN, font=font(30, True))
        draw.rounded_rectangle((72, 300, 945, 685), radius=28, fill=CREAM)
        logo = Image.open(ROOT / 'assets/brand/komachi-wordmark.png').convert('RGBA')
        logo.thumbnail((730, 280), Image.Resampling.LANCZOS)
        img.alpha_composite(logo, ((1017 - logo.width) // 2, 340))
        draw = ImageDraw.Draw(img)
        draw.rectangle((0, 740, W, 1350), fill=(0, 0, 0, 0))
        draw.text((82, 1395), 'Build a little town.', fill=CREAM, font=font(51, True))
        draw.rounded_rectangle((82, 1510, 918, 1620), radius=25, fill=GREEN)
        draw.text((500, 1530), 'PLAY · LINK ON OUR CHANNEL', anchor='mt', fill=DARK, font=font(36, True))
        draw.text((82, 1660), 'KOMACHI  /  A GAME BY SAISS', fill='#87a5a1', font=font(22, True))
    path = OUT / f'overlay-{index:02}.png'
    img.save(path)
    return path


def score(duration=24):
    # Original mellow chord bed and plucked arpeggio, generated for this promo.
    rate = 48000
    data = array.array('f', [0]) * (duration * rate)
    chords = [(48, 55, 60, 64), (45, 52, 57, 60), (41, 48, 53, 57), (43, 50, 55, 59)]
    for beat in range(duration * 2):
        chord = chords[(beat // 12) % 4]
        midi = chord[beat % 4] + 12
        hz = 440 * 2 ** ((midi - 69) / 12)
        start = beat * rate // 2
        for i in range(min(rate, len(data) - start)):
            t = i / rate
            env = min(1, t / .015) * math.exp(-t * 5)
            data[start + i] += .17 * env * (math.sin(2 * math.pi * hz * t) + .15 * math.sin(4 * math.pi * hz * t))
    for c in range(duration // 3):
        notes = chords[(c // 2) % 4]
        for midi in notes:
            hz = 440 * 2 ** ((midi - 69) / 12)
            start = c * 3 * rate
            for i in range(3 * rate):
                t = i / rate
                env = min(1, t / .3) * min(1, (3 - t) / .6)
                data[start + i] += .033 * env * math.sin(2 * math.pi * hz * t)
    pcm = array.array('h', (int(max(-1, min(1, v)) * 32767) for v in data))
    path = OUT / 'original-score.wav'
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(pcm.tobytes())
    return path


def main():
    clips = []
    for i, (start, lines, kicker, detail) in enumerate(SHOTS):
        card = overlay(i, lines, kicker, detail)
        target = OUT / f'clip-{i:02}.mp4'
        if i == 7:
            base = 'scale=1080:608,pad=1080:1920:0:740:color=0x102b2c'
        else:
            base = 'scale=-2:1020,crop=1080:1020,pad=1080:1920:0:440:color=0x102b2c'
        run(['-ss', start, '-i', SOURCE, '-loop', '1', '-i', card,
             '-filter_complex', f'[0:v]fps=30,{base},setsar=1[b];[b][1:v]overlay=0:0,format=yuv420p[v]',
             '-map', '[v]', '-an', '-t', '3', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-y', target])
        clips.append(target)
        print(f'Edited shot {i + 1}/8', flush=True)
    listing = OUT / 'concat.txt'
    listing.write_text(''.join(f"file '{p.name}'\n" for p in clips), encoding='utf-8')
    target = OUT / 'komachi-youtube-short-24s.mp4'
    run(['-f', 'concat', '-safe', '0', '-i', listing, '-i', score(), '-map', '0:v', '-map', '1:a',
         '-c:v', 'copy', '-af', 'afade=t=in:d=0.2,afade=t=out:st=22.8:d=1.2,loudnorm=I=-16:TP=-1.5:LRA=7',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '24', '-movflags', '+faststart', '-y', target])
    run(['-i', target, '-f', 'null', '-'])
    probe = subprocess.run([FF, '-hide_banner', '-i', str(target)], capture_output=True, text=True)
    info = '\n'.join(x.strip() for x in probe.stderr.splitlines() if any(k in x for k in ['Duration:', 'Video:', 'Audio:']))
    if not all(k in info for k in ['00:00:24.00', '1080x1920', '30 fps', 'Video: h264', 'Audio: aac']):
        raise RuntimeError(info)
    (OUT / 'validation.txt').write_text('Full video/audio decode: PASS\n' + info, encoding='utf-8')
    sheet = Image.new('RGB', (1080, 1020), DARK)
    for i in range(8):
        shot = OUT / f'review-{i:02}.jpg'
        run(['-ss', i * 3 + 1, '-i', target, '-frames:v', '1', '-vf', 'scale=270:480', '-update', '1', '-y', shot])
        sheet.paste(Image.open(shot), ((i % 4) * 270, (i // 4) * 510))
        ImageDraw.Draw(sheet).text(((i % 4) * 270 + 10, (i // 4) * 510 + 485), f'{i * 3 + 1}s', fill=CREAM, font=font(17))
    sheet.save(OUT / 'contact-sheet.jpg', quality=93)
    run(['-ss', 1, '-i', target, '-frames:v', '1', '-update', '1', '-y', OUT / 'poster.jpg'])
    (OUT / 'edit-notes.json').write_text(json.dumps({'source': str(SOURCE), 'shots': SHOTS, 'music': 'Original synthesized score', 'duration': 24, 'size': [W, H]}, indent=2), encoding='utf-8')
    print(info, flush=True)


if __name__ == '__main__':
    main()
