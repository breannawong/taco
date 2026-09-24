# Taco

Taco is a shared list app for a two-person household (Dustin and Brea), built first for packing lists. It replaces Google Keep. "Add it to Taco!"

This file is the source of truth for what Taco is and how we work. Read it before every task. `reference/prototype.html` is a working clickable prototype: match its look, layout, wording, and interactions. Ignore its storage code (`claude.use`, `db`); that was specific to where the prototype ran.

## Who's building this

Dustin is building Taco as his first app and is new to code. His wife Brea is a frontend developer who reviews occasionally. So:

- Work in small steps. Finish one build-plan step, make sure it runs, then stop.
- After each step, explain in plain English what you changed and why (a few sentences, no jargon dumps), and tell Dustin exactly how to see it working.
- Remind him to commit when something works, with a suggested commit message.
- Don't add a library without saying what it's for and asking first.
- Don't rewrite or "clean up" code unrelated to the current task.
- If something is ambiguous, ask a short question instead of guessing big.
- When fixing an error, explain what caused it in one or two sentences.

## Core ideas (get these right, everything else layers on)

1. **Templates vs. trips.** A template is the master list (e.g. "Hiking Packing List"). It never gets checked off. Starting a pack makes a trip: a fresh copy of the template with nothing checked. No more "uncheck all."
2. **Trip-only items.** Items added to a trip are marked `tripOnly` and show a "This trip" tag. They can be promoted to the template (one at a time, or all at once from the trip menu). Editing a trip never changes its template.
3. **Who packs it.** Every item has `who`:
   - `shared`: one check covers the household (tent, stove, first aid). Done when anyone checks it. Shown as a square checkbox. The row says who packed it.
   - `each`: everyone packs their own (boots, headlamp). One circle per person with their initial. Done only when everyone has checked.
   - a person id (`dustin` / `brea`): only that person packs it. One circle.
   The current user's circle is solid-outlined; the other person's is dashed.
4. **Checks belong to a person, not an item.** Store checks as separate records `{ listId, itemId, personId }`. "Done" is computed from those, never stored.
5. **Sections, not indentation.** Items live in ordered sections (Clothing, On the trail, ...). Sections collapse. Items and sections can be reordered.
6. **"Packing as."** The app knows which person is using it. Until real logins exist (stage 3), it's a picker on first launch, remembered on the device, with a tap-to-switch circle in the header.

## Data model

Keep it flat and relational. It maps directly onto Supabase tables in stage 3.

```ts
type PersonId = string;            // 'dustin' | 'brea' for now
type Who = 'shared' | 'each' | PersonId;

interface Person  { id: PersonId; name: string; initial: string; color: string }
interface List    { id: string; name: string; kind: 'template' | 'trip'; templateId?: string; createdAt: number }
interface Section { id: string; listId: string; name: string; position: number }
interface Item    { id: string; listId: string; sectionId: string; text: string; who: Who; position: number; tripOnly?: boolean }
interface Check   { listId: string; itemId: string; personId: PersonId; checkedAt: number }
```

Rules:
- `owes(item, person)`: true if `who` is `shared`, `each`, or that person.
- Item done: `shared` → any check exists; `each` → every person checked; person → that person checked.
- Done for a person: `shared` → item done; otherwise → that person's check exists.
- Starting a trip copies sections and items (new ids for the trip's rows, keep a pointer so promotion can find the template's matching section). Checks start empty.

All reads and writes go through one module, `src/store/`. Components never touch localStorage (or later Supabase) directly. This is what makes stage 3 a swap instead of a rewrite.

## Screens

- **Home:** "Packing now" trip cards (name, "x of y items packed", a progress bar per person), a Templates list, "Start a pack" and "New template" buttons.
- **List (trip):** sticky header (back, eyebrow "Trip · from <template>", name, person circle, ⋯ menu). Summary "N of M items fully packed" + per-person bars. Filter: Everything / Still to pack / Mine to pack. Small legend. Sections with "done/total" counts, collapse chevron, ⋯ to edit. "+ Add to <section>" row at the end of each section. "New section" at the bottom. When a filter empties out, show "All packed" / "You're packed".
- **List (template):** same layout, no checks or filters; the who-shapes are shown as static previews.
- **Bottom sheets** for: add/edit item (text, who-packs-it picker with a one-line hint, section, move, delete, "Add to <template>" for trip-only items), edit/new section, start a pack (template picker + name defaulting to "Hiking · Sep 2026"), new template, list menu (rename, promote trip-only items, uncheck everything, delete).
- **Destructive actions** use a two-tap confirm in the button itself ("Tap again to delete"), never `window.confirm`.
- Adding items keeps the sheet open with the input focused, for fast entry.

