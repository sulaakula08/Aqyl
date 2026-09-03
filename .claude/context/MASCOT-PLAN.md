# AQYL — mascot animation system: research + build algorithm

Written 2026-09-02. Visual version with a live rigged-SVG demo of the technique:
<https://claude.ai/code/artifact/5be52bf8-6733-45d9-b5c5-e2d46ac808de>

---

## STATUS — built 2026-09-03

Phases 0–13 and 15 are **implemented and verified in the running app**. Phase 14 (Rive) is
deliberately not started: it needs an artist in the Rive editor, and the SVG renderer it would
replace is also its fallback, so nothing is blocked by leaving it.

Files added: `src/ui/mascot.js` (public API), `src/ui/mascot/{rig,anim,machine,idle,speech}.js`,
`src/ui/juice.js`, `src/ui/sound.js`, `styles/mascot.css`.
Files touched: `state.js` (`settings.mascot`, `settings.sound`), `main.js` (mount hook, scene
reactions, sidebar toggles, offline wave), `learn.js`, `diagnostic.js`, `onboarding.js`,
`tour.js`, `tutor.js`, `dashboard.js`, `graph.js`, `plan.js`, `simulate.js`, `home.js`,
`icons.js` (`bird`), `curriculum.js` (`missIndex`), all three i18n dictionaries, `sw.js`
(cache `aqyl-v12`), `index.html`.

Deviations from the plan as written, and why:

- **`nod` added to the state vocabulary.** The plan had no cheap "got it" reaction, so every
  choice in the onboarding form would have had to borrow `correct` — which devalues an actually
  solved problem. `nod` is now the acknowledgement used by the form, the plan and the simulator.
- **`missIndex` added to `curriculum.js`.** Near-miss detection needed to know which distractor
  embodies the documented misconception, and the deterministic option shuffle was destroying
  that position. It is now recorded during the same shuffle.
- **No unmute prompt after the first correct answer.** The plan asked for one; it is exactly the
  kind of unsolicited interruption the rest of this design refuses. Sound is a toggle in the
  sidebar next to the language switch, off by default.
- **Calm mode needed its own pose table** (`CALM_POSE` in `machine.js`). Applying the final
  keyframe of a reaction — which is the rest pose — would have made reduced-motion mean "one
  face forever". Each trigger now maps to an expression.
- **`mascot.land()` needs a hard animation reset.** The flight animation lives with
  `fill: 'forwards'`; clearing the inline transform does not cancel it, and the character kept
  pushing the page sideways after the tour ended. `anim.reset()` exists for exactly this.

### Added 2026-09-03, beyond the plan

Four things the original plan did not contain. Each one exists because it says something
about *this* product that a generic mascot animation cannot.

1. **The mascot flies the cause chain on the knowledge graph** (`graph.js` → `mascot.flyPath`).
   Click a topic and Bürkit lifts off it and travels the prerequisite chain, landing on each
   node, ending worried on the root cause. The product's whole thesis — "you are not failing
   this topic, you are failing the one underneath it" — existed only as arrows in a panel that
   nobody reads. Now it is two seconds of flight, right-to-left across the graph, no words.
   No flight when the chain is a single node: an effect that implies a finding we did not make
   would be a lie.
2. **Growth** (`mascot/growth.js`). The rig's proportions are driven by the same average
   mastery the dashboard draws its ring from — head shrinks, wings lengthen, crest sharpens,
   tail fans out across four stages. Crossing a stage plays `molt`: a shiver, seven feathers,
   and the new silhouette unfurling under them. Progress rendered as the character rather than
   as a number the student scrolls past. Lives in the CSS `scale`/`translate` properties, not
   `transform`, so reaction animations never wipe it.
3. **The teacher's pencil** (`juice.scribble`). The correct answer gets a hand-drawn ellipse
   scribbled around it, overshooting where it closes, with deterministic wobble seeded from the
   option text so a re-render redraws the same line. It lives *inside* the option element:
   viewport coordinates put it in the wrong place the moment the feedback panel shifts the
   layout, which reads as the system circling the wrong answer.
4. **Feathers and wind.** Four feathers drift down when the student enters a lesson — only
   there, so it keeps meaning something. And the mascot leans into fast scrolling and rights
   itself, which costs ten lines and is most of what makes him feel located in the page.

### Second pass, same day

5. **A contact shadow** (`#m-shadow` in the rig, `shadowJump` in the machine). It shrinks and
   fades as he rises and swells on landing. Without it a jump reads as "the figure moved up";
   with it, as pushing off the ground. The cheapest weight in the whole system.
