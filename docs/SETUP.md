# Pulse Kit setup, start to finish

This takes a contractor from nothing to their own live Pulse: their CRM's numbers pulled automatically, their own rules (so Claude answers any number exactly the way the CRM does), and their own Pulse site with rep and owner screens and daily Slack posts. Everything runs in the client's own GitHub, Vercel and Slack accounts. The client owns all of it.

Benny leads two parts in person: the rules session (step 8) and matching the numbers (step 9). Everything else is a checklist.

## The easiest way: let Claude walk you through it

Open Claude Code in a copy of this repo and paste this:

> Walk me through setting up Pulse Kit for a new client. Read docs/SETUP.md, docs/DATA-CONTRACT.md and connectors/README.md first. Go one step at a time: tell me what the step is for, what I or the client need to do, and check it is done before moving on. Never ask me to paste a key, password or token into this chat; keys only ever go into GitHub or Vercel settings, typed in by whoever owns the account. When we reach the rules session, use guides/rules-worksheet.md and update rules/settings.json and rules/RULES.md with the answers. When we reach number matching, use guides/prove-it-checklist.md. At the end, tell me what is left and what the client needs to do.

The steps below are the same walk-through, written out.

## Before you start

| Who | Brings |
|---|---|
| The client's owner or admin | A GitHub account (an organization is best, free is fine), a Vercel account (Pro, $20 a month, because a business site needs it and the hourly notices need Pro's cron jobs), admin access to their CRM, and their Slack workspace if they want Slack posts |
| Benny | This repo, the rules session, the number matching |
| Optional | An Anthropic API key in the client's own Claude Console (Ask Claude, Make a graphic, coaching cards, Speed Round), a Google account for a goals sheet, Windsor.ai for ad spend |

**Security, always:** keys, tokens and passwords go only into GitHub secrets or Vercel environment variables, typed in by the person who owns that account. Never in email, chat, a text, or any file. Everything reads the CRM only; nothing ever writes to it. Customer names, phones, emails and addresses never get saved (the connectors drop them) and never show on the site (the build stops if one slips through).

## 1. Make the client's copy

1. The client makes an empty **private** repo in their GitHub, for example `their-org/pulse`, and adds Benny as a collaborator (Settings, Collaborators).
2. Benny pushes a clean copy of the kit into it:

   ```bash
   git clone https://github.com/BigFishSynergy/pulse-kit.git client-pulse
   cd client-pulse && git remote set-url origin https://github.com/their-org/pulse.git && git push -u origin main
   ```

3. In the client's repo: Settings, Actions, General, Workflow permissions: **Read and write**. Save.
4. Settings, Secrets and variables, Actions, Variables tab: add `CRM_CONNECTOR` = `acculynx` (or `csv`).

When the project is live and handed over, the client can remove Benny as a collaborator. Nothing breaks.

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

Make a CSV of their zips (`zip,town,region`, with region `OUT` for zips they get leads from but do not serve; those show as one gray block, left out of colors and rankings) and run:

```bash
python scripts/make_zip_files.py --zips zips.csv
```

