# Third-party components

framehand's own code and docs are MIT. These bundled pieces keep their own licenses:

| Component | Where | License |
|---|---|---|
| GSAP | `templates/*/vendor/gsap.min.js`, copied by `om new` | GSAP Standard License (`GSAP-LICENSE.txt`) |
| Font library (Noto Sans SC, Inter, Poppins, and others) | `fonts/`, copied into projects by `om new` / `om fonts add` | SIL Open Font License 1.1 — see `fonts/LICENSES.md` and `fonts/OFL.txt` |
| Clip / grammar runtime | `runtime/clip/` | MIT — see `runtime/clip/LICENSE` |
| Showcase art-motion engine (demo only) | `examples/showcase/vendor/art-motion/` | MIT — see that folder's LICENSE |

Instrument samples, optional voice models, and whisper.cpp models are downloaded from their sources on first use and are not redistributed here.
