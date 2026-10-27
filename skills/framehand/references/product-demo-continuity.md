# Best practice: explaining a product operation with continuous framing

Read this when making a product demo, a cross-device workflow or a short UI-operation film. The reference is ChatGPT's official [demo of delegating a Codex task](https://x.com/ChatGPT/status/2108636748217770180), published 2026-10-09 and broken down 2026-10-10. Its value is in rhythm, composition and the hand-off of attention; the light background, yellow bubble and device shells are that film's own choices.

## Evidence and scope

The source is 1920×1080, 30 fps, 732 video frames, a video track of about 24.40 s. The time windows below count from 0 in the source and are approximate boundaries, not a frame-accurate edit list. This breakdown checked frames sampled across the film, 0.1 s sequences around key seams and full-resolution representative frames; it did not include a normal-speed viewing or a listening review, so it makes no claims about exact easing, beat, sound effects or production software. The source video has an audio track.

"Picture observations" are what can be seen in the source; "transferred methods" are implementation choices proposed from them and not yet verified on a finished film about an unfamiliar topic. The source is a promotional demo; its run times, test numbers and operation packaging do not prove product capability. The skill ships the method and source link; the source film and evidence frames stay in a private research folder.

## How the source organises viewing

- About 0.0–0.7 s: the whole phone sits centred on white, then quickly scales up and reframes onto the input box below. First identify the device, then make the operation the hero; cropping off the top of the device is deliberate.
- About 0.8–3.8 s: the request appears letter by letter, the input box grows as lines wrap, and the close-up basically holds. The changing text already drives the event; the camera need not wander at the same time. There is a short hold after typing before sending.
- About 3.8–6.6 s: the input clears, the message enters the conversation; the framing pulls back to the whole phone and a reply appears. The close-up explains "how it starts", the wide explains "what happens after".
- About 6.6–7.5 s: the phone moves right, a desktop window appears from the left and expands, ending in a pairing with the desktop primary and the phone secondary. The phone and the yellow request remain recognisable; the cross-device link is built through composition, not a separate title card.
- About 7.5–10.9 s: the camera is broadly steady, three tasks appear in turn and the cursor moves to one of them. The desktop carries the reading, the phone carries the reference to the source; the two devices do not compete for the same attention.
- About 11.0–12.8 s: the task is clicked and details appear on the right; the frame pushes in on the details while the desktop border and other sessions gradually leave, keeping only the delegated request and its status. First see where it came from, then remove the surrounding visual load.
- About 13.8–16.4 s: a result summary and list of changes appear, and the frame is given over to reading; around 16.4–17.1 s the content moves up and the next request, to open a PR, comes in. After about 18.3 s the completed result appears and holds. Content scrolling carries progress; the framing no longer keeps changing scale.
- About 20.4–20.8 s: the content clears to a brief white frame; around 20.9–21.3 s a notification card enters and settles, holding to the end. The notification reuses the same avatar and summarises the three tasks, closing the opening request as one result.

The viewing structure is "whole device → operation close-up → whole device → paired relationship → detail close-up → result notification". When transferring it, keep the causal order and set the timing from your own information; do not treat 24 s, three tasks or these seconds as a template quota.

## Rhythm: short moves, long explanations, each event brings the next shot

Write the business events first: start typing, finish typing, send, reply, tasks appear, click, result appears, notification. Then give every framing change a triggering event and a landing point. Split each look into "move to the focus → settle → understand / state change", and tune move time and reading time separately; slowing everything drags the hand-offs, speeding everything swallows the reading.

In this reference, the opening and the cross-device rearrangement are brisk, while typing, task expansion and reading results take longer. Try a simple framing move of about 0.3–0.8 s, then adjust for the target screen and viewing distance; this is a starting point for transfer, not a measured easing from the source or a range for every shot. While the frame holds, text can type, a list can expand or a status can update, so a still frame still grows information.

A sequential demo links cursor, click feedback and the new state. Waiting before a result can be compressed, but do not cut it into "click and it's done", which implies a capability; keep a processing state or show that time passed where needed. Run times in the reference are just picture content, not measurements of this product.

## Composition: one main reading area at a time

Wide shots let the viewer identify the device and relationships; close-ups let them read key text. Paired shots set a primary and a secondary: the main window is large enough to read, the secondary device only needs to be recognisable as the same request or source as the previous shot. Change focus only when the secondary device needs reading; do not treat two small interfaces as body text.

