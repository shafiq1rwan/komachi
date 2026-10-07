"""Use the game's original lo-fi menu track for the 30-second upload cut."""
from pathlib import Path
import re
import subprocess
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trailer/first-neighbourhood'
FF = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = OUT / '_source/komachi-first-neighbourhood-single-card-33s.mp4'
MUSIC = ROOT / 'assets/audio/bgm/menu.mp3'
TARGET = OUT / 'komachi-first-neighbourhood-lofi-30s.mp4'


def run(args):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r


# Tighten three seconds of construction time-lapse. The seven-second ending,
# staged fades, single transparent card and final reading pause remain intact.
run(['-t', '12', '-i', SOURCE, '-ss', '15', '-t', '18', '-i', SOURCE,
     '-t', '30', '-i', MUSIC, '-i', OUT / '_source/building-cues.wav',
     '-filter_complex',
     '[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,fps=30,format=yuv420p[v];'
     '[3:a]apad=whole_dur=33,asplit=2[c1][c2];[c1]atrim=end=12,asetpts=PTS-STARTPTS[d1];'
     '[c2]atrim=start=15:end=33,asetpts=PTS-STARTPTS[d2];[d1][d2]concat=n=2:v=0:a=1[c];'
     '[2:a]volume=0.65[m];[m][c]amix=inputs=2:duration=shortest:normalize=0,afade=t=in:d=0.4,afade=t=out:st=28.5:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=7[s]',
     '-map', '[v]', '-map', '[s]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
     '-c:a', 'aac', '-ac', '2', '-ar', '48000', '-b:a', '192k', '-t', '30', '-movflags', '+faststart', '-y', TARGET])
run(['-i', TARGET, '-f', 'null', '-'])
probe = subprocess.run([FF, '-hide_banner', '-i', str(TARGET)], capture_output=True, text=True)
info = '\n'.join(s.strip() for s in probe.stderr.splitlines() if any(k in s for k in ['Duration:', 'Video:', 'Audio:']))
if not all(k in info for k in ['00:00:30.00', '1080x1920', '30 fps', 'Video: h264', 'Audio: aac', 'stereo']):
    raise RuntimeError(info)
levels = subprocess.run([FF, '-hide_banner', '-i', str(TARGET), '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
peak = re.search(r'max_volume: ([-\d.]+) dB', levels.stderr)
if not peak or float(peak.group(1)) >= 0:
    raise RuntimeError('Invalid audio level')
run(['-i', TARGET, '-map', '0:a', '-t', '30', '-c:a', 'libmp3lame', '-b:a', '192k', '-y', OUT / '_source/lofi-soundtrack-30s.mp3'])
sheet = Image.new('RGB', (1350, 510), '#163b36')
for i, second in enumerate([11, 13, 24.5, 27, 29]):
    path = OUT / '_source' / f'lofi-review-{i:02}.jpg'
    run(['-ss', second, '-i', TARGET, '-frames:v', '1', '-vf', 'scale=270:480', '-update', '1', '-y', path])
    sheet.paste(Image.open(path), (i * 270, 0))
    ImageDraw.Draw(sheet).text((i * 270 + 10, 485), f'{second}s', fill='#fff8e9', font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 18))
sheet.save(OUT / '_source/lofi-review.jpg', quality=94)
(OUT / '_source/lofi-validation.txt').write_text('Full audio/video decode: PASS\nOriginal menu.mp3 lo-fi music, trimmed to 30 seconds\nBuilding cues retimed to match the shortened construction\nSingle-card fade and final reading pause retained\n' + info + f'\nAudio peak: {peak.group(1)} dBFS\n', encoding='utf-8')
print(info + f'\nAudio peak: {peak.group(1)} dBFS', flush=True)
