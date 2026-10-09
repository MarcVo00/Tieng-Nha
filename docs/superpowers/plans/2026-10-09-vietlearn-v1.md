# VietLearn V1 Implementation Plan (master)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Every implementer subagent must first read `docs/agents/AGENT_BRIEF.md`, then **only its own task** in the phase file below.

**Goal:** Ship the VietLearn V1 PWA (10 Southern-Vietnamese lessons, oral practice, scripted conversations, final exam, competitive leaderboard among a private circle) before 2026-11-09.

**Architecture:** React SPA (Vite) installed as a PWA, offline-first. Hexagonal layering: `features/` UI → pure `services/` → `ports/` interfaces ← `adapters/` (Dexie, Web Speech, Supabase, static JSON content). Progress is an append-only event log synced to Supabase through an idempotent outbox; Postgres triggers maintain a leaderboard projection.

**Tech Stack:** Vite 5, React 18, TypeScript 5.6 strict, Tailwind 3.4 (token-only palette), motion 11, React Router 6.26, Zustand 5, Dexie 4, Supabase JS 2.45, Zod 3.23, Vitest 2, Testing Library, Playwright 1.48, ESLint 9 + eslint-plugin-boundaries.

**Spec:** `docs/superpowers/specs/2026-10-09-vietlearn-design.md` (the plan argues from the spec — read the cited sections).

## Global Constraints

- Node 20 LTS, npm. Dependencies limited to spec §1; install with the exact ranges listed there.
- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any`, no `enum`, no `@ts-ignore`.
- Import alias `@/` → `src/`; never `../../`.
- Components never import `src/adapters/**`; services are pure (inject `now`/`rng`); boundaries enforced by ESLint (ADR 0007).
- UI strings only in `src/i18n/fr.ts` (French, tutoiement). Code/comments/commits in English.
- Colors/radii/shadows/durations only from tokens (`docs/design-system.md`); Tailwind default palette disabled. Animate only `transform`/`opacity`.
- Vietnamese text: Unicode NFC everywhere; `lang="vi"` on rendered Vietnamese.
- Calendar days computed in `Europe/Paris` via `src/services/time.ts`.
- XP table (spec §4.2): lesson first 10 (+5 perfect), replay 3, review 2/word max 40, dialogue first 15 / replay 3, exam = delta over best score; cap 200 XP per Paris day.
- Exam: 30 questions (10 listening, 8 translation, 6 tones, 6 speaking), 3 attempts per Paris day (server-enforced), pass ≥ 70.
- `npm run verify` green before any task is done. TDD for `services/` and `grade.ts`.
- **Git: commit as the local git user only. Never add `Co-Authored-By` trailers or "Generated with Claude" lines.**

---

## Phase files

| Phase | File | Tasks |
|---|---|---|
| 0 Foundation | [v1/phase-0-foundation.md](v1/phase-0-foundation.md) | T01 scaffold & tooling · T02 domain types, content schemas, validator · T03 ports, fakes, container |
| 1 Services | [v1/phase-1-services.md](v1/phase-1-services.md) | T04 time & random · T05 XP, streak, progress projection · T06 Leitner & review builder · T07 badges & ActivityService · T08 pronunciation · T09 exam draw · T10 SyncService |
| 2 Adapters | [v1/phase-2-adapters.md](v1/phase-2-adapters.md) | T11 Dexie · T12 speech · T13 static content & scripted conversation · T14 Supabase schema + pgTAP · T15 Supabase adapters |
| 3 UI | [v1/phase-3-ui.md](v1/phase-3-ui.md) | T16 UI primitives & motion · T17 app shell · T18 choice plugins + registry · T19 tone & word-order plugins · T20 speak plugin · T21 onboarding · T22 home path · T23 lesson player · T24 review · T25 conversation · T26 exam & certificate · T27 leaderboard & public profile · T28 me/settings/report |
| 4 Content | [v1/phase-4-content.md](v1/phase-4-content.md) | T29 lessons l01–l05 · T30 lessons l06–l10 · T31 dialogues d01–d10 · T32 exam pool |
| 5 Release | [v1/phase-5-release.md](v1/phase-5-release.md) | T33 E2E · T34 CI, Lighthouse, keepalive · T35 deployment runbook · T36 device QA |

## Dependency graph and parallel lanes

```
T01 ──► T02 ──► T03 ─┬─► Services lane:  T04 ─► {T05, T06, T08, T09} ─► T07 ─► T10
                     │
                     ├─► Adapters lane:  {T11, T12, T13, T14} ;  T14 ─► T15
                     │
                     └─► UI lane:        T16 ─► T17 ─► {T18, T19} ; T08+T16 ─► T20
                                          then features (need services + adapters + plugins):
                                          T21 (T15,T17) · T22 (T07,T17) · T23 (T07,T18–T20) ·
                                          T24 (T06,T23) · T25 (T13,T17,T08) · T26 (T09,T15,T23) ·
                                          T27 (T15,T17) · T28 (T15,T17,T21,T26)
T02 ──► Content lane (independent of code): T29, T30, T31 (parallel) ─► T32
All ──► T33 ─► T34 ─► T35 ─► T36
```

**Suggested schedule (≈ 4 weeks, deadline 2026-11-09):**
| Week | Work |
|---|---|
| 1 (Oct 10–16) | T01–T03 sequential; then services lane + adapters lane + T16 + content lane in parallel |
| 2 (Oct 17–23) | T17–T20, T21–T23 |
| 3 (Oct 24–30) | T24–T28, T32 |
| 4 (Oct 31–Nov 6) | T33–T36, bug fixes, deploy, real-device testing |

**Parallelism rules for the orchestrator:**
- Never run two tasks that list the same file under **Files** at the same time.
- Shared files that only grow (`src/i18n/fr.ts`, `src/app/router.tsx`, `src/exercises/registry.ts`): each task appends in its own clearly delimited block (`// --- <feature> ---`); the orchestrator merges sequentially if worktrees conflict.
- Content tasks (T29–T32) only touch `src/content/**` and may run any time after T02.

## Human prerequisites (Marc)
Before T14/T15: install Docker Desktop (for `npx supabase start`) — or skip local SQL tests and run them in CI only.
Before T35: GitHub account + repo, Supabase account (2 free projects), Netlify account. Steps are in T35.

## Review protocol (subagent-driven)
After each task: (1) spec-compliance review against the task's acceptance criteria; (2) code-quality review against `docs/conventions.md`; (3) for UI tasks, design review against `.claude/skills/vietlearn-design/references/review-checklist.md`. Reject → same implementer fixes → re-review.
