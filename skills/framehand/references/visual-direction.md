# Visual craft and camera direction

Read this when making a new film, when the user asks for a higher finish, or when a cut was called rough or boring. It guides creative judgement. A project that runs, passes frame diffs and has plenty of assets has not thereby passed on taste. A prototype built to test a technique is labelled a prototype and is not promoted to a creative example.

## First decide what is worth seeing

Turn the brief's explanatory goal into visible evidence. Write down the hero, the change, one detail worth getting close to, and what the viewer understands at the end. For example, "a station runs out of bikes" has both the city-wide flow and the empty dock after the last bike leaves; the number reaching zero and the real gap in space should prove each other.

With references, look at the actual frames and motion instead of collecting style names: note representative frames, how much of the screen the subject fills, material and light, how shots start and settle, visible speed changes, reading holds and hand-offs. Keep observation and guesswork apart. A video-understanding model can add meaning but cannot replace checking the frames; a promo's packaging does not prove what the product can do.

For product demos and cross-device UI flows, read [continuous framing best practice](product-demo-continuity.md) as needed: the timecodes of the ChatGPT reference, primary and secondary reading areas, short framing moves with stable reads, separating the UI layer from the framing layer, and checking each stretch. When you borrow its viewing structure, set durations again from this film's own information.

Keep to a confirmed direction. With none, follow the selection flow in the main entry point. Do not hand creative judgement back to the user because "not every parameter was specified".

## Make the picture survive the camera getting close

Work back from the actual shot size to the precision needed, and spend effort where it is visible:

- Wide shots: silhouette, depth layers, light/dark grouping and a focal point first. A city needs block scale, a river bank or main road, buildings of varied height and density, not one kind of box spread evenly.
- Medium shots: add the structure that explains the setting: building bases, windows and eaves, roads and kerbs, bridge supports, how a station sits in its street. Repeated elements come as a logical family with variants, not random detail stuck everywhere.
- Close-ups must deliver material and construction. A bike needs a recognisable frame, tyres, handlebars and saddle; a dock needs structure and contact shadow. When the subject changes, check that object's own structure, edges and contact points; do not copy the city checklist.

Check that silhouette, edge highlights, roughness differences, translucency or reflection, contact shadows and key/fill light all describe the same material. A pretty grade cannot rescue paper-thin thickness, floating contact or wrong construction. Fine detail is only worth adding if it is visible in the final output on the target screen.

2D carries the same craft duty: letterforms, spacing and line breaks; curves and joins; proportion, white space and visual weight; cropping, resolution and edge handling of real images. Flat colour, minimal or whiteboard work can be very refined; detail does not mean texturing everything.

First pick the representative states that expose this film's main craft risk and render them at final resolution. A spatial film with scale changes checks construction in close-up and composition in the wide; a fixed-frame animated chart or loop checks its densest, sparsest or key-change state, without forcing shot sizes for the sake of review. Compare side by side with the confirmed direction or reference, write down concrete gaps and fix them, then lay out the full timeline. Never pass off a low-detail grey model as the final style unless grey is what the user chose this time.

## Write rhythm as a way of watching

For each shot, write "why look here", then choose shot size and movement. Keep each shot's note short:

`shot ID | what the viewer gets | hero/focus | start and end framing and size | object action | camera path / speed intent | settle and hold | how it hands to the next shot`

A shot's speed intent should read as a sentence, such as "drop quickly to the street, follow the bike fast, slow and settle as it nears the empty dock", not one smoothstep repeated for the whole film. Contrast between neighbouring sections can come from fast and slow, near and far, direction, picture density, main versus secondary motion, or movement versus stillness; choose from the content rather than ticking off a quota of techniques.

- Push in: pull evidence out of a relationship; the hero's position and the settled framing must be clear.
- Pull out: reveal which system a part belongs to; new information must actually appear.
- Truck / follow: let the viewer follow one event; foreground parallax helps show speed and space.
- Crane / orbit: reveal structure, occlusion or spatial relations a flat view cannot show.
- Hard cut / match on action: change the viewing question, story moment or scale of narration. No need to invent a fancy transition for each cut.
- Stillness: let an event finish, information be read or a feeling land. A hold still needs a composition worth looking at and a change that has happened.

