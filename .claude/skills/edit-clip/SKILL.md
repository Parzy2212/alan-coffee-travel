---
name: edit-clip
description: Turn a folder of raw coffee-farm/travel video clips into a polished 9:16 vertical short. Confirms the raw footage set with the user, selects and cuts the best segments, assembles them via a matching CapCut Web template (falling back to a manual ffmpeg cut if no template fits), critiques the result when the fallback is used, then packages a bilingual (TH/EN) post-ready folder with captioned videos and caption text for the user to review and post manually. Never posts anything itself.
user-invokable: true
args:
  - name: folder
    description: Path to the folder containing the raw video clips to edit
    required: true
---

You are editing raw footage in `$ARGUMENTS` into one finished vertical short (9:16, 1080x1920, ~12-15s). Work through the phases below in order. Do not skip the review loop — a cut you haven't critiqued is not done.

**Prerequisites**: `ffmpeg` and `auto-editor` on PATH (`pip install auto-editor` if missing — check with `auto-editor --version` before starting and install if it fails).

## Phase 0 — Confirm folder contents before starting

1. List every video file found in `$ARGUMENTS`, with filename, size, and **capture date** (read from file metadata — e.g. `ffprobe -v error -show_entries format_tags=creation_time -of default=noprint_wrappers=1 <file>` — not the filesystem's created/modified date).
2. If the capture dates span wildly different periods (e.g. a mix of 2016 and 2026 files, or anything more than 30 days apart), stop and ask: "เจอไฟล์จากหลายช่วงเวลาปนกันในโฟลเดอร์นี้ ต้องการให้ใช้ทั้งหมด หรือใช้เฉพาะช่วงไหน?" Wait for the answer before moving to Phase 1.
3. If all files cluster around the same period (look like one coherent shoot), just report how many files and total duration/size, then continue straight to Phase 1 — no need to ask.

**Principle**: the user curates which raw files belong in the folder before running `/edit-clip`. Work only with what's in the folder — never guess which files should or shouldn't be used, beyond this one date-consistency check.

## Phase 1 — Select clips

List every video file in `$ARGUMENTS`. For each clip, sample frames across its **full duration** (not just the first frame — use ffmpeg to pull frames at even intervals, e.g. every 1-2s) so you actually see what happens in the clip, not just how it opens.

From what you see, pick the most visually interesting/high-motion segments (in-time ranges, not necessarily whole clips) and order them into a mini story arc if there's enough footage for one: **setup → build → payoff → detail**. With only 2-3 clips, still pick a deliberate order (strongest hook first) rather than defaulting to file order.

Note the in/out timestamps you're choosing for each segment — you'll need them for Phase 2.

## Phase 2 — Cut segments (no merge yet)

Cut each selected in/out range from Phase 1 into its own short file — do not merge them into one clip yet, and do not crop to 9:16 yet. Leave both of those to Phase 3 (the CapCut template handles cropping/pacing itself; the ffmpeg fallback, if needed, does its own crop pass).

1. Run `auto-editor` on each selected segment (or the source file trimmed to your chosen range) to strip silent/dead footage: `auto-editor <input> --edit audio --margin 0.2sec -o <trimmed>.mp4` (adjust flags as needed — the goal is removing dead time, not aggressive jump-cutting).
2. Save each trimmed piece into a `raw_segments/` subfolder of `$ARGUMENTS`, named in the order chosen in Phase 1: `segment_1.mp4`, `segment_2.mp4`, `segment_3.mp4`, `segment_4.mp4`, etc.

## Phase 3 — Assemble: CapCut template first, ffmpeg fallback second

Try to assemble `raw_segments/` into a finished cut using a real CapCut Web template. Only fall back to manual ffmpeg editing if no template genuinely fits — don't force a mismatched template just to avoid the fallback.

**CapCut path:**

1. Open capcut.com (via Claude in Chrome) and search for templates matching a travel/nature theme with a **clip-slot count that matches the number of segments you have** (e.g. 4 segments → look for a 4-clip template). A template whose slot count doesn't match your segment count isn't a fit — keep looking rather than repeating/skipping segments to force it.
2. Preview candidates. If a template's music shows a muted/copyright notice, don't use it — try another candidate. Only use templates whose music actually plays.
3. Drop `segment_1.mp4` through `segment_N.mp4` into the template's slots in order. Upload each file yourself; if any file is over 10MB, tell the user and ask them to upload it manually (browser-upload is capped at 10MB per call, and CapCut's native file picker isn't drivable by browser automation).
4. Let the template's own transitions, pacing, and effects run as designed — don't fight them or try to override the template's timing.
5. Export the result and watch it back. Judge honestly: does the length and rhythm feel natural, or does the template stretch/repeat footage awkwardly (e.g. a short segment forced into a much longer slot)? If it feels natural, this is the draft — save/rename it as `draft_output.mp4` in `$ARGUMENTS` and go straight to **Phase 7** (skip the critique loop; the template already handled pacing). If it doesn't feel natural, go back to step 1 and try a different template — up to 3 template attempts total.

**Fallback path** (no template with a matching slot count exists, none has usable music, or 3 template attempts all felt unnatural):

1. With ffmpeg, for each `raw_segments/segment_N.mp4`:
   - Crop/scale to vertical 9:16 at 1080x1920 **without squashing** — use `crop` to match the 9:16 aspect ratio first, then `scale=1080:1920`, not a direct scale that distorts.
   - Apply a light Ken Burns zoom (zoompan filter), 1.0x → 1.05-1.08x over the clip's duration, nothing more aggressive.
2. Concatenate the pieces with **hard cuts** (ffmpeg concat demuxer or `concat` filter) — no cross-fades, especially where framing/angle changes a lot between clips.
3. Target total runtime 12-15 seconds. Trim segment durations to hit this before export.
4. Export as `draft_output.mp4` in `$ARGUMENTS`, then continue to **Phase 4** for a full critique. (The CapCut path's naturalness check in step 5 above substitutes for Phases 4-6 when it succeeds; the fallback path still needs the full critique loop, since there's no template doing pacing for us here.)

## Phase 4 — Critique the draft

Only reached via the Phase 3 fallback path. Watch `draft_output.mp4` (pull frames across its full length, and check audio levels/silence with ffmpeg if the clips carry sound). Score honestly — do not go easy on your own cut. Rate each of these 1-5 with a one-line reason:

1. **Scroller test** — a traveler thumb-scrolling fast, sound off. Does the first ~1 second earn a stop?
2. **Market bar** — web search 3-5 current examples of trending short-form travel/coffee content for pacing/cut-rhythm comparison. Does this cut's rhythm hold up, or does it feel slow/dated next to them?
3. **Brand fit** — does it read as "premium organic forest coffee + data-driven pioneer"? Is anything over-promised or off-brand?
4. **Technical** — text overflow, image quality, compression artifacts, aspect-ratio distortion, audio clipping.

## Phase 5 — Triage any issues found

Split whatever Phase 4 flagged into two buckets:

- **Fixable in code** — text overflow/positioning, cut pacing (too slow/fast), runtime off-target, clip order not telling a clear story, bad crop/framing. → go straight to Phase 6.
- **Needs a human call** — music/sound trend choice, subjective style preference, content/copy that needs to be rethought rather than repositioned. → skip to Phase 7 and say plainly why this can't be fixed in code.

If Phase 4 found nothing wrong across all 4 dimensions (all strong scores, no notes), skip straight to Phase 7 and report success.

## Phase 6 — Auto-fix and re-review

For every code-fixable issue: fix it immediately with ffmpeg (reposition/resize text, move cut points, rebalance segment durations, reorder clips, re-crop) and export a new version (`draft_output_v2.mp4`, `v3.mp4`, ...). Then loop back to **Phase 4** and re-critique the new version.

Repeat this loop **up to 3 rounds total**. If round 3's critique still isn't clean, stop looping — move to Phase 7 and report exactly what's still wrong and why it wasn't fixable in code.

## Phase 7 — Final report

Report to the user:

- Which path produced the draft: a CapCut template (name it, and summarize what music/effects it added) or the ffmpeg fallback (say why the fallback was needed — no matching slot count, no template with clean/unmuted music, or template attempts didn't feel natural).
- If the CapCut path was used: your honest naturalness judgment from Phase 3 step 5.
- If the fallback path was used: how many critique/fix rounds were done and what changed each round, plus the latest scores (1-5) for all 4 critique angles with reasons.
- Final status: **"โพสต์ได้เลย"** (ready to post) or **"ต้องให้คุณตัดสินใจเรื่อง [specific thing]"** (needs a human decision on X), naming exactly what's blocking.
- The final file's full path.

## Phase 8 — Package the post-ready folder

Run this phase regardless of Phase 7's status — even a cut still waiting on a human call still gets packaged, so the user has everything staged to review and finish by hand. Use `draft_output.mp4` (or its latest `_v2`/`_v3` revision) from Phase 3/6 as the source.

1. Create a new folder named `พร้อมโพสต์_YYYY-MM-DD` (today's date) inside `$ARGUMENTS`, alongside the raw source clips.
2. Burn in on-screen captions with ffmpeg (`drawtext` or `subtitles` filter) and export two versions into that folder, same font/position/style, same timing, only the language differs:
   - `clip_TH.mp4` — captions in Thai
   - `clip_EN.mp4` — captions in English, a faithful translation of the Thai (same meaning, not a literal word-for-word retranslation)
   Base the caption wording on what the clip actually shows (from Phase 1's story arc) and the brand voice from Phase 4 ("premium organic forest coffee + data-driven pioneer") — write real, specific lines, not placeholders.
3. Write `caption.txt` in the same folder, filled in with real content (not placeholders), in this exact template:

   ```
   === แคปชั่นใต้โพสต์ (ไทย) ===
   [Thai caption text]

   === แคปชั่นใต้โพสต์ (อังกฤษ) ===
   [English caption text]

   === Hashtag แนะนำ ===
   [hashtag list fitting this clip's content/brand]
   ```

4. Report to the user: the folder's full path, the three files inside it (`clip_TH.mp4`, `clip_EN.mp4`, `caption.txt`), and that everything is staged for them to review and post themselves.

## Phase 9 — Stop

Everything through Phase 8 is editing, not publishing. **Stop here.** Do not open TikTok, Facebook, or any other social platform, and do not upload or post the video anywhere, under any circumstances — that step belongs to the user alone and needs their explicit go-ahead every time, regardless of which tool produced the clip.