It writes `site/content/zips.json` and `site/public/pulse/zips.geojson` from the U.S. Census (2020 zip areas, public data). Add `--market` with a free Census API key in the `CENSUS_API_KEY` environment variable for owned homes, home values, home age and income by zip (the map's market views and the region comparison). Set `map.center` and `map.zoom` in `pulse.config.json` to frame the area.

## 7. Goals

- **File (simplest):** edit `site/content/goals.json`, one block per quarter, each metric with its quarter goal, weekly goal and owner initials.
- **Google Sheet:** tabs `Q1` to `Q4`, columns Metric, Quarter goal, Weekly goal, Actual, (anything), Owner. Put the sheet id in `rules/settings.json` (`goals.sheet_id`), set `goals.source` to `sheet`, share the sheet as Viewer with a Google service account, and save that account's key as the `GOOGLE_SA_JSON` secret.

Net Profit and 5-star reviews are not in the CRM; they go in the Actual column.

## 8. The rules session (Benny leads)

This is the heart of it. Sit with the owner and go through `guides/rules-worksheet.md` together: every decision the rulebook makes (what counts as a contact, a lead, an appointment, a sit, a sale, revenue, an upgrade, a call back; which date each one uses; close rate against demo conversion; the GP rule; discounts; the roster; the scorecard).

Then put the answers in:

- `rules/settings.json`: the exact CRM names (reps, dead reasons, work types, categories), the scorecard owners and goals, the job number prefix, the time zone. Names must match the CRM exactly, letter for letter.
- `rules/RULES.md`: every FILL_IN, and any rule that works differently for this company.
- `rules/pulse_metrics.py`: only if a definition really differs. Most companies never touch it.
- `rules/MARKETING_PHILOSOPHY.md`: how they judge marketing, or delete it with section 14.

Push, then watch **Actions, check-rules**. Red lists every FILL_IN still open and every name that is not in the CRM data (almost always a typo). Keep going until it is green.

## 9. Match the numbers (Benny leads)

Go through `guides/prove-it-checklist.md` with the client: run each number with the rules and match it against the CRM's own report for the same dates, to the record and to the penny. When something is off, find the records that differ and fix the rule or the setting, never the number. When every line matches, record the known-good numbers in `rules/RULES.md` section 10. From then on, any rule change has to reproduce them.

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
| `PULSE_USERS` | Logins, set by `node users.mjs push` (step 11) |
| `BLOB_READ_WRITE_TOKEN` | Added by Vercel in step 2 |
| `CRON_SECRET` | Random characters. Vercel sends it to the cron jobs in `site/vercel.json` |
| `ANTHROPIC_API_KEY` | Optional. Ask Claude and Make a graphic. Set a monthly spend limit in the Claude Console |
| `PULSE_ASK_REPS` | Optional. `on` gives reps Ask Claude and graphics on their own numbers |
| `NEXT_PUBLIC_MAPTILER_KEY` | Optional. A satellite map |
| `PULSE_SLACK_BOT_TOKEN`, `PULSE_SLACK_NOTIFY_USER`, `PULSE_SLACK_CHANNELS` | Step 12 |

6. Domains: add their address (for example `pulse.theircompany.com`) and put it in `pulse.config.json` `company.site_url`. Redeploy.

## 11. Logins

From the `site` folder, on the admin's computer (the Vercel CLI logged in to the client's account and `vercel link`ed to the project):

```bash
node users.mjs add pat "Pat Owner" lead
node users.mjs add alex "Alex Rivera" rep alex-rivera
node users.mjs add jamie "Jamie Ortiz" csr jamie-ortiz
node users.mjs link alex
node users.mjs push
```

Rep slugs are the roster name in lower case with dashes; CSR slugs are their "Appointment Set By" name the same way (a CSR gets a screen after 20 appointments in 90 days). Passwords print once in that terminal only. The easiest handover is each person's own sign-in link (`link`), sent to them directly. `push` refuses to drop a login that production still has. Redeploy after a push.

Roles: a **rep** sees only their own numbers plus the team's leaderboard tops. A **CSR** sees only their own CSR screen. **Leadership** sees everything. A rep who guesses a leadership address gets a plain 404.

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
- [ ] Each role signed in on a phone: owner, one rep, one CSR. The rep cannot open a leadership page
- [ ] Slack test DM and one sample message worked (if Slack is on)
- [ ] The client knows: rules change only on github.com, by the owner; a red X in Actions emails them; the last good numbers stay up if a pull fails

## Day to day

- Data refreshes itself. To pull right away: Actions, the connector's workflow, Run workflow.
- A failed pull keeps the last good files and emails the repo owner. A failed build keeps the last good numbers on the site, and if new rules broke it, the build runs on the last rules that worked and DMs the admin.
- Rules change only on github.com. GitHub keeps every change (who, what, when) under Commits.

## Run the sample on a laptop

`bash sample/run_sample.sh` runs the whole kit on a made-up company: the data contract check, the rules check, the privacy tests, the Pulse build and the site at http://localhost:3000/pulse. See `sample/README.md`.
