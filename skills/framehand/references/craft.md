# Conditional craft notes

## Composition and explanation

First ask what this shot's hero is, how big a screen the viewer has, what they need to read, and what differs before and after the change. Design key frames at the real aspect ratio to catch text that is too small or crowded early. "This button in the right half of the screenshot" guides implementation better than "stunning tech feel".

Keep style and composition separate: the same colours, type and materials can carry different shot sizes, layouts and motion. Mixing styles is a legitimate narrative choice, but object identity and what stands for what must stay clear. Do not make every shot the same template for the sake of consistency.

Gather real material before designing; interfaces, product form and data definitions are facts too. If something is missing, mark the gap; do not fill it with a fake interface showing an operation that never happened.

## Why objects move

The most useful motion can be described with one verb: gather, split, align, connect, filter, reveal. Understanding "what differs before and after" should rest mainly on the object changing, not on narration explaining an unrelated animation.

Carrying the same object through reduces the cost of re-identifying things. Keep a film-long hero only when the story needs one; do not turn "there must be a hero" into a mascot forced onto every video.

Art pieces can use one main action plus a loop drawn from the material: a starry sky flowing, ink spreading, colour blocks overprinting. Story reactions, text landing and data reading can be completely still. The amount of moving area is a diagnostic clue, not a quality score.

Transitions can come from the next scene's signature material: dots of colour growing over the frame, paper unfolding, a line extending; or simply the camera moving within one world. Use a hard cut directly when it has a clear rhythmic or semantic job.

## Camera and rhythm

Write a concrete target and reason for every move. Flat zooms are usually enough for screenshot information; build parallax layers only when the foreground/background relation is worth showing. When neighbouring focal points are close, merge or pan between them instead of pointlessly pulling out and pushing back in.

Frame by first computing the bounding box of the key content, then subtracting caption space and margins. Judge whether text is big enough on the final target screen, not from the code font size or a fixed scale.

Tutorials need clear location and result; fast-paced pieces can use short push-ins, whip moves or rapid scale changes. There is no universal shot spacing, zoom limit or "slower is better" rule; those values depend on asset resolution, information load, film type and user feedback.

Action emphasis can use a fast start and a firm settle; give bounce only to objects that need weight or rebound. Linear motion is legitimate for constant-speed objects, scrolling backgrounds and the like. No single easing curve guarantees a premium feel.

## Sound and picture

With narration, confirm the audio track and word timings first, then design the reveals that must sync. Write a cue as "when this word is said, the viewer sees the result", not only aligned to the start of the action: if something flies in over half a second, start it earlier so the settle lands on the stress.

Leave holds for reading and reasoning. If the voice-over has no breathing room, slowing the picture cannot create audible space; changing the audio must be within what the user allowed this time, and never add or cut the user's own words automatically.

## Layers of the work

Concept and timing plan → assets and drawing → object animation → camera → captions → mix. First decide which layer the problem is in, then change that layer. Weak picture craft should not trigger a timeline rebuild; an overly dense voice-over should not make the animator tweak camera moves forever.

For Canvas styles, first understand how the material forms: stroke layout, regional colour groups, the layering of paper and ink. Static material can be cached while stroke direction evolves continuously; reshuffling randomness every frame turns into flicker. When characters are layered in, unify light or material, and keep the original images.
