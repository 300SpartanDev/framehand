# Contributing to FRAMEHAND

Thanks for helping. Bug reports, style ideas and pull requests are all welcome.

## Run it locally

You need **Node.js 22** or newer, **FFmpeg** (`ffmpeg` and `ffprobe`) and **Chrome, Chromium, Edge or Brave**.

```sh
git clone https://github.com/<your-username>/framehand.git
cd framehand
node cli/om.js doctor     # checks Node, Chrome and FFmpeg
node cli/om.js ui         # the app, at http://127.0.0.1:7870/
```

`node cli/om.js help` lists every command. If FRAMEHAND can't find your browser, set `OM_CHROME` to its path.

## Run the tests

```sh
npm test                                  # the main test suite
node --test runtime/clip/test/*.test.js   # the clip runtime tests (CI runs these too)
```

Tests that render real frames need Chrome and FFmpeg; they skip themselves when either is missing.
CI ([`.github/workflows/test.yml`](.github/workflows/test.yml)) runs both on Linux, plus a render smoke test on Windows.

## Where things live

- `templates/`: the styles (`node cli/om.js templates` lists them)
- `cli/lib/`: the engine (`compose-brief.js` picks a style and plan, `brand-layer.js` adds logo, photo and end card, `caption.js` writes the per-app captions)
- `cli/ui/`: the local app
- `runtime/`: the clip runtime
- `test/`: the tests

## Issues

- **Bug?** [Open a bug report](https://github.com/300SpartanDev/framehand/issues/new?template=bug_report.md). Say what you did, what happened, your OS, and paste the output of `node cli/om.js doctor`.
- **Idea?** [Open a feature request](https://github.com/300SpartanDev/framehand/issues/new?template=feature_request.md).
- New here? Look for issues labelled [`good first issue`](https://github.com/300SpartanDev/framehand/labels/good%20first%20issue).

## Pull requests

1. Fork the repo and make a branch from `main`.
2. Keep the change focused, and add or update a test when you change behaviour.
3. Run `npm test` and make sure it passes.
4. Open a pull request that says what changed and why.

For bigger changes (a new style, a new command, a change to how videos are made), please open an issue first so we can talk about it.

## Ground rules

FRAMEHAND runs on the user's own computer and never posts for them. Please keep it that way: no uploads, no accounts, and no made-up numbers in videos.

By contributing you agree that your work is released under the [MIT License](LICENSE).
