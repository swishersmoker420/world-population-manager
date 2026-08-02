# World Population Manager

A SillyTavern extension for maintaining a per-chat, AI-generated NPC population,
built on top of SillyTavern's lorebook system.

**Status: Stage 1 (bare minimum) — drawer only, no features yet.**

## Installation

1. Open SillyTavern
2. Extensions → Install Extension
3. Paste the GitHub URL for this repo (or copy this folder into
   `data/default-user/extensions/world-population-manager` / your
   `scripts/extensions/third-party/world-population-manager` path, depending
   on your SillyTavern version)
4. Refresh the page

## Testing Stage 1

Look for "World Population Manager" in Extensions settings (right panel).
You should see a drawer that expands to show a success message. Check the
browser console (F12) for `[world-population-manager]` log lines.

## Roadmap (built one stage at a time)

- [x] Stage 1: Drawer appears
- [ ] Stage 2: Basic settings (enabled toggle)
- [ ] Stage 3: "Generate Characters" button + generation window (count + instructions)
- [ ] Stage 4: Character card + chat history + activated-lorebook context gathering
- [ ] Stage 5: NPC generation → lorebook entry creation (using the character template)
- [ ] Stage 6: NPC Index (name/role/summary) + persistence per chat
- [ ] Stage 7: NPC management UI (search, list, view/edit/delete/duplicate/lock)
- [ ] Stage 8: Regeneration of selected NPCs only
- [ ] Stage 9: Multi-stage scene pipeline (scene analysis → NPC director → injection)
- [ ] Stage 10: Large-population performance passes
