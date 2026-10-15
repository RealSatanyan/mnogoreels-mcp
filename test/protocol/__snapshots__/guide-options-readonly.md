# Clip options guide

Values accepted by create_clip_job and recut_clip_job (get_options_guide returns the same data as JSON).

## video_mode

How the video was filmed. smart_cut (removing pauses and filler words) works only with podcast; general-beta always does it, other modes ignore it.

| Value | Description | Default |
|---|---|---|
| `general` | Most videos. Smart crop follows the people and subjects in frame. | yes |
| `podcast` | Talking heads and interviews with one or two speakers; splits the frame when two people talk. |  |
| `general-beta` | SmartCut (General 2.0): highest-quality editing with locked shots and automatic removal of pauses and filler words inside clips. Slower. |  |
| `stream` | Screen recording or game stream with a webcam: screen on top, webcam below. |  |
| `vlog` | Handheld vlogs: always vertical with gentle face tracking. |  |
| `fitness` | Workouts and dance: always vertical, body-aware crop that keeps head and feet in frame. |  |

## clip_length

Target length of each clip. auto lets the AI decide; 30_60s suits Shorts, Reels and TikTok.

| Value | Description | Default |
|---|---|---|
| `auto` | Chosen by AI: 15–60 s for sources up to 2 min, up to 90 s (up to 10 min), 150 s (up to 30 min). |  |
| `up_to_30s` | 10–30 s. |  |
| `30_60s` | 30–59 s (Shorts/Reels/TikTok sweet spot). | yes |
| `60_90s` | 60–89 s. |  |
| `90s_3m` | 90–180 s. |  |
| `3m_5m` | 180–300 s. |  |
| `5m_10m` | 300–600 s. |  |

## caption_style

Burned-in caption style; empty means no captions.

| Value | Description | Default |
|---|---|---|
| `karaoke` | Words highlight one by one, four words per line (default). | yes |
| `karaoke_static` | No per-word highlight; larger text placed higher. |  |
| `minimal` | Small, clean subtitles. |  |
| `viral` | Bold high-contrast viral look. |  |
| `montserrat` | Clean preset named after its typeface. |  |
| `gilroy` | Clean preset named after its typeface. |  |
| `rubik` | Clean preset named after its typeface. |  |
| `bebas` | Clean preset named after its typeface. |  |
| `impact` | Clean preset named after its typeface. |  |
| `pixel` | Clean preset named after its typeface. |  |
| `gothic` | Clean preset named after its typeface. |  |
| `going` | Clean preset named after its typeface. |  |
| `hormozi` | White caps with a thick black outline; the active word turns yellow and pops. |  |
| `hormozi_pop` | Hormozi with a bouncing active word cycling yellow, white and lime. |  |
| `boxed` | Active word inside a filled green box. |  |
| `boxed_black` | Active word in black on a white box. |  |
| `boxed_pop` | Boxed with a bouncing box cycling green, red and blue. |  |
| `neon` | Wide font with a neon pink glow on the active word. |  |
| `pop3d` | Rounded font with a hard purple offset shadow. |  |
| `tiktok` | Condensed font on a translucent black bar. |  |
| `money` | Numbers, percentages and currencies glow green; current word yellow. |  |
| `chunky` | Heavy black offset shadow; active word yellow. |  |
| `punch` | One big word at a time in the centre; every third word yellow. |  |
| `empty` | No captions. |  |

## hook_style

Style of the hook title shown at the start of each clip; none hides it.

| Value | Description | Default |
|---|---|---|
| `default` | White box, black text. | yes |
| `dark` | Black box, white text. |  |
| `accent` | Orange box, black text. |  |
| `sticker` | White sticker boxes; lines pop in one after another. |  |
| `marker` | A highlighter stripe swipes across, then the text appears. |  |
| `neon` | Glowing neon text. |  |
| `stagger` | Lines slide in from different sides in a staircase layout. |  |
| `torn` | Lowercase text on a torn paper sheet that slaps into the frame. |  |
| `keyword` | Highlights the key word, which appears after the rest of the text. |  |
| `impact` | Big white Impact-style text. |  |
| `none` | No hook title on the clip. |  |

## story_arc_style

Build each clip as a story (cold open, main part, payoff). Any value except none also turns on cold_open.

| Value | Description | Default |
|---|---|---|
| `none` | Off. | yes |
| `subtle` | Story structure with light transitions. |  |
| `dynamic` | Story structure with energetic transitions. |  |
| `cinematic` | Story structure with a cinematic look. |  |

## outro

Ending added to every clip.

| Value | Description | Default |
|---|---|---|
| `none` | No outro. | yes |
| `default` | Short branded video outro. |  |
| `soon` | 3 s Russian text card "Продолжение на канале!". |  |
| `like` | 3 s Russian text card asking to like and subscribe. |  |
| `custom` | The user's own outro image saved on the website; ignored if none is saved. Only for create_clip_job. |  |

## framing

How the wide source is turned into a vertical clip.

| Value | Description | Default |
|---|---|---|
| `auto` | Smart crop decides. | yes |
| `full_frame` | Keep the whole 16:9 frame on a blurred 9:16 background, no tracking. |  |
| `portrait_only` | Always crop to the subject, never a wide layout. |  |

## language

ISO 639-1 two-letter code of the speech, e.g. en or ru; other two-letter codes work too. Omit to auto-detect (one language for the whole video). Never pass 'auto'.

| Value | Description | Default |
|---|---|---|
| `en` | English |  |
| `ru` | Russian |  |
| `uk` | Ukrainian |  |
| `es` | Spanish |  |
| `fr` | French |  |
| `de` | German |  |
| `it` | Italian |  |
| `pt` | Portuguese |  |
| `ja` | Japanese |  |
| `ko` | Korean |  |
| `zh` | Chinese |  |
| `kk` | Kazakh |  |
| `be` | Belarusian |  |
| `pl` | Polish |  |
| `tr` | Turkish |  |
| `ar` | Arabic |  |
| `he` | Hebrew |  |
| `hi` | Hindi |  |
| `cs` | Czech |  |
| `bg` | Bulgarian |  |
| `sr` | Serbian |  |
