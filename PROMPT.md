# Session Intro Prompt

Copy-paste the following at the start of every new LLM session working on this project:

---

## RULES AND CONTEXT

I'm working on a browser-based 3D open-world exploration/eerie game called **Nature Walk**, built with Three.js (no framework, no build step). The codebase lives at `/Users/samernajjar/Desktop/aziz/nature-walk-game/`.

**Before doing anything**, read the file `CODEBASE.md` in the project root. It describes the purpose of every file, what functions live where, how systems connect, and a quick-change reference table. Use it to identify which specific file(s) you need to read before making any change — do not read the entire codebase speculatively (it's quite large).

**Workflow:**
1. Read `CODEBASE.md` to find the relevant file(s) for the task
2. Read only those file(s)
3. Make the change
4. If the change touches shared state or crosses file boundaries, also check `js/state.js` for the relevant variable

**Key facts:**
- Entry point is `index.html` (HTML + CSS + script loading order)
- All JS is in `js/` — 21 files, loaded as plain `<script>` tags sharing global scope (no ES modules)
- `js/constants.js` — debug flags and timing constants (toggle `DEBUG_*` flags here for testing)
- `js/state.js` — all mutable global variables (add new state here)
- `js/main.js` — `init()`, `update()`, `animate()` — the game loop
- Vendor library: `vendor/three.min.js` (Three.js r134, do not touch)

**General Guidelines:**
- Always use best software engineering practices.
- I care more about minimal, targeted fixes rather than broad rewrites.
- If you change code, keep the patch narrow and avoid breaking unrelated systems.
- Preserve existing gameplay feel unless I explicitly ask for behavioral changes.

---

## REQUEST

...
