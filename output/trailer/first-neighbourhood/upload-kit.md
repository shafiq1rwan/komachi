# Build your first little neighbourhood

Upload: `komachi-first-neighbourhood-lofi-30s.mp4` (original game lo-fi music, stereo AAC, single transparent card with gradual fades).

30 seconds, portrait 9:16, 1080 × 1920, 30 fps, H.264 video and stereo AAC audio. Freshly recorded from a new island with actual street and building placement. Construction is a labelled time-lapse of the real simulation, shortened by three seconds for this cut. Captions are burned in. Music is the game's existing lo-fi menu.mp3; placement chimes are original synthesized audio. Music credits are recorded in assets/audio/CREDITS.md. The single transparent card gradually reveals the Komachi logo, message and play invitation, followed by a three-second reading pause.

Title:

Build your first little neighbourhood 🌿 | Komachi #Shorts

Description:

One street. A few homes. A little neighbourhood of your own.

Draw a street from the station, place homes and shops beside it, and watch builders and residents bring your town to life in Komachi, a cozy Japanese town builder.

Play through the “Play Komachi” link on our channel profile.

Actual gameplay, with construction shown as a time-lapse. Created by Saiss.

#Komachi #CozyGames #CityBuilder

Pinned comment:

What would you add next—a café, more homes, or a park? 🌿

Before uploading, add the channel profile link labelled “Play Komachi”: https://shafiq1rwan.github.io/komachi/ . The closing invitation depends on that link. Ordinary links in Shorts descriptions/comments are not clickable: https://support.google.com/youtube/answer/13748639?hl=en .

Suggested cover frame: the completed neighbourhood around 20 seconds. Preview the upload on a phone for captions and Shorts control overlap.

Storyboard: empty plots → connected street → three homes → shop and workplace → builders at work → completed neighbourhood and residents → evening lights → play invitation.

Reproduce from the project root: start Vite on port 4414, run `node scripts/record-first-neighbourhood.mjs <ffmpeg-executable>`, then `python scripts/finish-first-neighbourhood.py` and `python scripts/revise-neighbourhood-ending.py`. Requires the project's puppeteer-core, Pillow, and imageio-ffmpeg. Staging occurs only in an isolated browser session; existing player saves are untouched.
