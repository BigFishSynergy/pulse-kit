# Pulse Kit setup, start to finish

This takes a contractor from nothing to their own live Pulse: their CRM's numbers pulled automatically, their own rules (so Claude answers any number exactly the way the CRM does), and their own Pulse site with rep and owner screens and daily Slack posts. Everything runs in the client's own GitHub, Vercel and Slack accounts. The client owns all of it.

Nobody needs a terminal, and nobody needs to be technical. The client's own Claude does the technical parts with the Pulse setup skill, and the two parts people worry about, the rules and matching the numbers, start from the client's own data. Benny can still lead them for a client who wants that done with them.

## The easiest way: let Claude walk you through it

Add the skill in `setup-skill/SKILL.md` to the client's own Claude (Customize, Skills, upload it; or put the folder in `.claude/skills/` of their repo for Claude Code), then say:

> Help me set up my Pulse.

It reads these docs, keeps a progress file in the repo so any later chat picks up where the last one stopped, does the technical steps itself when it can, and never asks for a key in the chat. Claude Code (the Code tab in the Claude desktop app) can do the most for them: it edits the files and presses the GitHub buttons. In a plain chat, it tells them exactly what to click.

The steps below are the same walk-through, written out.

## Before you start

| Who | Brings |
|---|---|
| The client's owner or admin | A GitHub account (an organization is best, free is fine), a Vercel account (Pro, $20 a month, because a business site needs it and the hourly notices need Pro's cron jobs), admin access to their CRM, and their Slack workspace if they want Slack posts |
| Benny | Access to the kit. Optional: leading the rules and the number matching with them |
| Optional | An Anthropic API key in the client's own Claude Console (Ask Claude, Make a graphic, coaching cards, Speed Round), a Google account for a goals sheet, Windsor.ai for ad spend |

**Security, always:** keys, tokens and passwords go only into GitHub secrets or Vercel environment variables, typed in by the person who owns that account. Never in email, chat, a text, or any file. Everything reads the CRM only; nothing ever writes to it. Customer names, phones, emails and addresses never get saved (the connectors drop them) and never show on the site (the build stops if one slips through).

## 1. Make the client's copy

1. Benny gives the client's GitHub account read access to the kit (or sends them the kit link if it's public).
2. On the kit's GitHub page, the client clicks **Use this template**, Create a new repository, picks their organization, names it `pulse`, picks **Private**, and creates it.

3. In the client's repo: Settings, Actions, General, Workflow permissions: **Read and write**. Save.
4. Settings, Secrets and variables, Actions, Variables tab: add `CRM_CONNECTOR` = `acculynx` (or `csv`).

Their copy is theirs from the start: nothing in it points back at the kit.

## 2. Connect the CRM

- **AccuLynx:** follow `guides/acculynx-guide.md` with the client. Their admin makes the API key and saves it as the repo secret `ACCULYNX_API_KEY` themselves. Build the three reports with the exact columns, schedule them, then run **Actions, acculynx-list-schedules, Run workflow** and put the IDs it prints in the repo variable `ACCULYNX_SCHEDULES` (`id1:Morning,id2:Afternoon`).
- **Any other CRM:** follow `guides/any-crm-guide.md`. Export the three reports as CSV, fill in `connectors/csv/mapping.json` together (this is part of the rules session), and upload the exports to the `imports` branch.
- **JobNimbus:** the connector is reserved (`connectors/jobnimbus/README.md`). Until it ships, use the CSV route.

## 3. GitHub secrets and variables

Settings, Secrets and variables, Actions. Names only here; the values are typed in by the account owner.

| Name | Kind | Needed for |
|---|---|---|
| `CRM_CONNECTOR` | variable | Always. `acculynx` or `csv` |
| `ACCULYNX_API_KEY` | secret | AccuLynx |
| `ACCULYNX_SCHEDULES` | variable | AccuLynx |
| `BLOB_READ_WRITE_TOKEN` | secret | Always, after step 10. Same value as the one Vercel adds to the project |
| `ANTHROPIC_API_KEY` | secret | Optional. Monday coaching cards and the Speed Round |
| `GOOGLE_SA_JSON` | secret | Optional. Only if goals or spend come from a Google Sheet |
| `WINDSOR_API_KEY` | secret | Optional. Ad spend and Google reviews |
| `RULES_REPO` | variable | Optional. Only if the rules live in a different repo |
| `RULES_REPO_TOKEN` | secret | Optional. Read-only token for that other repo |

**Actions minutes:** GitHub Free gives a private repo 2,000 minutes a month. The kit is set up to stay under that: the AccuLynx pull runs every 30 minutes from about 6 AM to 6 PM Central (`pull-acculynx.yml`, change the hours for other time zones), and the Pulse build only runs when new data lands, plus a check every 3 hours. If the client wants pulls every 15 minutes, they need GitHub Team or a paid minutes budget.