Fast shots can be short and decisive; slow shots must grow information or be worth watching. When a film needs rich rhythm, smooth drift throughout should be questioned; yet even motion still works for constant-speed processes or a clearly calm mood. Do not promote a past film's "slower is better", shot spacing, zoom limit or cut quota into a universal rule. The user's explicit rhythm requests this time come first.

For continuous tasks such as using a web page or reading an article, keep the cursor, button, document or text position the viewer is tracking. Define each seam first: where the previous state's focus lands in the next state, and how it gets there; when state changes, avoid resetting framing, scale and viewing direction at once. Waiting can be compressed, but changing speed is not the same as suddenly changing the picture. Use a hard cut only when the film must change its viewing question and the viewer can still find their place; once the user has pointed out a break, fix spatial and action continuity first instead of adding more cuts for rhythm.

Design the landing first, then let the speed curve serve it. A quick acceleration, a follow, a hard stop and a long cushion are different choices; do not apply one easing curve to every object and camera. Key text must be steady and sharp while it needs reading; fast motion need not keep every frame readable, but a key fact should not flash past only in motion blur. When grouping or ordering is itself the explanation, group names, numbers and content stay trackable; a fixed caption layer is independent of the scene camera and must never slip out of frame while things move.

## Make the hardest stretch first, then expand

Build the most important viewing change as a short playable stretch with real picture detail. Films that need camera moves verify the change of viewpoint and the settle; locked-off pieces verify object state, information density or the loop seam, without adding viewpoint changes or pauses for their own sake. Use the final render path; do not stand in for motion with slide storyboards or prose.

After playing it straight through, ask: where is the eye led? At which moment does new information appear? Where is only the camera sliding while the content does not advance? Pin the diagnosis to timecodes. If the reference has clear speed or shot-size contrast and the test is still one kind of drift, re-plan the shots instead of speeding everything up.

During production treat three layers separately so you do not apply the wrong patch:

1. Looks cheap: check construction, material, lighting, type and compositing, not more camera moves first.
2. Looks boring: check how the explanation advances and the variation in shot size, speed and settle, not more decorative particles first.
3. Hard to understand: check focus, object identity, data and reading time, not more narration first.

In product promos, real material constrains facts and product identity; it does not mean the film can only pan across a whole screenshot. To show change, lift a sentence, a number or a card out of the real page as its own layer, let it come into focus, separate, take an edit, and return to its place. Keep source text and data accurate, and keep film packaging distinct from real controls; never pass off an effect as a native product feature. Keeping the page's reference points and the return to place is what gives depth and speed changes their explanatory value.

## The implementation must keep creative freedom

Keep camera and object motion on separate layers; keep the shot list, scene assets and business events apart. Sample shots on absolute time, record cuts explicitly, and fix the seed of everything random. Playing forward, seeking backward and re-rendering a single frame must give the same state.

Choose tools from the picture: SVG/Canvas for precise graphics; Three.js or offline 3D for real perspective, occlusion, material and light; licensed images, live footage and generated assets for their own kinds of content. Do not lower the visuals to fit the first structured formats (text/shape/image/chart). Advanced drawing can take the free-source path, stating its edit guarantees clearly, and an adapter can be built for it afterwards.

Let the user work with "this bike", "this tracking stretch", "hold the close-up one beat longer"; the agent and tools maintain object IDs, camera parameters and time mapping. What is parameterised is creative decisions, not only colours and titles. After changing material, construction, camera path or rhythm, watch the real cut again.

## Taste review and transfer

An independent reviewer gets the user's request, the agreed direction, the references and the real cut, without the production notes or test scores at first. Ask for specific faults with time windows: are structure and material rough, is the focus clear, is the rhythm uniformly smooth or uniformly frantic, which camera move added no understanding. Still frames check craft and continuous viewing checks rhythm; neither replaces the other.

Aiming for "top quality" means iterating until concrete problems are solved, not awarding yourself a high score. A cut the user clearly rejected can no longer be called a quality benchmark; engineering tests keep only what they actually prove.

To transfer a method to an unfamiliar subject, an agent that did not write the skill actually makes and renders the film, then it is reviewed independently. If only the city was redone, claim only a city improvement; if only a storyboard was written, claim only a planning trial. Controlled comparisons use the same topic, tools, assets, time budget and delivery spec, with randomised anonymous viewing, and the author never plays both baseline and judge. One success is case evidence; it does not show that every user can reliably make top work.