6. **Current along the graph edges** (`graph.sparkEdge`). As he crosses each prerequisite link,
   a lit segment runs the same edge underneath him, timed to the hop. The edge stops being a
   line on a diagram and becomes the road knowledge travels.
7. **The tutor's answer types itself out, word by word, paced by his beak** (`speech.onWord` →
   `tutor.typeOut`). Same clock drives both — and with TTS on, the words come from the
   synthesizer's own `boundary` events, so each word lands on screen exactly as it is spoken.
   A wall of text reads as a database dump; text somebody is saying reads as an answer.
   Hidden words hold their layout space, so nothing reflows, and a timeout reveals everything
   if speech is cut short.
8. **Two more strokes from the same pencil**: the wrong option gets struck through (gap colour,
   not red-pen), the hint box gets underlined. Same wobbling hand, same overshoot.
9. **A pecking micro-idle** — he taps the inside of the screen as if something out there caught
   his eye.

### Third pass — the redraw

The first rig read as generic stock vector, and it was: perfect symmetric ellipses, no outline,
soft translucent belly, a beak that was a plain triangle. That is precisely the visual signature
of machine-made illustration, and no amount of animation quality covers it.

Rebuilt with the craft signals of a designed mark (the reference was Replit's own site — warm
off-white ground, flat confident colour blocks, chunky geometry, heavy weight, no gradients and
no glow anywhere):

- **Ink outlines on every shape**, `vector-effect="non-scaling-stroke"` so the line keeps its
  weight when growth scales a wing 1.5×. Without that flag the outline fattens with the stage
  and the character turns to mush at the top end.
- **Asymmetry as a rule**: the crest is three feathers of different heights leaning left, the
  tail is a three-feather bundle offset right. A symmetric crest of equal spikes reads as a
  crown from a clip-art pack.
- **An actual bird of prey**: a hooked beak (the lower mandible now sits *behind* the upper one,
  so at rest it reads as a closed beak instead of the black hole the first draft had), and a
  heavy brow ridge — the one detail that turns a round head into a golden eagle. It is also the
  only line in the drawing heavier than the outline.
- **Flat blocks instead of soft blobs**: the breast patch is a solid shape with an edge, not an
  opacity wash. Translucency is what makes vector art look smeared.
- **A square eye highlight**, not a round one — a round highlight is a brush artefact, a square
  one is a decision.
- **Head narrower than the body**, so the silhouette has a hierarchy instead of being a snowman.
- Motion sharpened to match: a fourth spring (`POP`, stiffness 420) and a **hold on the peak**
  of the jump — two near-identical keyframes at offsets .42 and .5. Drawn animation reads by the
  pause at the extreme, not by the path; without it the pop just skims past the eye.

Verified in the browser: onboarding → diagnostic → learn flow with reactions and particles,
block-complete celebration, tour narration and clean landing, tutor thinking + beak, calm mode
(pose swaps, no particles, returns to neutral), dark theme, no horizontal overflow on any
screen, no console errors on any route.

Target: make studying in AQYL feel like a cartoon that reacts to you,
not a form that grades you — without breaking the two things the product is actually sold on
(works offline, works on a cheap Android in a village school).

---

## 0. The call, in one paragraph

Build **one mascot, one JS state machine, one renderer-agnostic API** (`mascot.fire('correct')`),
rendered by a **hand-rigged inline SVG** driven by the Web Animations API. Zero dependencies,
~15–20 KB, theme-aware for free, works offline on the first paint. Rive (what Duolingo actually
uses) stays as a **Phase 14 upgrade behind the same API** — it is the better tool, but it costs
~200 KB of WASM on the critical offline path plus real authoring time in the Rive editor, and
neither is available before demo day. Everything below is ordered so that a mascot exists and
reacts by end of Phase 5, and each later phase is independently shippable.

---

## 1. Research: what makes mascot animation "lit" instead of ordinary

### 1.1 How Duolingo does it

- **Not video, not a timeline — a state machine.** Duo and the character cast are built in
  [Rive](https://rive.app/docs/runtimes/web/web-js): one file contains states (`idle`,
  `correct`, `wrong`, `streak_milestone`) and the transitions between them. The app sets
  *inputs*; the character decides how to get there. This is why it feels responsive instead
  of "a clip played at you".
- **A modular rig, not a drawing.** The 2019 redesign deconstructed Duo into simple geometric
  shapes precisely so animators could bend body curvature, eye size and wing placement
  independently. Expression range comes from the rig, not from redrawing.
