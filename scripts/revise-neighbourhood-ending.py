"""Redesign the neighbourhood Short's ending with a slow, staged reveal."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trailer/first-neighbourhood'
ASSETS = OUT / '_source/single-card-ending'
ASSETS.mkdir(parents=True, exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = OUT / '_source/komachi-first-neighbourhood-short-30s.mp4'
TARGET = OUT / '_source/komachi-first-neighbourhood-single-card-33s.mp4'
W, H = 1080, 1920


def run(args):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r


def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf', size)


run(['-ss', '26.5', '-i', SOURCE, '-frames:v', '1', '-update', '1', '-y', ASSETS / 'town-frame.png'])
original = Image.open(ASSETS / 'town-frame.png').convert('RGB')
# Remove the existing top/bottom copy from this scenic background by cropping
# only the town image, then fit proportionally to portrait; no scene distortion.
background = ImageOps.fit(original.crop((0, 410, 1080, 1480)), (W, H), method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(2))
background.save(ASSETS / 'town-background.png')

def layer(name):
    return Image.new('RGBA', (W, H))

shade = layer('shade')
d = ImageDraw.Draw(shade)
for y in range(H):
    edge = abs(y - H / 2) / (H / 2)
    d.line((0, y, W, y), fill=(10, 31, 29, int(35 + 90 * edge)))
shade.save(ASSETS / 'shade.png')

panel = layer('panel')
shadow = layer('shadow')
ImageDraw.Draw(shadow).rounded_rectangle((98, 548, 932, 1510), radius=38, fill=(0, 0, 0, 90))
panel.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
d = ImageDraw.Draw(panel)
d.rounded_rectangle((85, 530, 915, 1490), radius=34, fill=(255, 248, 235, 214), outline=(255, 252, 241, 160), width=2)
d.rounded_rectangle((460, 600, 540, 606), radius=3, fill='#789460')
panel.save(ASSETS / 'panel.png')

logo = layer('logo')
mark = Image.open(ROOT / 'assets/brand/komachi-wordmark.png').convert('RGBA')
mark.thumbnail((660, 255), Image.Resampling.LANCZOS)
# The visible Komachi lettering (excluding the taller leaf and small tagline)
# is centred on the panel's vertical midpoint at y=1010.
word_centre = ((80 + 261) / 2) * mark.width / 820
logo.alpha_composite(mark, ((1000 - mark.width) // 2, round(1010 - word_centre)))
logo.save(ASSETS / 'logo.png')

message = layer('message')
d = ImageDraw.Draw(message)
d.text((500, 685), 'Your little town.', anchor='mt', fill='#234535', font=font(61, True))
d.text((500, 1170), 'Start with one street.', anchor='mt', fill='#3e5947', font=font(37))
d.text((500, 1430), 'A GAME BY SAISS', anchor='mt', fill='#4e6651', font=font(23, True))
message.save(ASSETS / 'message.png')

cta = layer('cta')
d = ImageDraw.Draw(cta)
d.rounded_rectangle((160, 1250, 840, 1354), radius=26, fill='#bcd499')
d.text((500, 1302), 'PLAY KOMACHI', anchor='mm', fill='#203e2f', font=font(43, True))
d.text((500, 1378), 'Link on our channel profile', anchor='mt', fill='#314c3b', font=font(31))
cta.save(ASSETS / 'cta.png')

# The town dissolves into a scenic backdrop; each foreground element
# fades in and rises slightly, then remains still long enough to read.
inputs = ['-loop', '1', '-framerate', '30', '-i', ASSETS / 'town-background.png']
for name in ['shade', 'panel', 'logo', 'message', 'cta']:
    inputs += ['-loop', '1', '-framerate', '30', '-i', ASSETS / f'{name}.png']
filters = ['[0:v]scale=1124:1998,crop=1080:1920:x=22:y=39,setsar=1[b]']
starts = [0, .5, 1, 2, 3]
durations = [1.1, 1.1, 1, .9, .9]
prev = 'b'
for i, (name, start, duration) in enumerate(zip(['shade', 'panel', 'logo', 'message', 'cta'], starts, durations), 1):
    filters.append(f'[{i}:v]format=rgba,fade=t=in:st={start}:d={duration}:alpha=1[{name}]')
    y = '0' if i == 1 else f"'if(lt(t,{start}),20,20*(1-min(1,(t-{start})/{duration})))'"
    nxt = f'v{i}'
    filters.append(f'[{prev}][{name}]overlay=x=0:y={y}:format=auto[{nxt}]')
    prev = nxt
filters.append(f'[{prev}]scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p[v]')
ending = ASSETS / 'animated-ending-7s.mp4'
run([*inputs, '-filter_complex', ';'.join(filters), '-map', '[v]', '-an', '-t', '7', '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-y', ending])

spec = importlib.util.spec_from_file_location('promo_music', ROOT / 'scripts/edit-youtube-short.py')
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)
music.OUT = ASSETS
score = music.score(33)
run(['-t', '27', '-i', SOURCE, '-i', ending, '-i', score, '-i', OUT / '_source/building-cues.wav',
     '-filter_complex',
     '[0:v]fps=30,settb=AVTB[a];[1:v]fps=30,settb=AVTB[b];'
     '[a][b]xfade=transition=fade:duration=1:offset=26,fps=30,format=yuv420p[v];'
     '[2:a]volume=0.7[m];[3:a]apad=whole_dur=33[c];[m][c]amix=inputs=2:duration=longest:normalize=0,afade=t=in:d=0.2,afade=t=out:st=31.3:d=1.7,loudnorm=I=-16:TP=-1.5:LRA=7[s]',
     '-map', '[v]', '-map', '[s]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
     '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '33', '-movflags', '+faststart', '-y', TARGET])
run(['-i', TARGET, '-f', 'null', '-'])
probe = subprocess.run([FF, '-hide_banner', '-i', str(TARGET)], capture_output=True, text=True)
info = '\n'.join(s.strip() for s in probe.stderr.splitlines() if any(k in s for k in ['Duration:', 'Video:', 'Audio:']))
if not all(k in info for k in ['00:00:33.00', '1080x1920', '30 fps', 'Video: h264', 'Audio: aac']):
    raise RuntimeError(info)
levels = subprocess.run([FF, '-hide_banner', '-i', str(TARGET), '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
peak = re.search(r'max_volume: ([-\d.]+) dB', levels.stderr)
if not peak or float(peak.group(1)) >= 0:
    raise RuntimeError('Invalid audio level')
sheet = Image.new('RGB', (1350, 1020), '#163b36')
times = [25.5, 26.5, 27, 27.5, 28, 28.5, 29, 30, 31, 32.5]
for i, second in enumerate(times):
    path = ASSETS / f'review-{i:02}.jpg'
    run(['-ss', second, '-i', TARGET, '-frames:v', '1', '-vf', 'scale=270:480', '-update', '1', '-y', path])
    sheet.paste(Image.open(path), ((i % 5) * 270, (i // 5) * 510))
    ImageDraw.Draw(sheet).text(((i % 5) * 270 + 10, (i // 5) * 510 + 485), f'{second}s', fill='#fff6e6', font=font(18))
sheet.save(ASSETS / 'single-card-ending-review.jpg', quality=94)
run(['-ss', '31', '-i', TARGET, '-frames:v', '1', '-update', '1', '-y', OUT / 'single-end-card.jpg'])
(ASSETS / 'validation.txt').write_text('Full video/audio decode: PASS\nRedesigned ending: town dissolve, card, logo, message, play invitation; three-second final hold\n' + info + f'\nAudio peak: {peak.group(1)} dBFS\n', encoding='utf-8')
(ASSETS / 'edit-notes.json').write_text(json.dumps({'source': SOURCE.name, 'output': TARGET.name, 'duration': 33, 'dissolve': [26, 27], 'panel_reveal': [26.5, 27.6], 'logo_reveal': [27, 28], 'message_reveal': [28, 28.9], 'cta_reveal': [29, 29.9], 'final_hold': [30, 33]}, indent=2), encoding='utf-8')
print(info + f'\nAudio peak: {peak.group(1)} dBFS', flush=True)
