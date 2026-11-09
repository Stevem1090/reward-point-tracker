# Roadmap

## Direct Gemini
- [x] Switch all seven AI edge functions to the saved Google key, preserving feature behaviour
- [x] Pace Vinted analysis starts and preserve Google quota/error messages
- [x] Run focused tests and deploy all seven functions
- [ ] Verify live Google responses — blocked by Google returning HTTP 404 from its documented Gemini endpoint; authenticated app checks are unavailable for this external Supabase project

## Vinted drafts
- [x] Replace AI writing rules and add soft review warnings
- [x] Add description-only regeneration preserving other edits
- [x] Test five supplied real listing examples with the new prompt and prepare old/new comparison
- [ ] Tone approval — waiting for user review of the five comparisons; original photos and authenticated review flow are unavailable in this external project
- [x] Phase 1 update: short descriptions, notes per item, condition rules + reason, suggested price + pricing rules, price confirmation gate
- [x] Phase 2 batch flow (Add item, background analysis max 2, batch list, Run batch with dry run, docked runner, pause/stop, 30s pause, keep-awake, stop on unknown/login/captcha, local persistence + resume, summary, 25-item cap, "Accept all suggested prices")