- **Layered / additive blending.** Mouth shapes blend additively over whatever the body is
  doing, timed to phonemes from their own speech models — the character can talk *while*
  celebrating. Layers are the whole trick: body layer + head layer + eye layer + mouth layer.
- **The mascot is a retention mechanic wearing a face.** Duo communicates state without copy:
  happy on a correct answer, celebrating on lesson complete, sad in notifications, the
  head-explode animation on a perfect lesson. Emotional attachment does the work that push
  notifications otherwise have to do.
- **A cast, not a single character.** Lily's dismissive slow-clap reads differently from Eddy's
  enthusiasm — variety per personality is what stops the reward from going stale.

### 1.2 The craft rules that separate "lit" from "ordinary"

Ordinary mascot work = fade in, bounce once, fade out. What actually reads as cartoon:

1. **Anticipation.** Nothing starts from rest. Before the jump, a 60–80 ms crouch in the
   *opposite* direction. This single rule is ~half of the difference.
2. **Squash & stretch, area-conserving.** Animate `scaleX` and `scaleY` in opposition
   (1.12 / 0.88), never uniform scale. Applies to the mascot *and* to the answer buttons.
3. **Overshoot and settle.** Land past the target and come back: 120 ms out, 90 ms settle.
   Use a spring, not `ease-out`, for anything that should feel physical.
4. **Follow-through / secondary motion.** Head arrives, *then* the crest, *then* the tail —
   8–14 % of the duration apart. Free personality: same keyframes, staggered offsets.
5. **Arcs.** Nothing travels in a straight line. Fly-in follows a quadratic arc; a straight
   translate reads as a UI element, a curve reads as a creature.
6. **Exaggerated, uneven timing.** Fast in, slow out. A wing beat is 90 ms up, 220 ms down.
   Even spacing = robot.

### 1.3 The juice stack (the layer above the character)

Each moment is a *chord*, not one animation: character pose + particles + a UI reaction +
a sound + a haptic. Correct answer =
`squash the button` + `mascot cheer` + `12 gold particles from the button, not from the mascot` +
`XP number flies to the counter` + `40 ms hit-stop before the feedback panel appears` +
`8 ms haptic`. Any one of those alone is ordinary; four together is the thing people screenshot.

- **Hit-stop**: freeze everything for 40–60 ms at the moment of impact, *then* release.
  Costs nothing, sells weight.
- **Particles**: 8–16, physics-driven, gone in 700 ms. Emitted from the *cause* (the tapped
  answer), pulled toward the *reward* (the XP counter).
- **Screen shake**: 2–3 px, 120 ms, only on big beats (topic unlocked, streak milestone).
  Never on a wrong answer — that reads as punishment.
- **Sound**: two-note rising interval for correct, one soft muted note for wrong. Muted by
  default in this product (kids open it in a classroom), one tap to enable.
- **Haptics**: `navigator.vibrate(8)` correct, `[12, 40, 12]` wrong. Android only, harmless
  elsewhere.

### 1.4 Idle life — the part everybody skips and the part that actually retains

A mascot that only moves on events is a sticker. Attention is held by the **loop between
events**:

- **Blink** on a Poisson schedule (mean ~4.2 s, never metronomic), double-blink 15 % of the time.
- **Breathe**: ±1.5 % vertical scale, 3.4 s cycle, body only — the head lags by 180 ms.
- **Look at the pointer / the focused input.** Eyes track within a small radius, head follows
  at 30 % amplitude, with a 220 ms delay. On touch devices, track the last tap.
- **Micro-idles** fired randomly every 6–14 s from a pool of 6–8 (scratch, glance away, ruffle
  crest, tiny hop, yawn). Weighted random with a no-repeat window of 3.
- **Boredom escalation.** 30 s idle → looks at you. 60 s → looks at the answer buttons
  (a hint by body language, not copy). 120 s → falls asleep, wakes on any input with a startle.
- **Never the same reaction twice in a row.** Every trigger has 3+ variants; pick weighted-random
  excluding the last one. Habituation is the enemy — the third identical celebration is noise.

### 1.5 The emotional arc (and the line we don't cross)

- **Escalate rewards, don't spend them.** 1 correct = a nod. 3 in a row = wings up. Block
  complete = full celebration + confetti. If everything is a party, nothing is.
- **Near-miss deserves its own state.** Wrong-but-close (adjacent distractor, or the misconception
  path in `engine/tutor.js`) → "ooh, so close" pose, not the plain oops.
