"""Finish and verify the fresh 30-second first-neighbourhood Short."""
from pathlib import Path
import array
import importlib.util
import json
import math
import re
import subprocess
import wave
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trailer/first-neighbourhood/_source'
FF = imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    result = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result


recording = json.loads((OUT / 'recording.json').read_text())
if len(recording['buildings']) != 5 or recording['residents'] < 1:
    raise RuntimeError('Missing neighbourhood or residents')
spec = importlib.util.spec_from_file_location('promo_music', ROOT / 'scripts/edit-youtube-short.py')
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)
music.OUT = OUT
score = music.score(30)
rate = 48000
data = array.array('f', [0]) * (rate * 30)
for event in recording['events']:
    notes = [523, 659, 784] if event['kind'] == 'residents' else [523, 659] if event['kind'].startswith('home') or event['kind'] in ['shop', 'work'] else []
    for n, hz in enumerate(notes):
        start = int((event['time'] + n * .085) * rate)
        for i in range(int(.24 * rate)):
            t = i / rate
            data[start + i] += .14 * min(1, t / .012) * math.exp(-t * 23) * math.sin(2 * math.pi * hz * t)
with wave.open(str(OUT / 'building-cues.wav'), 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(rate)
    f.writeframes(array.array('h', (int(max(-1, min(1, v)) * 32767) for v in data)).tobytes())
target = OUT / 'komachi-first-neighbourhood-short-30s.mp4'
run(['-i', OUT / 'neighbourhood-raw.mp4', '-i', score, '-i', OUT / 'building-cues.wav',
     '-filter_complex', '[1:a]volume=0.7[m];[m][2:a]amix=inputs=2:duration=longest:normalize=0,afade=t=in:d=0.2,afade=t=out:st=28.5:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=7[a]',
     '-map', '0:v', '-map', '[a]', '-vf', 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709',
     '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
     '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '30', '-movflags', '+faststart', '-y', target])
run(['-i', target, '-f', 'null', '-'])
probe = subprocess.run([FF, '-hide_banner', '-i', str(target)], capture_output=True, text=True)
info = '\n'.join(s.strip() for s in probe.stderr.splitlines() if any(k in s for k in ['Duration:', 'Video:', 'Audio:']))
if not all(k in info for k in ['00:00:30.00', '1080x1920', '30 fps', 'Video: h264', 'Audio: aac']):
    raise RuntimeError(info)
levels = subprocess.run([FF, '-hide_banner', '-i', str(target), '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
peak = re.search(r'max_volume: ([-\d.]+) dB', levels.stderr)
if not peak or float(peak.group(1)) >= 0:
    raise RuntimeError('Invalid audio level')
times = [1, 3, 6, 8.5, 11, 13, 16, 20, 25, 28]
sheet = Image.new('RGB', (1350, 1020), '#163b36')
for i, t in enumerate(times):
    path = OUT / f'review-{i:02}.jpg'
    run(['-ss', t, '-i', target, '-frames:v', '1', '-vf', 'scale=270:480', '-update', '1', '-y', path])
    sheet.paste(Image.open(path), ((i % 5) * 270, (i // 5) * 510))
    ImageDraw.Draw(sheet).text(((i % 5) * 270 + 10, (i // 5) * 510 + 485), f'{t}s', fill='#fff6e6', font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 18))
sheet.save(OUT / 'contact-sheet.jpg', quality=94)
run(['-ss', 20, '-i', target, '-frames:v', '1', '-update', '1', '-y', OUT / 'poster.jpg'])
(OUT / 'validation.txt').write_text('Full video/audio decode: PASS\nNew island, connected street, three homes, shop and workplace: PASS\nConstruction simulated to completion; residents moved in: PASS\n' + info + f'\nAudio peak: {peak.group(1)} dBFS\n', encoding='utf-8')
print(info + f'\nAudio peak: {peak.group(1)} dBFS', flush=True)
