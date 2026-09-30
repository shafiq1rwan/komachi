"""Edit existing Komachi gameplay into a 30-second promotional trailer.

Run with the workspace Python runtime (Pillow + imageio-ffmpeg).
Keeps the original recordings and all game source unchanged.
"""
from pathlib import Path
import json
import subprocess
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trailer/promo'
OUT.mkdir(parents=True, exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = ROOT / 'output/trailer/komachi-trailer.mp4'
W, H, FPS = 1280, 720, 30
CREAM = '#fff8e9'
FONT = Path('C:/Windows/Fonts/segoeui.ttf')
BOLD = Path('C:/Windows/Fonts/segoeuib.ttf')


def run(args):
    result = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', *map(str, args)],
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def centered(draw, y, text, size, fill, bold=False):
    draw.text((W / 2, y), text, font=font(size, bold), fill=fill, anchor='mt')


def caption(name, text, kicker=None):
    img = Image.new('RGBA', (W, H))
    # A restrained bottom gradient leaves the centre of the gameplay unobstructed.
    gradient = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(gradient)
    for y in range(420, H):
        t = (y - 420) / (H - 420)
        d.line((0, y, W, y), fill=(13, 31, 30, int(190 * t ** 1.3)))
    img.alpha_composite(gradient)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((55, 581, 97, 585), radius=2, fill='#c6d9ae')
    if kicker:
        draw.text((55, 552), kicker, font=font(16, True), fill='#dce7d0')
    draw.text((55, 603), text, font=font(39, True), fill=CREAM,
              stroke_width=1, stroke_fill=(0, 0, 0, 40))
    path = OUT / f'{name}-overlay.png'
    img.save(path)
    return path


def endcard():
    img = Image.new('RGBA', (W, H), (9, 27, 31, 140))
    shadow = Image.new('RGBA', (W, H))
    ImageDraw.Draw(shadow).rounded_rectangle((306, 167, 974, 577), radius=26,
                                             fill=(0, 0, 0, 100))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(20)))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((310, 155, 970, 565), radius=24, fill=(255, 248, 233, 246))
    logo = Image.open(ROOT / 'assets/brand/komachi-wordmark.png').convert('RGBA')
    logo.thumbnail((480, 190), Image.Resampling.LANCZOS)
    img.alpha_composite(logo, ((W - logo.width) // 2, 190))
    draw = ImageDraw.Draw(img)
    centered(draw, 393, 'Build a little town. Watch it come alive.', 24, '#29413a')
    draw.rounded_rectangle((511, 450, 769, 507), radius=28, fill='#3b6551')
    centered(draw, 461, 'Play Komachi', 25, CREAM, True)
    centered(draw, 531, 'A GAME BY SAISS', 13, '#627465', True)
    path = OUT / 'endcard-overlay.png'
    img.save(path)
    return path


def encode_clip(name, start, duration, overlay, source_duration=None):
    output = OUT / f'{name}.mp4'
    base = 'fps=30,setsar=1'
    if source_duration:
        base += ',tpad=stop_mode=clone:stop_duration=1'
    filters = f'[0:v]{base}[base];[base][1:v]overlay=0:0:format=auto,format=yuv420p[v]'
    input_options = ['-ss', start]
    if source_duration:
        input_options += ['-t', source_duration]
    run([*input_options, '-i', SOURCE, '-loop', '1', '-i', overlay,
         '-filter_complex', filters, '-map', '[v]', '-an', '-t', duration,
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', FPS,
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', output])
    print(f'Edited {name}: {duration}s', flush=True)
    return output


def finish(clips, filename, duration):
    listing = OUT / f'{filename}-concat.txt'
    listing.write_text(''.join("file '" + p.name + "'\n" for p in clips), encoding='utf-8')
    target = OUT / f'{filename}.mp4'
    run(['-f', 'concat', '-safe', '0', '-i', listing,
         '-stream_loop', '-1', '-i', ROOT / 'assets/audio/bgm/menu.mp3',
         '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
         '-crf', '18', '-pix_fmt', 'yuv420p',
         '-vf', f'fade=t=in:st=0:d=0.18,fade=t=out:st={duration - 0.5}:d=0.5',
         '-af', f'volume=0.72,afade=t=in:st=0:d=0.7,afade=t=out:st={duration - 2}:d=2',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', duration,
         '-movflags', '+faststart', '-metadata', 'title=Komachi | A little town, a life of its own',
         '-metadata', 'artist=Saiss', '-y', target])
    print(f'Finished {target.name}: {target.stat().st_size / 1048576:.1f} MB', flush=True)
    return target


def verify_and_preview(target, duration):
    # Decode the complete export, rather than relying on a successful encode alone.
    decoded = run(['-i', target, '-f', 'null', '-'])
    if decoded.stderr.strip():
        raise RuntimeError(decoded.stderr)
    probe = subprocess.run([FFMPEG, '-hide_banner', '-i', str(target)],
                           capture_output=True, text=True)
    info = '\n'.join(x.strip() for x in probe.stderr.splitlines()
                     if 'Duration:' in x or 'Video:' in x or 'Audio:' in x)
    if '1280x720' not in info or '30 fps' not in info or 'Audio: aac' not in info:
        raise RuntimeError('Unexpected export format: ' + info)
    samples = [1, 5, 9, 13, 17, 21, 24, 28] if duration == 30 else [1, 4, 7, 10, 13]
    sheet = Image.new('RGB', (960, 298 * ((len(samples) + 1) // 2)), '#20332b')
    draw = ImageDraw.Draw(sheet)
    for index, second in enumerate(samples):
        shot = OUT / f'{target.stem}-review-{second:02}.jpg'
        run(['-ss', second, '-i', target, '-frames:v', '1', '-vf', 'scale=480:270',
             '-update', '1', '-y', shot])
        frame = Image.open(shot).convert('RGB')
        sheet.paste(frame, ((index % 2) * 480, (index // 2) * 298))
        draw.text(((index % 2) * 480 + 12, (index // 2) * 298 + 275),
                  f'{second:02}s', fill=CREAM, font=font(14))
    sheet.save(OUT / f'{target.stem}-contact-sheet.jpg', quality=92)
    run(['-ss', '1', '-i', target, '-frames:v', '1', '-update', '1', '-y',
         OUT / f'{target.stem}-poster.jpg'])
    (OUT / f'{target.stem}-validation.txt').write_text(
        'Complete video and audio decode: PASS\n' + info + '\n', encoding='utf-8')
    print('Verified ' + target.name + '\n' + info, flush=True)


if __name__ == '__main__':
    shots = [
        ('01-life', 4.2, 4.0, 'A little town. A life of its own.', 'A COSY JAPANESE TOWN BUILDER'),
        ('02-build', 8.98, 3.7, 'Build your own quiet corner.', None),
        ('03-ferry', 13.05, 4.0, 'Little journeys. New arrivals.', None),
        ('04-rain', 17.6, 3.6, 'Let the days drift by.', None),
        ('05-winter', 26.1, 3.6, 'Through every season.', None),
        ('06-night', 21.62, 4.0, 'Slow down. Stay awhile.', None),
        ('07-island', 0.3, 3.1, 'A small world to call your own.', None),
    ]
    clips = [encode_clip(name, start, duration, caption(name, text, kicker))
             for name, start, duration, text, kicker in shots]
    clips.append(encode_clip('08-title', 30.6, 4.0, endcard(), source_duration=3.2))
    main = finish(clips, 'komachi-promo-30s', 30)
    # A tighter edit for a feed post, using the same source quality and clear ending.
    teaser_shots = [
        ('teaser-life', 4.3, 3.0, 'A little town. A life of its own.'),
        ('teaser-build', 9.1, 3.0, 'Build your own quiet corner.'),
        ('teaser-ferry', 13.2, 3.0, 'Watch it come alive.'),
        ('teaser-night', 21.7, 3.0, 'Slow down. Stay awhile.'),
    ]
    teaser_clips = [encode_clip(name, start, duration, caption(name, text))
                    for name, start, duration, text in teaser_shots]
    teaser_clips.append(encode_clip('teaser-title', 30.6, 3.0, endcard()))
    teaser = finish(teaser_clips, 'komachi-teaser-15s', 15)
    verify_and_preview(main, 30)
    verify_and_preview(teaser, 15)
    (OUT / 'edit-notes.json').write_text(json.dumps({
        'source': str(SOURCE), 'music': 'assets/audio/bgm/menu.mp3',
        'resolution': [W, H], 'fps': FPS, 'duration': 30,
        'shots': shots, 'outputs': [str(main), str(teaser)],
        'note': 'Edited from actual in-game footage. No generated gameplay or game-source changes.'
    }, indent=2), encoding='utf-8')
