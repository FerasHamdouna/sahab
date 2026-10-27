# Sahab — instructions for AI assistants

Weather website with a live 3D background that reflects the searched city's weather.

## Read first
- `docs/PRD.md` — scope, goals, non-goals
- `docs/SCENES.md` — 3D scene spec (the core of the product)
- `docs/API_CONTRACT.md` — the normalized data shape; frontend and backend both conform to it
- `docs/TECH_STACK.md` — decisions and the "zero-delay background" architecture
- `docs/ROADMAP.md` — current phase and done criteria

## Working agreements
- Phase order is fixed: docs → UI/UX → frontend + 3D → backend. Don't start backend work until the user approves the frontend.
- The user communicates in Arabic (Levantine). Reply in Arabic; keep code, identifiers, and commit messages in English.
- UI is Arabic-first (RTL) with English support. Use logical CSS properties (`ms-`, `pe-`, `start`, `end`), never `left`/`right` for layout.

## 3D rules (non-negotiable)
- One persistent `<Canvas>`; never unmount or remount it on data changes.
- Weather changes only update a target `SceneState` in Zustand; `useFrame` damps current values toward it. No React re-render drives the scene.
- No `setState` and no object allocation (`new Vector3`, `new Color`, ...) inside `useFrame`.
- All layers' materials are pre-compiled at startup (`gl.compile`) so the first rain/snow never hitches.
- Particles move in the vertex shader; CPU does not iterate particles per frame.
- Respect the quality tiers and budgets in `docs/SCENES.md` §6, and `prefers-reduced-motion`.
- `weatherToSceneState` and WMO mapping are pure functions with unit tests.

## Backend (`backend/`, Node + Express 5 + PostgreSQL)
- `npm run dev` (tsx watch, :8080) · `npm test` (vitest + supertest, fake provider, no network/DB) · `npm run typecheck` · `npm run migrate`
- Config in `backend/.env` (never commit it). Without a reachable `DATABASE_URL` the server runs on the in-memory cache; never make the API fail because of the cache.
- `backend/src/contract.ts` mirrors `frontend/src/data/types.ts`; change both together and update docs/API_CONTRACT.md.
- Migrations are append-only entries in `src/db/migrations.ts`, applied at startup.

## Commands (run in `frontend/`)
- `npm run dev` — dev server on :5173 (`?debug` review panel, `?mock` demo fixtures)
- `npm run serve` — production build + preview on :4173 (judge performance here, not in dev)
- `npm test` — vitest unit tests · `npm run typecheck` · `npm run build`

## Reload behaviour (don't regress)
- The last sky (`sahab.scene`), city (`sahab.last`) and weather response (`sahab.wx`) are cached in localStorage; index.html paints the cached sky as a CSS gradient before JS runs.
- The canvas stays at opacity 0 with the render loop paused until `compileAsync` finishes and a real target exists, then snaps to it and fades in. Never show a default/placeholder sky.
- Quality is fixed on `low` (DPR 1, vignette, no bloom) by the user's choice; there is no automatic quality switching, because re-sizing the canvas mid-session caused visible hitches. Rain (16k) and snow (7k) stay at full density on every tier. Don't reintroduce adaptive quality without asking.

## Mobile (don't regress)
- The fixed sky container is sized `height: 100lvh` (not `inset: 0`), the page uses `100svh` (not `dvh`), and the Canvas has `resize={{ scroll: false, debounce }}`. Anything that lets the canvas size follow the mobile address bar re-renders the scene on every scroll (visible jump/flash).
- Audio is created/resumed only inside activation gestures (pointerup/touchend/click/keydown), never on mount or touch pointerdown.
- Nothing may extend past the 16px page gutter: in RTL any left overflow becomes a sideways scroll of the whole page.

## Shader conventions
- Every scene material spreads the shared `U` uniforms from `src/scene/uniforms.ts`; `stepScene` is the only writer.
- Fragment shaders compute in **linear** color and end with `#include <colorspace_fragment>` (works with and without the postprocessing composer). Dark tones must be very small linear values (0.01–0.03), or they render as mid-gray.

## Data
- Frontend codes against `src/data/types.ts` (mirrors `docs/API_CONTRACT.md`). Default provider is the backend (`/api/v1`, proxied by Vite); `VITE_DATA_SOURCE=open-meteo` calls Open-Meteo directly; `?mock` uses fixtures.
- Times in payloads are city-local (no `Z`); only `meta.fetchedAt` is UTC.