- **The mascot never mocks.** Duolingo's guilt lever works on adults choosing to skip; our users
  are schoolkids who are already told they're behind. On a wrong answer the mascot is
  *concerned and pointing at the cause*, never disappointed in the student. Product rule,
  not a style preference.
- **Absence and return.** Come back after a day → the mascot is genuinely happy to see you.
  Streak broken → quietly sad *once*, then immediately offers the smallest possible next step.

### 1.6 Anti-patterns, banned in this codebase

- Animation that **delays** feedback. The correct/wrong answer must be legible within 100 ms;
  the celebration plays *over* an already-updated UI.
- Animation that **blocks input**. Every mascot animation is cancelable; tapping "next" mid-cheer
  cuts to the next state, it does not queue behind it.
- A **second mascot instance**. One singleton, one canvas layer, ever.
- **Motion on a schedule the user can't escape**: `prefers-reduced-motion` and the existing
  `settings.reducedMotion` flag must produce a *static but still expressive* mascot — pose
  swaps, no tweens — not a missing character.
- Anything that runs in a **hidden tab** or a scrolled-away viewport.

---

## 2. Technology: options, and why the verdict is what it is

Repo constraints that decide this: no build step, no dependencies, ~60 KB total app, offline via
`sw.js`, three languages, light/dark themes driven by CSS variables, target device = a low-end
Android on a bad connection.

| Option | Size on the wire | Interactive? | Fits this repo? |
|---|---|---|---|
| **Hand-rigged inline SVG + WAAPI** | ~15–20 KB, zero deps | Fully — it *is* JS | ✅ Ships today, offline free, inherits CSS vars → dark theme and gold accent for free |
| **Rive** (`@rive-app/canvas`) | ~200 KB WASM + `.riv` | ✅ Best-in-class state machines | ⚠️ Needs the Rive editor + an artist; WASM must be self-hosted (`RuntimeLoader.setWasmUrl`) and cached in `sw.js`; colors are baked, so dark theme needs a second file |
| **Lottie / dotLottie** | ~60–100 KB gz runtime | Partly (dotLottie state machines, 2025+) | ⚠️ Needs After Effects; heavier than Rive for what it gives; baked colors |
| **GSAP** | ~50 KB | ✅ | ❌ A dependency and a build-ish workflow for tweens WAAPI already does |
| **Sprite sheet / APNG / video** | 300 KB – MBs | ❌ | ❌ Can't react, can't theme, kills the offline budget |

**Verdict.** Hand-rigged SVG now, Rive later behind the same API. Concretely:

- The rig is inline `<svg>` markup generated by JS, so every part inherits `currentColor` /
  `var(--accent-bright)` → the mascot is correct in dark mode and in high contrast with zero
  extra assets.
- WAAPI (`element.animate()`) gives us composite layers, playback rate, cancel/finish, and
  `linear()` easing for real spring curves — all natively, no library.
- Renderer swap stays cheap because **nothing outside `src/ui/mascot/` ever touches the DOM of
  the mascot**. Surfaces only call `mascot.fire('correct', { streak: 3 })`.

---

## 3. The character

