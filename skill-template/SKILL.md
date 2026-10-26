---
name: company-metrics
description: [COMPANY] numbers from [CRM], counted exactly like the certified reports. Use for any question on contacts, leads, appointments, sits, sales, revenue, jobs, close rate, demo conversion, GP, job costing, rep, setter or lead source performance, goals or pacing, the leadership scorecard, or any [CRM] export.
---

# [COMPANY] Metrics

The rules and the data live in the private GitHub repo `[OWNER]/[REPO]` (the company's own Pulse Kit copy). This skill only loads them. Never answer a numbers question from memory.

## Get the rules and data (once per chat, then reuse for follow-ups)

- If the repo is not attached to this chat, attach it (owner `[OWNER]`, repo `[REPO]`, read access).
- Download the rules: `git clone -q --depth 1 https://github.com/[OWNER]/[REPO] ./metrics-rules` (if the folder exists, `git -C ./metrics-rules pull -q`).
- Download the data: `git clone -q --depth 1 -b data https://github.com/[OWNER]/[REPO] ./metrics-data` (if the folder exists, `git -C ./metrics-data pull -q`).
- Read `./metrics-rules/rules/RULES.md` in full and follow it exactly. It overrides anything in this file.
- Load the data with `./metrics-rules/rules/pulse_metrics.py` (it reads `settings.json` next to it) from `./metrics-data/data/job_export_raw_latest.csv`.
- Read `./metrics-data/data/status.json` for the [CRM] run time, and start every answer by saying when the data was pulled.

If the repo can't be reached, say so plainly and ask the user to attach the export CSV instead.

## Always

- Compute every number with the code. Never estimate.
- Never show a customer name, phone number, email or address. Records are identified by job number and [CRM] link only.
- Never change the rules, the code or the data from a chat. Rule changes are made directly on github.com, by the owner.
