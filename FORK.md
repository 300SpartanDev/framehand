# FORK.md — FRAMEHAND

FRAMEHAND is a consumer-focused version of an open-source motion-graphics engine (see [NOTICE.md](NOTICE.md)).

## What this version adds

| Area | What |
|---|---|
| Core flow | **One line → a unique video → share pack** (wide 16:9, vertical 9:16 or both). It never posts by itself |
| Variety | 10 styles (`kinetic-type`, `keynote-ui`, `kurzgesagt`, `whiteboard`, `math-3b1b`, `finance-chart`, `vox-collage`, `storytime`, `ui-space`, `object-3d`), picked by what the brief is about, each with several scene plans. Same brief + a different version number → a different video |
| Honesty | Only the user's own numbers, pictures and words appear; styles that need a chart, formula or screenshot are skipped without one |
| Engine | `cli/lib/compose-brief.js` (reads the brief, picks a style and plan), `cli/lib/brand-layer.js` (logo, screenshot, end card), `cli/lib/caption.js` (per-app captions) |
| App | `om ui` — local page: quick look, progress with time left, stop, music toggle, your videos, share packs |
| Share | Packs for X, Instagram, TikTok, YouTube Shorts and LinkedIn, plus a button that opens each app's upload page. The user always clicks Post |

## Run

```sh
node cli/om.js doctor
node cli/om.js ui          # http://127.0.0.1:7870/
```

On a Mac you can double-click `run_ui.command` instead.

## Legal

- [LICENSE](LICENSE) — MIT; the upstream copyright is kept
- [NOTICE.md](NOTICE.md) — where this came from
- [THIRD_PARTY.md](THIRD_PARTY.md) — fonts and libraries