Keep a few identity anchors, such as the same request, avatar, bubble colour or task title. A white background and sparse accent colour make the subject easy to locate; for another brand, use that brand's real identity elements instead of copying the yellow or the character. Frames, rounded corners, letter spacing and light shadows help separate interface layers; strong reflections and heavy shadows cannot replace legible text.

It is fine to crop away device shells or irrelevant sidebars to explain. It only counts as focusing if the same focal point can be located before and after the crop and the key text is complete; cropping off the most important information is a fault. Check type size and line breaks at the real output resolution and target viewing size; line lengths from an English reference do not carry over directly to other languages.

## Camera: decide the landing, then how to get there

Write one sentence per seam: `who is the focus of the previous shot → where it goes in the next shot → what new information becomes visible because of it`. The phone moving right to make room for the desktop is an object rearrangement; the input box scaling up is flat reframing; the detail lifting out of the desktop frame is extracting a level of information. They need not all be implemented as one 3D camera.

Implement four separate layers: interface content / scrolling, device / window shell, the framing wrapper, and fixed captions / subtitles. A simple front-on interface needs only DOM/SVG and 2D transforms; tune object position and framing scale separately so that line wraps in the input box do not distort the device proportions. Synchronise layers only to serve a clear hand-off; do not move every layer for the sake of motion.

For flat framing, compute the wrapper translation from the local focus `(fx, fy)` in the wrapper, the landing point in frame `(vx, vy)`, the wrapper's untransformed top-left layout position in frame `(bx, by)` and the scale `s`: `x = vx - bx - s * fx`, `y = vy - by - s * fy`. This assumes the wrapper's transform origin is top-left, the local point already includes content scrolling, and no parent applies another transform not accounted for; `bx/by` must not be taken from bounds that are already scaled or translated. `bx/by` are 0 only when the wrapper starts at the frame origin. Animate from the current pose to this landing point, not from the default centred pose each time; nearby targets often need only a pan.

When a detail needs lifting out, start it matching its position, size and text in the original interface, and only after the viewer recognises it fade the surrounding frame or push in. Packaging effects stay as film layers and must not pretend to be built-in product animation. Screenshot assets need matching crops or masks; do not erase text and write feedback that does not exist.

The closing notification can be a separate card that reuses the avatar or name to tie the result back to whoever started it. The source uses a white frame as a divider here, which does not mean every shot must morph seamlessly; a white frame should be deliberate punctuation, never a cover for failed loading or dropped frames.

Every pose is determined by one timeline or absolute-time sampling. Set the GSAP wrapper's initial state explicitly; on later `fromTo` calls set `immediateRender:false` where needed so that a future close-up does not appear in the first frame. Seeking backwards must restore the same content, crop and camera position.

## In real production and review

When starting a product demo, write a short shot record with the real assets:

`event | current reading area | identity anchor kept | start and end framing | content action / framing action | settle moment | reading window | new information in the next shot`

First build the stretch most likely to lose orientation, such as "whole device → cross-device pairing → task detail". Check motion and reading with final assets and fonts, then lay out the whole film. The existing `keynote-ui` grammar provides titles, cards and screenshot highlights; it does not automatically guarantee continuous cross-device rearrangement, scrollable content or detail extraction, so when you need those, build the shots in free source with `blank`.

At review, look separately at:

- Three representative frames: is the whole device recognisable, does the pairing have a primary and secondary, is the detail large enough to read. Compare visual weight, white space and framing purpose with the reference; matching colours and fonts is not the same as learning the composition.
- A short sequence at each seam: how the old focus hands to the new one, whether position, scale and content all change at once so the viewer has to search again, and whether fast moves land precisely.
- The cut at normal speed: are reading windows long enough, does content advance during steady stretches, does the camera move ahead of the user's action, does the notification answer the opening request. Sampled frames cannot replace this.
- Sound: follow the main skill's music and sound-effect flow, designed around your own landings; the reference was not listened to, so do not derive a BPM or sound recipe from it.

A transfer succeeds when unfamiliar content can be followed from the request all the way to the result. Log the first transfer as a "trial"; after independent review and real user feedback, feed the working changes, failing time windows and scope back into `experience.md`. When counter-evidence appears, correct the matching conclusion; do not promote this film's recipe to a hard rule for every animation.
