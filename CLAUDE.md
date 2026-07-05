# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**WAYPOST** — a cozy browser courier game in vanilla JS + Three.js (no framework,
no bundler, no dependencies beyond the vendored `vendor/three.module.js`, r160).
You are the only courier of a small looping world: carry letters and parcels
between twelve inhabitants, earn stamps, uncover a gentle mystery. Tone: warm,
gently funny, a little wistful — a Ghibli postal route. No combat, no fail
states beyond retrying, no minimap (wayfinding is landmarks + a wrap-aware
compass ribbon).

## Commands

```bash
# run — it's a static site, any file server works (ES modules forbid file://)
python3 -m http.server 8000        # then open http://localhost:8000

# syntax-check a module (no build step, no linter, no tests exist)
node --input-type=module --check < src/wrap.js
```

There is no build, lint, or test tooling — the repo ships as-is, served
statically. Verification is: serve, open in a browser, watch the console.

## The original brief (condensed, with every constraint that matters)

1. **Flat authored 400×400 map** on XZ. All layout is data in `src/layout.js`
   (`BUILDINGS`, `PROPS`, `SCATTER`, `NPCS`, `ROADS`…). **No procedural
   generation** — the seeded scatter in layout.js is authored density data,
   deterministic every boot.
2. **Infinite via wrapping**: player position wraps modulo 400. The world is
   rendered as the root + 8 clones (3×3 grid) so horizons are continuous.
   **Every distance check in the game must use nearest-wrapped-copy distance**
   (`wrapDist` in `src/wrap.js`) — deliveries, vibe blending, audio, prompts.
   No chunk streaming.
3. **Curvature is a shader, not a globe**: a shared `onBeforeCompile` vertex
   hook (`src/shader.js`) bends geometry down with distance² from the camera.
   Gameplay math stays flat 2D.
4. **Art direction is the soul**: flat-shaded toy-diorama low-poly, 3-step
   toon ramp, one sun with soft shadows, gradient sky dome, fog, ACES filmic,
   CSS vignette + multiply color-grade overlay. **One global wind uniform
   sways all foliage/signs/laundry/antennas** — everything breathes.
5. **8 zones + 1 buffer**, each with a locked palette in `src/palettes.js` —
   the **single source of truth for every color** (do not hex anywhere else).
   Zone vibes (sky, fog, sun, grade, particles, audio) **blend smoothly** by
   wrapped distance in `src/vibe.js`. No hard switches.
6. **Day/night ~10 min** (`G.tod`, advanced in main loop) + weather
   (clear/rain/mist) recolor everything; windows/lamps/neon wake at night.
7. Performance: merged vertex-colored buckets (see Architecture), 60fps on a
   mid laptop, quality toggle (pixel ratio, shadow res, corner copies).

## Approved creative decisions (do not re-litigate)

- **Map** (z south): Pine Highlands / Hot-Spring Village / Observatory Hill
  across the north; Terraced Farms / meadow / Sandstone Souk mid; Marshes /
  **Harbor Town (hub)** / Neon Junction south; a water band "the bay"
  z=305–345 with 3 bridges; coastal road z=360. All roads are full loops
  across the wrap.
- **Lantern Row** (`dimstreet` zone): the requested dim transitional street
  between Harbor and Neon — shuttered arcades whose signs *wake as you
  approach* (`W.wakeSigns`, proximity + dusk driven).
- **The wrap teaching moment**: tutorial job 3 sends you Harbor → Yuzu in the
  Hot-Spring Village. A signpost says NORTH (long way); the compass points
  SOUTH over the bay and across the z-wrap (short way). Postmaster line:
  "the world is smaller than it looks, dear."
- **Story (approved as-is)**: the previous courier, Old Marin, left a drawer
  of undelivered parcels — pieces of a brass **orrery**, his unfinished
  apology to his estranged sister Vesper, the astronomer. The parcels go to
  Basira (gear), Yuzu (lens), Tam (counterweight), Vesper (base ring, then
  assembly). The last parcel has no address: it's *for* the ferryman who has
  circled the bay all game — he **is** Marin (foreshadowing: never speaks,
  always faces away, faded satchel with the same red trim as yours). Finale
  at the Great Eye: the telescope tilts **down**, and everyone sees their own
  looping world, small and complete. All text lives in `src/story.js`.
- **No-fail philosophy**: melted (urgent) or rattled (fragile) parcels still
  deliver at half stamps, with a kind line. Nothing punishes; retrying is the
  worst case.
- Desktop-first, functional mobile (joystick + RUN/E buttons, already in
  index.html/ui). Vendored Three.js. Full schedules for 6 story NPCs,
  two-point loops for the other 6. Title: **Waypost**.

## Architecture — the parts you must understand together

**The wrap contract.** `G.px/G.pz` may drift out of [0,400) during a frame;
`player.js` renormalizes and shifts the camera by the same delta (invisible,
since all copies are identical). Static world = `W.root` + 8 clones sharing
geometry/materials. **Dynamic objects exist once** (NPCs, ferry, gulls, cats,
rotors, player) and are re-seated every frame at `nearestCopy(x, z, G.px,
G.pz)` — you only ever notice the nearest copy. If you add anything dynamic,
follow that pattern or it will vanish at the seams.

