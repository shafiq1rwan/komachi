"""Finish the 20-second fishing update capture, mix audio, and verify the export."""
from pathlib import Path
import array
import json
import math
import re
import subprocess
import wave
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trailer/fishing-update'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TARGET = OUT / 'komachi-fishing-update-20s.mp4'


def run(args):
    result = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result


recording = json.loads((OUT / 'recording.json').read_text())
rate = 48000
samples = array.array('f', [0]) * (20 * rate)
# These original sine chimes follow the game's own cast, bite, hook and catch cues.
notes = {'cast': [380, 260], 'bite': [740, 980], 'hook': [520, 660], 'catch': [523, 659, 784, 1047]}
for event in recording['events']:
    for index, hz in enumerate(notes.get(event['kind'], [])):
        start = round((event['time'] + index * 0.085) * rate)
        for i in range(round(0.24 * rate)):
            t = i / rate
            envelope = min(1, t / 0.012) * math.exp(-t * 23)
            if start + i < len(samples):
                samples[start + i] += 0.2 * envelope * math.sin(2 * math.pi * hz * t)
pcm = array.array('h', (round(max(-1, min(1, sample)) * 32767) for sample in samples))
with wave.open(str(OUT / 'fishing-cues.wav'), 'wb') as audio:
    audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(rate); audio.writeframes(pcm.tobytes())

# A cream brand card gives the original dark wordmark clear contrast over the harbour.
card = Image.new('RGBA', (1280, 720))
draw = ImageDraw.Draw(card)
draw.rounded_rectangle((320, 150, 960, 570), radius=28, fill=(251, 246, 238, 255))
bold = 'C:/Windows/Fonts/segoeuib.ttf'
regular = 'C:/Windows/Fonts/segoeui.ttf'
draw.text((640, 182), 'THE FISHING UPDATE', anchor='mt', font=ImageFont.truetype(bold, 14), fill='#4d8582')
logo = Image.open(ROOT / 'assets/brand/komachi-wordmark.png').convert('RGBA')
logo.thumbnail((400, 155), Image.Resampling.LANCZOS)
card.alpha_composite(logo, ((1280 - logo.width) // 2, 224))
draw = ImageDraw.Draw(card)
draw.rounded_rectangle((618, 411, 662, 414), radius=2, fill='#8fae78')
draw.text((640, 443), 'Cast. Reel. Take your time.', anchor='mt', font=ImageFont.truetype(bold, 28), fill='#29413a')
draw.text((640, 493), 'A little more life at the quay.', anchor='mt', font=ImageFont.truetype(regular, 17), fill='#68796c')
draw.text((640, 539), 'KOMACHI  /  SAISS', anchor='mt', font=ImageFont.truetype(bold, 11), fill='#7a706a')
card.save(OUT / 'closing-card.png')

run(['-i', OUT / 'fishing-gameplay-raw.mp4', '-stream_loop', '-1', '-i', ROOT / 'assets/audio/bgm/menu.mp3',
     '-i', OUT / 'fishing-cues.wav', '-loop', '1', '-framerate', '30', '-i', OUT / 'closing-card.png', '-filter_complex',
     '[3:v]format=rgba,fade=t=in:st=18.1:d=0.5:alpha=1[card];'
     '[0:v][card]overlay=0:0,fade=t=in:st=0:d=0.25,fade=t=out:st=19.65:d=0.35,format=yuv420p[v];'
     '[1:a]volume=0.24,afade=t=in:st=0:d=0.8,afade=t=out:st=18:d=2[music];'
     '[2:a]volume=0.85[cues];[music][cues]amix=inputs=2:duration=shortest:normalize=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=7[a]',
     '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30',
     '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '20', '-movflags', '+faststart',
     '-metadata', 'title=Komachi | Fishing Update', '-metadata', 'artist=Saiss', '-y', TARGET])

# Decode the whole deliverable and inspect its actual duration and streams.
run(['-i', TARGET, '-f', 'null', '-'])
probe = subprocess.run([FFMPEG, '-hide_banner', '-i', str(TARGET)], capture_output=True, text=True)
info = '\n'.join(line.strip() for line in probe.stderr.splitlines() if any(key in line for key in ['Duration:', 'Video:', 'Audio:']))
if not all(key in info for key in ['00:00:20.00', '1280x720', '30 fps', 'Video: h264', 'Audio: aac']):
    raise RuntimeError('Unexpected export format: ' + info)
stats = subprocess.run([FFMPEG, '-hide_banner', '-i', str(TARGET), '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
peak = re.search(r'max_volume: ([-\d.]+) dB', stats.stderr)
if not peak or float(peak.group(1)) >= 0:
    raise RuntimeError('Audio validation failed.')

seconds = [0.8, 3, 4.4, 7, 10, 13, 16.5, 19]
sheet = Image.new('RGB', (960, 1192), '#183633')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
for index, sec in enumerate(seconds):
    shot = OUT / f'review-{index + 1:02}.jpg'
    run(['-ss', sec, '-i', TARGET, '-frames:v', '1', '-vf', 'scale=480:270', '-update', '1', '-y', shot])
    sheet.paste(Image.open(shot).convert('RGB'), ((index % 2) * 480, (index // 2) * 298))
    draw.text(((index % 2) * 480 + 12, (index // 2) * 298 + 275), f'{sec:04.1f}s', fill='#fff7e8', font=font)
sheet.save(OUT / 'komachi-fishing-update-contact-sheet.jpg', quality=94)
run(['-ss', '9', '-i', TARGET, '-frames:v', '1', '-update', '1', '-y', OUT / 'komachi-fishing-update-poster.jpg'])
(OUT / 'validation.txt').write_text('Complete video/audio decode: PASS\n' + info + f'\nAudio peak: {peak.group(1)} dB\n', encoding='utf-8')
print(f'Finished: {TARGET}\n{info}\nAudio peak: {peak.group(1)} dB\nSize: {TARGET.stat().st_size / 1048576:.1f} MB', flush=True)