**Bürkit (Бүркіт)** — a young golden eagle. Rationale: the golden eagle is the emblem of the
steppe and of Kazakh hunting tradition, it is already the exact colour of `--accent-bright`
(#d9931a / #e3ab41), and a *chick* — big head, big eyes, oversized feet, stubby wings — hits the
baby-schema proportions that make mascots read as friendly. It also flies, which the onboarding
needs: the mascot must be able to leave the screen and come back.

**Rig parts** (each a `<g>` with an explicit `transform-origin`, animated independently):

```
root            → position, arc paths, screen-space flight
  body          → breathe, squash & stretch (never uniform)
    tailFeathers→ follow-through, +14% delay
    wingL/wingR → beat, point, cover-eyes, applaud
    feetL/feetR → hop, dangle, tap-impatient
  head          → tilt, nod, shake, look (30% of eye amplitude, 220ms lag)
    crest       → follow-through, +8% delay; the primary emotion amplifier
    eyeL/eyeR   → pupil offset (look), lid scaleY (blink), lid rotate (worried/happy)
    brows       → the entire difference between "confused" and "impressed"
    beak        → open amount (speech visemes), curve (smile/frown)
  accessories   → optional: pencil, graduation cap, tiny flag on streak milestones
```

Expression is 80 % **brows + crest + head tilt**. Build those three first; the wings are set dressing.

---

## 4. The state vocabulary (the contract)

Every surface uses these names and nothing else. Adding a state is a deliberate act.

**Continuous inputs** (blended, not switched): `mood` (−1…1), `energy` (0…1),
`gaze` (x, y), `speaking` (0…1).

**Triggers** (fire-and-forget, each with ≥3 variants):

| Trigger | Reads as | Budget |
|---|---|---|
| `enter` / `exit` | flies in on an arc / flies off screen | 700 / 500 ms |
| `idle` | breathe + blink + micro-idles | loop |
| `look` | tracks pointer / focused field | continuous |
| `think` | head tilt, crest droop, slow blink — used while the AI tutor is loading | loop |
| `hint` | leans in, wing points at the hint box | 600 ms |
| `correct` | nod → wings up → settle | 700 ms |
| `correctStreak` | escalates with `streak`: nod → hop → full flight loop | ≤1200 ms |
| `oops` | soft flinch, then points at the cause; never a frown at the user | 700 ms |
| `nearMiss` | "ooh" — wince + one wing up | 700 ms |
| `celebrate` | block complete: takeoff, confetti, gold burst | ≤1400 ms |
| `unlock` | new topic available: presents it with a wing | 900 ms |
| `proud` | level/θ up: chest out, crest full | 800 ms |
| `worried` | mastery dropped / gap detected on the graph | 600 ms |
| `sleep` / `wake` | 120 s idle → sleeps; any input → startle wake | 900 / 500 ms |
| `sad` | streak broken. Plays **once**, then immediately `offer` | 800 ms |
| `speak(text)` | beak visemes synced to `speechSynthesis` boundaries | text length |

**Priority & interruption.** Each trigger carries a priority (`ambient` < `feedback` < `event`).
A higher or equal priority trigger **cancels** the running one at its current pose (no snap:
the new animation starts from `getComputedStyle`), lower priority is dropped, never queued.
Exactly one animation may own each rig part at a time; `root`/`body` conflicts cancel, layer
animations (eyes, beak) compose.

---

## 5. Surface map — where Bürkit lives

| Screen (file) | Moment | State | Extra juice |
|---|---|---|---|
| Home `home.js` | first paint, hero | `enter` + `idle` + `look` | perches on the demo card |
| Onboarding `onboarding.js` | each field focused | `point` at the field, reacts to each choice | subject picked → mascot briefly wears its icon |
| Tour `tour.js` | every step | mascot *is* the narrator, flies between highlights | replaces the static popover arrow |
| Diagnostic `diagnostic.js` | question difficulty | `think` on hard items, `proud` on a hard item solved | difficulty telegraphed by posture |
| Learn `learn.js` | answer checked | `correct` / `nearMiss` / `oops` | button squash, particles from the button, XP flies to counter, hit-stop |
| Learn | hint requested | `hint`, wing points at the hint box | |
| Learn | 3/3 block done | `celebrate` | confetti, screen shake, summary panel slides under it |
| Learn summary | topic unlocked | `unlock` | mascot hands over the unlocked pill |
| Dashboard `dashboard.js` | arrival | `enter`, reacts to streak: `proud` / `worried` | perches next to the weakest bar |
| Graph `graph.js` | gap node focused | `worried` + points at the root cause | ties to `causeChain()` |
| Tutor `tutor.js` | awaiting API | `think` (loop) | replaces the spinner entirely |
| Tutor | answer read aloud | `speak` with visemes from `speechSynthesis` `boundary` | already have `speak()` in `dom.js` |
| Simulate `simulate.js` | scenario result | `proud` on a big delta | |
| Plan `plan.js` | exam date near | `worried` glance at the calendar | subtle, once |
| Teacher `teacher.js` | — | **absent** | teachers get data, not a cartoon |
| Shell `main.js` | offline flag flips | tiny wave from the corner | "still works" without copy |
| Any | 120 s idle | `sleep` | |

---

## 6. THE ALGORITHM — chronological build order

Each phase is shippable on its own. Do not start a phase before the previous one's *done-when*
is true. Times are hackathon-honest (one person, focused).

### Phase 0 — Decisions & guardrails · ~30 min
- **Do:** lock the character (name, palette = existing tokens only), lock the state vocabulary
  from §4 in a comment at the top of `src/ui/mascot/machine.js`, write the motion budget into
  the module header (ambient ≤ 400 ms, feedback ≤ 700 ms, celebration ≤ 1400 ms, everything
  cancelable), and add the kill switch: `settings.mascot: 'full' | 'calm' | 'off'` in
  `state.js` (`defaultState()`), defaulting to `'full'`, forced to `'calm'` when
  `prefers-reduced-motion` or `settings.reducedMotion` is on.
- **Files:** `src/state.js`, new `src/ui/mascot/` directory.
- **Done when:** `getSettings().mascot` exists and survives a reload.

### Phase 1 — The rig · ~2 h
- **Do:** `src/ui/mascot/rig.js` exports `buildRig()` → an inline SVG string (viewBox 0 0 120 140)
  with the part hierarchy from §3, every `<g>` carrying `id` + explicit
  `transform-box: fill-box; transform-origin: …` in `styles/mascot.css`. Colours: `var(--accent-bright)`
  body, `var(--text)` outlines, `var(--bg-soft)` eye whites — so dark theme is automatic.
  Also export `POSES`: static pose objects (per-part transform maps) for `happy`, `sad`,
  `think`, `wow`, `sleep`, `neutral`.
- **Check:** drop it into `pitch/` or a scratch HTML file and toggle themes.
- **Done when:** applying `POSES.happy` by hand looks like a different creature than `POSES.sad`,
  with no tweening involved. If the poses aren't expressive, nothing later will save it.

### Phase 2 — The animation engine · ~2 h
- **Do:** `src/ui/mascot/anim.js`:
  - `spring(stiffness, damping, mass)` → a `linear(...)` easing string sampled to ~24 points
    (WAAPI supports `linear()`; this is how we get overshoot without a physics library).
  - `play(partId, keyframes, opts)` wrapping `el.animate()`, tracking the running animation per
    part so a new one cancels the old **from its current computed transform** (no snapping).
  - `stagger(parts, delayFactor)` for follow-through (crest +8 %, tail +14 %).
  - `arc(from, to, height)` → keyframes along a quadratic path for flight.
  - `hitstop(ms)` → pauses all running mascot animations, then resumes.
  - Respect `document.hidden` (pause) and `mascot === 'calm'` (apply the end pose instantly).
- **Done when:** a test call makes the head overshoot and settle, and a second call mid-flight
  redirects it smoothly instead of jumping.

### Phase 3 — The state machine + public API · ~2 h
- **Do:** `src/ui/mascot/machine.js` (states, variants, priorities, interruption rules from §4)
  and `src/ui/mascot.js` — the *only* thing the rest of the app imports:
  ```js
  mascot.mount(container, { size, anchor });  // singleton; re-mount moves it
  mascot.fire('correct', { streak: 3 });      // trigger + inputs
  mascot.set({ mood: 0.6, gaze: {x, y} });    // continuous inputs
  mascot.say(text, { lang });                 // speech + visemes
  mascot.unmount();
  ```
  Variant selection: weighted random, no-repeat window of 3, seeded per session.
- **Done when:** firing `correct` five times in a row produces visibly different animations,
  and firing `celebrate` mid-`correct` cuts over cleanly.

### Phase 4 — Idle life · ~1.5 h
- **Do:** `src/ui/mascot/idle.js` — Poisson blink, breathe loop, pointer/focus gaze tracking
  (one throttled `pointermove` listener on `document`, matching the pattern already used in
  `flourish.js`), the micro-idle pool, and the 30/60/120 s boredom escalation into `sleep`.
  Pause everything on `visibilitychange` and when the mascot is scrolled out of view.
- **Done when:** you can leave the tab open for three minutes and the mascot never repeats a
  cycle identically, then falls asleep, and wakes on a keypress.

### Phase 5 — The learn loop (the money moment) · ~2.5 h
- **Do:** mount the mascot in `learn.js` beside the question panel. In `registerLearnActions`:
  - `learn-check` → compute `correct` / near-miss (chosen distractor is the misconception
    branch from `engine/tutor.js`) → `mascot.fire(...)` **after** the state update, so the
    feedback text is already on screen.
  - `learn-hint` → `mascot.fire('hint')`.
  - Block complete → `mascot.fire('celebrate')`.
  - Juice: `src/ui/juice.js` — `burst(el, {count, color})` particles (canvas-less, absolutely
    positioned divs, transforms only, removed on finish), `flyTo(from, to, text)` for the XP
    number, `squash(el)` for the answer button, `shake(el)` for big beats, 40 ms `hitstop`.
  - Wire `navigator.vibrate` here, guarded.
- **Done when:** answering correctly feels like a slot machine paying out, and answering wrong
  never feels like a scold. Verify feedback text is readable ≤100 ms after the tap.

### Phase 6 — Onboarding, mascot-led · ~2.5 h
- **Do:** `onboarding.js` — mascot flies in on an arc, greets by the name once typed, points at
  the field currently focused (`arc()` to a position derived from `getBoundingClientRect`),
  reacts to each subject/goal choice, and *leads* into the diagnostic (`exit` flight → the
  diagnostic screen enters). Rewrite `tour.js` so the mascot replaces the popover arrow and
  flies between steps; keep every existing escape hatch (Escape, skip, the "seen this visit"
  logic) untouched — a mascot must never make the tour harder to leave.
- **Done when:** a first-time user is walked from `#/` to `#/diagnostic` by the character, and
  Escape at any point leaves a clean screen with no orphaned mascot.

### Phase 7 — Diagnostic reactions · ~45 min
- **Do:** `diagnostic.js` — posture telegraphs item difficulty (`b` is already on the item),
  `proud` when a hard item is solved, encouraging pose on a miss, `think` while the next item
  is selected.
- **Done when:** the mascot's posture correlates with `item.b` without any copy.

### Phase 8 — Tutor: thinking + lip-sync · ~2 h
- **Do:** `tutor.js` — replace the loading state with `mascot.fire('think')`. Then `mascot.say()`:
  drive the beak from `SpeechSynthesisUtterance`'s
  [`boundary` event](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event)
  — on each word boundary, open the beak to an amplitude derived from the word's vowel count and
  close it over the estimated word duration. Two viseme shapes (open/round) are enough at this
  scale; do not chase real phonemes. Fall back to a generic talk-loop where `boundary` is
  unsupported (Safari), and to silent talk when `settings.tts` is off.
- **Done when:** the mascot's beak moves in time with the spoken explanation in all three
  languages, and stays shut when TTS is off.

### Phase 9 — Ambient presence everywhere else · ~2 h
- **Do:** dashboard (`proud` / `worried` by streak, perch near the weakest bar), graph
  (points at the root cause from `causeChain()`), plan (glance at the exam date), simulate
  (`proud` on a big delta), shell (wave when `online`/`offline` flips). Teacher panel: nothing.
- **Done when:** the mascot is present on every learner screen and its pose always has a
  data reason behind it.

### Phase 10 — Streaks, absence, return · ~1.5 h
- **Do:** on load, compare `profile.lastActive` → same day (`idle`), 1+ day (`enter` happy +
  a line), streak broken (`sad` **once**, then immediately `offer` the shortest possible
  session). Streak milestones (3/7/14/30) escalate the `correctStreak` celebration and add the
  tiny-flag accessory.
- **Done when:** breaking a streak produces one quiet sad beat followed by a concrete next step
  — never a guilt loop.

### Phase 11 — Sound & haptics · ~1 h
- **Do:** `src/ui/sound.js` — WebAudio oscillator cues, no audio files (keeps the offline budget
  at zero): rising major third for correct, soft low tone for wrong, arpeggio for celebrate.
  **Muted by default**, `settings.sound` toggle in the sidebar, one-tap unmute prompt after the
  first correct answer. Never autoplay audio on load.
- **Done when:** sound is off by default, on by choice, and survives a reload.

### Phase 12 — Performance & accessibility hardening · ~1.5 h
- **Do:**
  - Downgrade path: `navigator.deviceMemory < 4 || hardwareConcurrency <= 4 ||
    connection.saveData` → `mascot: 'calm'` automatically (pose swaps, no tweens, no particles).
  - `prefers-reduced-motion` → `calm`, and `motion.css`'s existing global override must not
    silently kill the mascot into invisibility — poses still apply.
  - Everything transform/opacity only. No layout properties. Cap concurrent particles at 24.
  - Pause on `document.hidden`; unmount when the mascot's screen is destroyed.
  - Screen-reader contract: the mascot layer is `aria-hidden="true"`; anything it communicates
    must exist in text elsewhere (it already does — feedback panels, toasts).
  - Measure: 60 fps on a mid Android, and the celebration must not drop a frame on the answer
    path.
- **Done when:** Lighthouse performance doesn't move, and the mascot is decorative to a
  screen reader while still expressive on screen.

### Phase 13 — i18n + offline · ~45 min
- **Do:** every mascot line goes into `src/i18n/{ru,kk,en}.js` under `mascot.*` (three variants
  per beat so the character doesn't repeat itself in text either). Add
  `src/ui/mascot/*.js`, `src/ui/juice.js`, `src/ui/sound.js`, `styles/mascot.css` to the
  `ASSETS` list in `sw.js` and bump `CACHE` to `aqyl-v12`.
- **Done when:** the mascot is fully alive with the network disabled, in all three languages.

### Phase 14 — Optional: the Rive upgrade · ~1 day + an artist
Only after everything above ships, and only if there is time and someone who can author in Rive.
- **Do:** author `burkit.riv` with a layered state machine matching §4's vocabulary exactly
  (same trigger names). Add `src/ui/mascot/renderer.rive.js` implementing the same interface as
  the SVG renderer. Self-host the WASM (`RuntimeLoader.setWasmUrl('vendor/rive-2.x.y.wasm')` —
  the version **must** match the runtime package) and add both the `.wasm` and the `.riv` to
  `sw.js`. Load it lazily *after* first paint; on any failure, timeout, or `saveData`, keep the
  SVG renderer. Dark theme needs either a second artboard or runtime colour overrides.
- **Done when:** the renderer can be switched by one flag and the app is byte-identical in
  behaviour when the switch is off.

### Phase 15 — Demo day · ~30 min
- **Do:** a 90-second script that puts the mascot in front of the judges — cold open on
  onboarding (mascot leads), one correct answer (full juice), one wrong answer (mascot points at
  the *cause*, tying into the product thesis), then kill the network and show it all still runs.
  Add a `?mascot=off` URL flag for the demo machine in case a projector chokes.

---

## 7. Rules that must not break

1. Feedback first, animation second. Never gate information behind a tween.
2. One mascot instance. One `requestAnimationFrame` loop for the whole system.
3. Every animation cancelable; input is never blocked, never queued behind a celebration.
4. `prefers-reduced-motion` / `calm` = expressive but static. Not "no mascot".
5. Transform and opacity only. Particles capped. Nothing runs in a hidden tab.
6. The mascot never expresses disappointment *in the student*. Concern about the *gap*, always.
7. The mascot's own layer is `aria-hidden`; nothing it says is only said by it.
8. `src/ui/mascot/` owns its DOM. No other module touches mascot elements.

---

## 8. Open questions for the team

- Name: **Bürkit** (bare descriptor) vs a proper name like **Aqylbek** / **Qusai**?
- Does the mascot speak in first person in all three languages, or stay silent in the teacher-
  facing parts entirely?
- Sound default: muted (my recommendation — it's a classroom) or on-with-a-prompt?
- Is there anyone who can author Rive before the deadline? If yes, Phase 14 moves earlier and
  Phases 1–2 shrink to a fallback rig only.

---

## Scroll choreography — 2026-09-03

The reveal layer was one fade-up for everything: `opacity 0 → 1`, `translateY(10px)`. That is the
most common animation on the web and therefore invisible — the eye stopped registering it around
2016. Replaced with roles, assigned in `motion.js` (`data-in`) and drawn in `motion.css`, each
derived from what the content *is*:

- **head** — the section heading *prints*: lines open bottom-to-top from under a clip, and the
  eyebrow label's letter-spacing settles from 0.36em to its normal 0.14em. A typographic gesture,
  for a typographic product, and one no template ships with.
- **card** — rises, and a gold rule draws left-to-right along its top edge. Drawn as an animated
  `background-size`, not a pseudo-element: `::after` on panels is already taken and switched off
  by the cursor-spotlight layer (`.panel.spot::after { content: none }`), so an animation there
  would simply never have existed. Note this leaves a permanent 2px accent rule on panels — a
  static design change, not only motion.
- **row** — plan weeks and risk rows slide in from the left; the list deals like cards.
- **stat** — figures rise and start counting.
- **chip** — small badges pop with overshoot. The only place overshoot belongs: the object is
  small, and without it nobody notices it arrived.
- **media** — the knowledge graph and heat map open with a wipe left-to-right, like unrolling a
  sheet. The graph's edges then draw themselves (`animateGraph`), so the two motions read as one.

Plus one **scroll-linked** (not scroll-triggered) touch: the graph SVG drifts with scroll position
via `animation-timeline: view()`, under `@supports` and `prefers-reduced-motion: no-preference`.
Content reveal is deliberately NOT built on scroll-driven animations — support is partial, and a
browser without it would show an empty page. Here, no support means the graph simply sits still.

Verified: 27 of 34 elements revealed above the fold on load, all 34 after scrolling, **zero stuck**
on any of 11 routes, no horizontal overflow, no console errors.