## 4. First pull

1. Actions, **pull-acculynx** (or **import-csv** after the first upload), Run workflow.
2. When it is green, switch to the `data` branch: you should see `data/job_export_raw_latest.csv`, `data/Revenue_In_Progress_latest.csv`, `data/job_expenses_latest.csv` (optional) and `data/status.json`.
3. The run already checked the files against `docs/DATA-CONTRACT.md`. If it went red, the log says which column is missing. Fix the report in the CRM (or the mapping) and run it again.

## 5. The company settings

`site/pulse.config.json` is the one file with everything company-specific about the site. Every field has a note; the FILL_IN notes are the ones to change.

- **company:** name, short name, what to call the Pulse, the live address, one line on what they do and where.
- **brand:** logos go in `site/public/pulse/brand/` (a logo for light backgrounds, one for the dark header, a small mark). Colors: `primary` is the header band and main accent, `accent` the chips. The neutral navy and gold default works if they have no brand yet. Optional: a 1200 x 630 `site/public/pulse/og.png` for link previews.
- **crm:** the CRM's name and the connector.
- **timezone:** same as `rules/settings.json`.
- **people:** leadership names, titles and initials (the initials match the scorecard owners), nicknames for reps, and the admin login (gets the automatic DMs and the Post to Slack page).
- **pages:** switch any page off. A page that is off disappears from the menus and returns a 404.
- **slack:** channel names. **goals:** `file` or `sheet`. **map:** the service area. **pipeline:** the self-gen source name, at-risk statuses, the main trade word.

Optional content the client supplies: `site/content/speed-round.md` (what the weekly Speed Round asks about: their core values, sales process, products; the sample shows the format) and their own music for the soundtrack (off by default; only music they have the rights to).

## 6. The service area map

Make `site/content/zips.csv` on github.com (Add file, Create new file) with one line per zip: `zip,town,region`. Use region `OUT` for zips they get leads from but do not serve; those show as one gray block, left out of colors and rankings. Then Actions, **make-map**, Run workflow. It builds `site/content/zips.json` and `site/public/pulse/zips.geojson` from the U.S. Census (2020 zip areas, public data). With a free Census API key in the repo secret `CENSUS_API_KEY`, it also adds owned homes, home values, home age and income by zip. Set `map.center` and `map.zoom` in `pulse.config.json` to frame the area.

## 7. Goals

- **File (simplest):** edit `site/content/goals.json`, one block per quarter, each metric with its quarter goal, weekly goal and owner initials.
- **Google Sheet:** tabs `Q1` to `Q4`, columns Metric, Quarter goal, Weekly goal, Actual, (anything), Owner. Put the sheet id in `rules/settings.json` (`goals.sheet_id`), set `goals.source` to `sheet`, share the sheet as Viewer with a Google service account, and save that account's key as the `GOOGLE_SA_JSON` secret.

Net Profit and 5-star reviews are not in the CRM; they go in the Actual column.

## 8. The rules, from their own data

