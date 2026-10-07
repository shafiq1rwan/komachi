# Fresh Komachi portrait Short

Upload `komachi-town-first-short-26s.mp4`. Town building is the main attraction, followed by a shorter fishing break.

26 seconds · 1080 × 1920 · portrait 9:16 · 30 fps · H.264/AAC.

All footage was newly captured from the current game source in a temporary browser session, with seed 19. The fishing session and construction plot were staged for recording using developer hooks. No footage from either previous trailer was used. Text is burned into the video, with original music and synthesized fishing cues.

Sequence:

- 0–5 seconds: a freshly placed home under construction, with “Build your quiet corner.”
- 5–10 seconds: station neighbourhood and everyday town life.
- 10–18 seconds: a shorter fishing sequence, including casting, bite, reeling and a landed horse mackerel.
- 18–22 seconds: an evening view with warm lights.
- 22–26 seconds: Komachi branding and a play invitation.

Suggested title:

Build a town. Take a fishing break. 🎣 | Komachi #Shorts

Suggested description:

Your next little escape: build a cozy Japanese town, take a fishing break, and watch everyday life unfold in Komachi.

Play through the “Play Komachi” link on our channel profile.

Freshly recorded actual gameplay. A game by Saiss.

#Komachi #CozyGames #CityBuilder

Suggested pinned comment:

Would you build your town first, or head straight to the quay? 🎣 Play through the “Play Komachi” link on our channel profile.

Setup before publishing:

1. Add the channel profile link labelled “Play Komachi”: https://shafiq1rwan.github.io/komachi/ . The end card directs viewers there. Ordinary URLs in Shorts descriptions and comments are not clickable: https://support.google.com/youtube/answer/13748639?hl=en .
2. Upload the MP4 in YouTube Studio, add the title and description, and choose the audience setting according to your intended audience.
3. Check the upload on a phone. Text is positioned away from the right controls and lowest part of the frame, but verify with the live Shorts interface.
4. If you have a longer gameplay introduction, attach it as the Related Video. This requires advanced feature access: https://support.google.com/youtube/answer/14075157?hl=en .
5. Make the destination easy to approach: an obvious Play button, supported devices, simple controls and clear saving instructions. Test a new-player session on desktop and phone.

This video is aimed at cozy game and city-builder fans. Follow it with one satisfying activity per Short: a building going up, a catch, or the town changing from day to night. Compare opening retention and average percentage viewed before choosing the next hook.

To reproduce:

Start the local Vite dev server on port 4414. Run `node scripts/record-fresh-short.mjs <ffmpeg-executable>` and then `python scripts/finish-fresh-short.py`. Dependencies: the project's puppeteer-core, Pillow and imageio-ffmpeg. The recorder uses 900 controlled frame captures in a native portrait viewport; it does not modify game source or saved towns.
