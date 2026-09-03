# Aqyl — recap of session d8122e76 (23–27 Aug 2026), recovered 27 Aug

Transcript: `~/.claude/projects/-Users-ansar-Documents-Hackathon-1-5mil/d8122e76-*.jsonl`
Session ended abruptly: "You've hit your session limit · resets 10:30pm (Asia/Almaty)".

## Project
Aqyl — offline-first adaptive learning platform for Kazakhstan (repo `sulaakula08/Aqyl`,
push access, no admin). Static site, ES modules, service worker, trilingual (kk/ru/en).
Engine: `src/engine/` — BKT mastery, Elo, prerequisite graph, planner, recommender.
Deployed on Vercel as project **aqylo** (link in `Aqyl/.vercel`).

## Done before the cutoff
- Cloned repo, UI/layout polish, trilingual i18n → PR #1 merged to main (238edd8).
- 18-slide pitch deck (`pitch/deck.html`, also an Artifact "AQYL Pitch Deck",
  https://claude.ai/code/artifact/64cc34db-4fbd-4172-9b98-c73a67a3cd57) + PDF.
  Slide 11 = offline/zero-marginal-cost moat. Slide 16 = honest "what's real vs demo".
- Vercel deploy sorted out (root-directory case-sensitivity trap: deploy from *inside* `Aqyl/`).
- **AI tutor** `api/tutor.mjs` — serverless Gemini proxy. Key lives ONLY in `.env.local`
  + Vercel env var `GEMINI_API_KEY`; never in client code. Model `gemini-flash-latest`
  (`gemini-2.0-flash` is retired). Returns structured JSON (text + intent + ≤3 action buttons).
  Socratic refusal verified across kk/ru/en; fixed nested-JSON + token-truncation bug.
- **Killer feature** `src/engine/simulate.js` — "what if" simulator on the existing
  BKT/Elo/graph, fully on-device. First version contradicted the product thesis; fixed by
  applying the already-documented ceiling rule (topic ≤ min(prereqs) + 0.2).
  Result: root-cause beats symptom by 2.1× (3.15× on weak foundations).

## Uncommitted at cutoff
`.gitignore` (M), `.env.example`, `.vercelignore`, `api/`, `pitch/deck.html`,
`src/engine/simulate.js`, `vercel.json` — all untracked/unstaged on `main`.

## Still to do (user's list, 27 Aug)
Supabase + Google auth · smooth animations · fix rough edges so it reads as a real
commercial ed product · sidebar · dark theme · onboarding tutorial animation ·
intro/landing page · UI for the simulator.
Architecture decision: core (graph, BKT, Elo, diagnostics) stays fully offline;
Supabase = auth + sync only; AI = optional layer. Protects the slide-11 moat.

**Declined:** fake student testimonials. Fabricated evidence on a public site, and it
torpedoes the slide-16 honesty framing. Offered instead: labelled composite demo personas,
or real quotes with real names.

## Case requirements (Social Impact track) — screenshots in this folder
Required modules: A/B profile (grade, subject, goal) + short diagnostic ·
C adaptive recommendations + difficulty adaptation · D student dashboard (progress,
weak spots, deadlines) · E ≥2–3 modules with tasks/mini-tests + feedback ·
F teacher/admin panel (class stats, add topics/tasks).
Bonus: AI chat, multilingual, gamification, reminders, mobile-friendly, TTS/accessibility,
roadmap builder.
Scoring online /100: problem 20 · innovation 25 · AI use 20 · feasibility 15 · prototype 10 · pitch 10.
Final /50: live MVP demo 10 · technical Q&A 10 · UI/UX 10 · scalability/monetization 10 · pitch 10.
Format: 7 min pitch + live MVP demo → 3 min Q&A.