## Design

Mobile first (iPhone, one hand), max content width 560px, 16px side gutters, tap targets at least 40px. Respect iPhone safe areas. Support light and dark mode via CSS variables.

Fonts (Google Fonts): **Bricolage Grotesque** 600/800 for headings and the wordmark; **Atkinson Hyperlegible** 400/700 for everything else.

| Token | Light | Dark |
|---|---|---|
| --bg | #F2F4EE | #0F1411 |
| --surface | #FFFFFF | #18201B |
| --surface-2 | #E6EBE2 | #222B25 |
| --ink | #1B2620 | #E6ECE5 |
| --ink-2 | #5A675F | #9AA89E |
| --line | #D5DCD1 | #2D3731 |
| --accent (marigold, primary buttons) | #EBA21C | #F0B43A |
| --pine (shared checks) | #2E5E47 | #72B592 |
| --dustin | #17767D | #52BAC1 |
| --brea | #A8406F | #E284B1 |
| --danger | #B42A1F | #F2877E |

Section headers sit on a 2px ink rule. Checked rows get muted, struck-through text. Keep the taco logo from the prototype.

## Tech stack

- React + TypeScript + Vite
- Plain CSS with the variables above (one global stylesheet plus per-component CSS files is fine). No UI kit.
- Stage 2 storage: localStorage via `src/store/`.
- Stage 3: Supabase (auth with email + password via `signInWithPassword`; accounts created in the dashboard, no in-app sign-up; session persisted so phones stay logged in; Postgres tables matching the model; realtime for checks). Deploy on Netlify.
- Installed on iPhone as a PWA (manifest, icons, `apple-mobile-web-app-capable`, standalone display).

## Build plan

Do one step per request, then stop and report.

1. **Scaffold.** Check that Node and Git are installed (tell Dustin how to install if not). Create the Vite React TS app in this folder, `git init`, a `.gitignore`, global CSS with the tokens and fonts, and an empty Home screen with the header and logo. Explain how to run it (`npm run dev`) and open it on his phone over Wi-Fi.
2. **Data layer.** Types, `src/store/` with localStorage persistence, the computed helpers (owes, isDone, doneFor, progress), and seed data: a "Hiking Packing List" template and a "Utah · Sep 2026" trip copied from it (copy the items from the prototype). Add a small "Reset sample data" option somewhere unobtrusive for testing.
3. **Home screen**, fully working with trip cards and templates, plus the "Packing as" first-launch picker and switcher.
4. **Trip screen:** sections, rows, all three check types, summary bars, filters, collapse, legend, "All packed" states.
5. **Editing:** item sheet (add/edit/delete/move/change section), section sheet, list menu.
6. **Templates flow:** start a pack, new template, trip-only tags, promote to template.
7. **Drag to reorder** items within and between sections, and sections themselves (ask before adding a library; dnd-kit is the likely choice). Keep the Move up/down buttons as a fallback.
8. **PWA:** manifest, app icons from the taco logo, standalone mode, safe areas. Test "Add to Home Screen" on iPhone.

Stage 3 (Supabase, logins, a shared household, realtime sync, Netlify deploy) comes after step 8 and gets its own plan below.

## Stage 3 build plan

Do one step per request, then stop and report. Host the frontend on **Netlify** (not Vercel). Repo lives on Breanna’s GitHub.

1. **Schema + project skeleton.** SQL migration matching the flat data model; `.env.example`; Stage 3 notes. (No app library yet until we ask.)
2. **GitHub + empty Supabase project.** Push `main` to Breanna’s GitHub; create a Supabase project; run the migration; create Dustin and Brea users in the Auth dashboard (email + password).
3. **Supabase client + auth UI.** `@supabase/supabase-js` for talking to the project. Sign-in screen with email + password (`signInWithPassword` only — no sign-up). Persist the session so the PWA stays logged in. Map each login to a household member (`dustin` / `brea`) via `profiles`.
4. **Wire reads/writes through Supabase.** Swap `src/store/` persistence (localStorage becomes fallback or dev-only); keep components talking only to the store.
5. **Realtime checks.** Subscribe so both phones see pack/unpack live.
6. **Netlify deploy.** Connect the GitHub repo; build `npm run build`, publish `dist`; set env vars; both Add to Home Screen from the HTTPS URL.
7. **Household invite polish.** How the second person joins the same household cleanly.

## Later ideas (don't build yet)

Grocery-style ongoing lists (checked items sink or disappear), quantities, notes on items, trip history and archive, offline support, import from CSV/Sheets/Keep.
