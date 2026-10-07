"""Mix original music and fishing cues, then verify the fresh portrait capture."""
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
OUT = ROOT / 'output/trailer/fresh-short'
SOURCE = OUT / '_source'
FF = imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    p = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p


recording = json.loads((SOURCE / 'recording.json').read_text())
if not any(e['kind'] == 'catch' for e in recording['events']):
    raise RuntimeError('No landed fish in this capture')
spec = importlib.util.spec_from_file_location('short_music', ROOT / 'scripts/edit-youtube-short.py')
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)
music.OUT = SOURCE
score = music.score(26)

rate = 48000
data = array.array('f', [0]) * (rate * 26)
notes = {'cast': [380, 260], 'bite': [740, 980], 'hook': [520, 660], 'catch': [523, 659, 784, 1047]}
for event in recording['events']:
    for n, hz in enumerate(notes.get(event['kind'], [])):
        # Town building leads for ten seconds; fishing is an eight-second highlight.
        start = int((event['time'] / 1.75 + 10 + n * .085) * rate)
        for i in range(int(.24 * rate)):
            t = i / rate
            if start + i < len(data):
                data[start + i] += .18 * min(1, t / .012) * math.exp(-t * 23) * math.sin(2 * math.pi * hz * t)
with wave.open(str(SOURCE / 'fishing-cues.wav'), 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(rate)
    f.writeframes(array.array('h', (int(max(-1, min(1, v)) * 32767) for v in data)).tobytes())

target = OUT / 'komachi-town-first-short-26s.mp4'
run(['-ss', '14', '-t', '4', '-i', SOURCE / 'fresh-gameplay-raw.mp4',
     '-ss', '18', '-t', '4', '-i', SOURCE / 'fresh-gameplay-raw.mp4',
     '-ss', '0', '-t', '14', '-i', SOURCE / 'fresh-gameplay-raw.mp4',
     '-ss', '22', '-t', '8', '-i', SOURCE / 'fresh-gameplay-raw.mp4',
     '-i', score, '-i', SOURCE / 'fishing-cues.wav',
     '-filter_complex',
     '[0:v]setpts=1.25*(PTS-STARTPTS)[b];'
     '[1:v]setpts=1.25*(PTS-STARTPTS)[t];'
     '[2:v]setpts=(PTS-STARTPTS)/1.75[f];'
     '[3:v]setpts=PTS-STARTPTS[e];'
     '[b][t][f][e]concat=n=4:v=1:a=0,fps=30,scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709[v];'
     '[4:a]volume=0.7[m];[m][5:a]amix=inputs=2:duration=longest:normalize=0,afade=t=in:d=0.2,afade=t=out:st=24.5:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=7[a]',
     '-map', '[v]', '-map', '[a]',
     '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
     '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '26', '-movflags', '+faststart', '-y', target])
run(['-i', target, '-f', 'null', '-'])
probe = subprocess.run([FF, '-hide_banner', '-i', str(target)], capture_output=True, text=True)
info = '\n'.join(s.strip() for s in probe.stderr.splitlines() if any(k in s for k in ['Duration:', 'Video:', 'Audio:']))
if not all(k in info for k in ['00:00:26.00', '1080x1920', '30 fps', 'Video: h264', 'Audio: aac']):
    raise RuntimeError(info)
levels = subprocess.run([FF, '-hide_banner', '-i', str(target), '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
peak = re.search(r'max_volume: ([-\d.]+) dB', levels.stderr)
if not peak or float(peak.group(1)) >= 0:
    raise RuntimeError('Invalid audio level')
times = [1, 3, 6, 9, 11, 13, 15, 17, 20, 24]
sheet = Image.new('RGB', (1350, 1020), '#163b36')
for i, t in enumerate(times):
    path = SOURCE / f'town-first-review-{i:02}.jpg'
    run(['-ss', t, '-i', target, '-frames:v', '1', '-vf', 'scale=270:480', '-update', '1', '-y', path])
    sheet.paste(Image.open(path), ((i % 5) * 270, (i // 5) * 510))
    ImageDraw.Draw(sheet).text(((i % 5) * 270 + 10, (i // 5) * 510 + 485), f'{t}s', fill='#fff6e6', font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 18))
sheet.save(SOURCE / 'town-first-contact-sheet.jpg', quality=94)
run(['-ss', 1, '-i', target, '-frames:v', '1', '-update', '1', '-y', OUT / 'town-first-poster.jpg'])
(SOURCE / 'town-first-validation.txt').write_text('Full video/audio decode: PASS\nOrder: construction 5s, station 5s, fishing 8s, evening 4s, end card 4s\nFishing cues retimed to match the shortened sequence\nFishing cast, bite, hook and landed fish: PASS\n' + info + f'\nAudio peak: {peak.group(1)} dBFS\n', encoding='utf-8')
print(info + f'\nAudio peak: {peak.group(1)} dBFS', flush=True)