**The bucket renderer** (`src/world.js`). Nothing static is an individual
mesh. Builders call `put(bucket, geo, color, x, y, z, opts)` which clones a
unit primitive, transforms it, paints per-vertex color, and appends to one of
five buckets: `static` (rigid), `tree` (gentle sway), `flex` (strong sway),
`win` (window glow), `neon`. Each bucket merges into ONE mesh with one
material → ~10 draw calls per copy × 9 copies. Exceptions that stay live:
windmill rotors and Lantern Row wake-signs (named meshes, found via
`scene.traverse` after cloning). Materials for `win`/`neon` are
`MeshBasicMaterial` whose `.color` scalar is lerped by night in
`updateWorld` — that's how windows come alive at dusk.

**The shader hook** (`src/shader.js`). `patch(mat, {sway, swayBase})` injects
curvature + wind into any material by replacing `#include <project_vertex>`.
Uniforms are module-level singletons in `shared` (`uCurve`, `uWind`,
`uWindAmp`, `uCamPos`) — main/player/weather write them; every material reads
them. `toon(color, opts)` is the cached material factory.

**The ink-outline pass** (`src/shader.js`). The high-quality-low-poly look is
inverted-hull outlines: the merged `static`/`tree` buckets get a second
BackSide draw whose vertices are pushed along a *smoothed* normal attribute
(`smoothNormals` welds coincident verts so flat-shaded hulls don't crack),
thickness grows slightly with camera distance. Characters/ferry use
`addOutlines(group)` — per-part hulls scaled from each primitive's bounding
box. Ink is **unlit** MeshBasicMaterial, so every ink material registers in
`inks[]` and `updateWorld` multiplies it by daylight — skip that and outlines
glow at night. Bucket ink is vertexColors × 0.26 (tinted lines, not black).

**Painted water** (`src/world.js`). The bay is a ShaderMaterial: depth
gradient (`harbor.colors.shallow→deep`), scalloped foam lines at each bank,
gentle waves, night dimming, three.js fog chunks included manually. All wave
frequencies must be `2πn/MAP` or the surface seams at the wrap. Uniforms
`uTime`/`uNight` are fed by `updateWorld`; `uCurve`/`uCamPos` are the shared
singletons.

**The wind actually blows** because `main.js` advances `shared.uWind` each
frame — if sway ever freezes, check that line first.

**The vibe pipeline** (order matters, per frame in `main.js`):
`updateVibe(px, pz, tod)` computes normalized zone weights + blended colors →
`updateWeather` *mutates* the vibe result (fog closer, sun dimmer) →
`main.js` applies fog to the scene → `applyGrade()` (DOM multiply overlay) →
`updateWorld` applies sky/sun/hemi/night materials → `updateAudio` crossfades
per-zone WebAudio beds by the same weights.

**Game state** (`src/state.js`). One mutable `G` object, imported everywhere.
`G.mode` routes everything: `title | play | pause | dialogue | modal |
finale | finale-credits`. Autosave to localStorage every 12s + on pause
(`save()` picks a whitelist of fields; `G.jobs`/`G.active` are deliberately
NOT saved — the board regenerates).

**The courier loop** (`src/deliveries.js`). Board jobs come from authored
`TEMPLATES` (giver, recipient, flavor, special: fragile/urgent, tier gated by
zone trust). Job states: `open → fetch → carry → delivered`. The E key goes
through `interact()`: board > pickup/deliver > Odile (tutorial, then story
parcels gated by `G.deliveredCount`) > small talk (`GREETINGS`). The compass
target is `compassTarget()` — it tracks live NPC positions, wrap-aware.

**Import cycle warning**: `ui.js ↔ deliveries.js` intentionally cycle (both
only call each other at runtime, which ES modules tolerate). Don't add
top-level *evaluation-time* uses across that boundary.

**Audio drop-in convention** (`src/audio.js`): all sound is procedural
WebAudio, but any file placed at `assets/audio/<name>.ogg` (harbor, farms,
pine, spring, souk, neon, marsh, observatory, dimstreet, rain, melody)
silently replaces its synth bed. Seamless loops, ~45–60s, quiet.

## Current status & next steps

All modules are written; the game has **not yet been verified in a browser**.
The remaining work, in order:

1. Serve locally, open the console, fix runtime errors (typos, three r160 API
   mismatches — e.g. check `TorusGeometry` import, shadow map behavior with
   the curvature hook, the `arcade`/`rotor` traverse-after-clone logic).
2. Play the full loop: title → tutorial 1–3 (wrap lesson works? compass points
   south?) → board jobs → shop (bike/glider/scarves/satchel) → story stages
   0–5 → Marin reveal (deliverable while the ferry passes a bridge — radius
   may need widening) → finale at the Great Eye → credits. Save/reload midway.
3. Performance pass on a mid laptop; verify the quality toggle.
4. Push to `github.com/vassu-v/waypost` (owner's explicit instruction; use the
   local gh binary if the system one is broken; no Claude co-author trailers —
   see the user's global CLAUDE.md rules on git identity/pushing).
