# Pulse Kit

Everything a contractor needs to get their own Pulse: their CRM's numbers pulled in automatically, their own rules (so Claude answers any number exactly the way the CRM does, to the record and the penny), and their own Pulse site with rep and owner screens, a leadership scorecard, a map, POWER rankings, a weekly Speed Round, Make a graphic, Ask Claude, requests, office TV screens, and daily messages through Slack, Google Chat, Teams or email. It all runs in the client's own GitHub and Vercel accounts, and the client owns it.

Self-serve with the client's own Claude (`.claude/skills/pulse-setup/`): no terminal, the rules drafted from their own CRM data, the numbers matched with one button. Benny Fisher (Visionary Navigator, bennyfisher.com) can lead it with them for a client who wants it done with them.

**Setting one up?** Open the client's copy in Claude Code and say "Help me set up my Pulse." (The setup skill is built in: `.claude/skills/pulse-setup/`.) The same steps are written out in `docs/SETUP.md`.

## How it fits together

```
 CRM (read only)
   │  connectors/acculynx   AccuLynx scheduled reports, every 30 minutes in working hours
   │  connectors/csv        any CRM, from uploaded CSV exports
   │  connectors/jobnimbus  reserved
   ▼
 data branch   the three files in docs/DATA-CONTRACT.md + status.json
   │           (customer names, phones, emails and addresses dropped before saving: scripts/scrub.py)
   ▼
 rules/        RULES.md (the rulebook), settings.json (the exact lists), pulse_metrics.py (the math)
   │           check-rules runs on every change: FILL_INs left, names not in the data, the math end to end
   ▼
 site/pipeline/build.py   every number the site shows, from pulse_metrics.py
   │           the report ledger is proven equal to the rules on eight date ranges, or the build stops
   │           the privacy guard stops the build if a customer name shows up anywhere
   ▼
 private Vercel Blob store  ──►  site/ (Next.js): /pulse/hq leadership, /pulse/me reps, /pulse/csr setters
```

## What's where

| Folder | What |
|---|---|
| `connectors/` | One per CRM. Each lands the same files on the `data` branch |
| `docs/` | `SETUP.md` (start to finish), `DATA-CONTRACT.md` (the file shape), the Slack app manifest |
| `guides/` | Client-facing: the AccuLynx guide, the any-CRM guide, the Rules Worksheet, the Prove It checklist |
| `rules/` | The rulebook, settings and math, company-neutral, with FILL_INs |
| `scripts/` | The rules check, the data contract check, the scrubber, the map file builder |
| `site/` | The Pulse. `site/pulse.config.json` holds everything company-specific; `site/content/` the client's own content |
| `sample/` | A made-up company to prove the kit end to end, with screenshots |
| `.claude/skills/pulse-setup/` | The Claude skill that walks a client through setup, builds what they ask for, and helps when they're stuck (Claude Code loads it on its own) |
| `skill-template/` | The Claude skill that answers number questions from the rules and data |
| `.github/workflows/` | pull-acculynx, import-csv, check-rules, pulse-data, and the setup buttons: acculynx-list-schedules, start-rules, prove-it, make-map |

## Try it

```bash
bash sample/run_sample.sh
```

Runs the whole kit on the sample company and starts the site at http://localhost:3000/pulse. See `sample/README.md`.

## Ground rules

- Keys live only in GitHub secrets and Vercel environment variables, typed in by whoever owns the account. Never in email, chat or files.
- Read only on every client system.
- Customer names, phones, emails and addresses never appear anywhere: not on the data branch, not on the site, not in Slack, not in Claude's answers.
- Rules change only on github.com, by the owner. The Pulse never edits them.