1. Actions, **start-rules**, Run workflow (type REPLACE). It drafts `rules/settings.json` and `rules/RULES.md` from their real CRM data with the starting defaults (the roster from who's been running appointments, former reps, dead reasons, work types, the main trade, the job number prefix), and writes `rules/STARTING-RULES.md`: one plain question per decision for the owner. check-rules runs after it and should be green.
2. Go down `rules/STARTING-RULES.md` with the owner. Most answers are "yes, that's right". When one changes a rule, change `rules/settings.json` (exact names from the data) or the wording in `rules/RULES.md`, and let check-rules run. The setup skill does this as a conversation.
3. `guides/rules-worksheet.md` explains every decision and its default, for anything the owner wants to think through. Keeping the default is always fine; the Pulse can go live on the defaults and be tuned later.

## 9. Match the numbers

Actions, **prove-it**, Run workflow, with the first and last day of the last full quarter. The run's summary lists every number on `guides/prove-it-checklist.md`, counted with the rules. The owner reads each matching number off the CRM's own report. When a line is off, run prove-it again with `list` set to that line (for example `sales`) to get the job numbers the rules counted, compare them with the CRM report's job list, and fix the rule or the setting that explains the difference, never the number. When every line matches, record the numbers in `rules/RULES.md` section 10. From then on, any rule change has to reproduce them.

## 10. The Vercel project and Blob store

In the client's own Vercel account:

1. Add New, Project, import their `pulse` repo. **Root Directory: `site`.** Framework: Next.js. Deploy (it shows "Waiting for the first data pull" until step 10.4).
2. Storage, Create, **Blob**, private, name it `pulse-data`, and connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` to the project.
3. Copy that same token into the GitHub secret `BLOB_READ_WRITE_TOKEN` (the client does this; Vercel shows it under the store's settings).
4. Actions, **pulse-data**, Run workflow. It builds the numbers (stopping if the report ledger does not match the rules, or if any customer name shows up), uploads them to Blob and saves a copy on the `pulse-data` branch.
5. Environment variables (Production), typed in by the client:

| Name | What |
|---|---|
| `PULSE_SESSION_SECRET` | 32+ random characters. Signs login cookies. Changing it logs everyone out |
| `PULSE_SETUP_CODE` | A code they make up (8 or more characters) to create the first login on `/pulse/setup` (step 11) |
| `BLOB_READ_WRITE_TOKEN` | Added by Vercel in step 2 |
| `CRON_SECRET` | Random characters. Vercel sends it to the cron jobs in `site/vercel.json` |
| `ANTHROPIC_API_KEY` | Optional. Ask Claude and Make a graphic. Set a monthly spend limit in the Claude Console |
| `PULSE_ASK_REPS` | Optional. `on` gives reps Ask Claude and graphics on their own numbers |
| `NEXT_PUBLIC_MAPTILER_KEY` | Optional. A satellite map |
| `PULSE_SLACK_BOT_TOKEN`, `PULSE_SLACK_NOTIFY_USER`, `PULSE_SLACK_CHANNELS` | Step 12 |

6. Domains: add their address (for example `pulse.theircompany.com`) and put it in `pulse.config.json` `company.site_url`. Redeploy.

## 11. Logins

1. Open `https://<their site>/pulse`. A brand new Pulse goes straight to the Welcome page: the setup code from step 10, the admin's name and a password. That makes the admin login (`people.admin` in `pulse.config.json`). The page stops working once any login exists.
2. In the menu, **People**: add each person, pick their role and whose numbers they see, and send each person their own sign-in link directly (by text, to them only). Links and passwords show once; **New link** or **New password** makes another, and **Remove** signs someone out right away.

Roles: a **rep** sees only their own numbers plus the team's leaderboard tops. A **CSR** sees only their own CSR screen (a CSR shows up after 20 appointments in 90 days). **Leadership** sees everything. A rep who guesses a leadership address gets a plain 404. Logins are stored in their private Blob store, passwords only as one-way codes. (The older `site/users.mjs` command-line tool still works for anyone who prefers it.)

## 12. Slack (optional)

1. In the client's Slack, api.slack.com/apps, Create New App, From a manifest, and paste `docs/slack-app-manifest.yml` (change the name). Install it to the workspace.
2. Add the app to each channel in `pulse.config.json` (channel settings, Integrations, Add apps).
3. Vercel variables: `PULSE_SLACK_BOT_TOKEN` (the Bot User OAuth Token, Sensitive), `PULSE_SLACK_NOTIFY_USER` (the admin's Slack member ID), `PULSE_SLACK_CHANNELS` (`pulse:C0123,leadership:C0456,sales:C0789`, IDs from each channel's About tab). Redeploy.
4. The admin signs in, opens **Post to Slack**, sends a test DM, sends themselves a sample of each daily message, then leaves the days they want switched on.

Only the live site sends. Automatic notices only DM the admin. A channel only gets the admin's own words from Post to Slack, the daily messages, and new requests. No customer names in any message.

## 13. The Claude skill

Fill in `skill-template/SKILL.md` (repo owner and name, company name) and add it as a skill in the client's Claude, with GitHub connected so Claude can read their repo. Every chat reads the rules fresh, so a rule change on github.com applies right away.

## 14. Go live

- [ ] check-rules is green and section 10 of RULES.md has the known-good numbers
- [ ] pull and pulse-data have run on their own at least once (Actions tab)
- [ ] The Pulse shows today's "Data pulled" time
- [ ] `rules/STARTING-RULES.md` questions answered (or the owner chose to keep the defaults for now)
- [ ] Each role signed in on a phone: owner, one rep, one CSR. The rep cannot open a leadership page
- [ ] Slack test DM and one sample message worked (if Slack is on)
- [ ] The client knows: rules change only on github.com, by the owner; a red X in Actions emails them; the last good numbers stay up if a pull fails

## Day to day

- Data refreshes itself. To pull right away: Actions, the connector's workflow, Run workflow.
- A failed pull keeps the last good files and emails the repo owner. A failed build keeps the last good numbers on the site, and if new rules broke it, the build runs on the last rules that worked and DMs the admin.
- Rules change only on github.com. GitHub keeps every change (who, what, when) under Commits.

## Run the sample on a laptop

`bash sample/run_sample.sh` runs the whole kit on a made-up company: the data contract check, the rules check, the privacy tests, the Pulse build and the site at http://localhost:3000/pulse. See `sample/README.md`.
