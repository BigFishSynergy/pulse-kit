# Prove It: matching your Pulse to your CRM

*Prepared by Benny Fisher | Visionary Navigator | bennyfisher.com*

A dashboard is only worth something when the team believes it. So before your Pulse goes live, we prove every number against your CRM's own reports, for the same dates, until they agree exactly. To the record and to the penny.

Here's how it works. We pick one finished period (the last full quarter is ideal, plus last month). For each line, you pull the number from your CRM's own report, your Claude pulls it from the Pulse rules (the prove-it button), and you compare. When they match, we check the box. When they don't, we find the exact records that differ and we fix the rule or the setting, never the number. Most differences turn out to be a dead reason spelled two ways or a work type nobody remembered.

## The period we're proving

Period 1: ______________ to ______________

Period 2: ______________ to ______________

Data pulled (from status.json): ______________

## The checklist

| # | Number | Compare it with | Period 1 CRM | Period 1 Pulse | Match | Period 2 CRM | Period 2 Pulse | Match |
|---|---|---|---|---|---|---|---|---|
| 1 | Contacts | The CRM's lead report, by lead date, same exclusions | | | ☐ | | | ☐ |
| 2 | Leads | Same report, with the out-of-area and wrong-trade reasons left out | | | ☐ | | | ☐ |
| 3 | Appointments | Appointments booked, by the booked date | | | ☐ | | | ☐ |
| 4 | Sits | The certified sits report, by appointment date, quoted only | | | ☐ | | | ☐ |
| 5 | Sales $ | The certified sales report, by approved date | | | ☐ | | | ☐ |
| 6 | Jobs sold | Same report, upgrades left out | | | ☐ | | | ☐ |
| 7 | Revenue $ | The weekly or revenue report, by installed date | | | ☐ | | | ☐ |
| 8 | Jobs installed | Same report, upgrades left out | | | ☐ | | | ☐ |
| 9 | Upgrades $ | Same report, upgrade work type only | | | ☐ | | | ☐ |
| 10 | Demo conversion | The certified close report (in AccuLynx, Close % Overall Certified), with counts | | | ☐ | | | ☐ |
| 11 | Close rate | Approvals in the period over demos in the period, with counts (our own scoreboard rule, so we check it by hand on a sample) | | | ☐ | | | ☐ |
| 12 | GP % | The certified GP report by closed date, call backs out, with profit and contract totals | | | ☐ | | | ☐ |
| 13 | Revenue in progress | The scheduled installs report, each job once | | | ☐ | | | ☐ |
| 14 | Backlog $ | Approved jobs, scheduled or in progress, as of the pull | | | ☐ | | | ☐ |
| 15 | A/R over 30 days | Invoiced jobs billed more than 30 days ago, as of the pull | | | ☐ | | | ☐ |

Then three spot checks, because totals can match for the wrong reason:

- ☐ One rep's sales and sits for the quarter match their numbers in the CRM
- ☐ One lead source's leads and sales match
- ☐ One week of installs matches the jobs your production team actually installed

## When a number doesn't match

1. Narrow it down: which month, which rep, which source is off.
2. List the records the CRM counts and the Pulse doesn't (or the other way around). Compare them by job number only.
3. Look at what those records have in common: a dead reason, a work type, a date that's blank, a category.
4. Fix the rule in `rules/settings.json` or `rules/RULES.md`, push, and let the check run. Then recheck this line, and the lines above it.

We never adjust a number to make it match. If a difference turns out to be a real choice (for example, you'd rather count something your CRM report leaves out), we write that rule down on purpose and note it in the rulebook.

## Record the known-good numbers

When every box is checked, your Claude writes the matched numbers into section 10 of your rulebook, with the period and when the data was pulled. From then on, any change to the rules or the code has to reproduce them. Later data will drift a little as records change in your CRM, and that's expected; the known-good numbers are about the counting, not the data.

Recorded on: ______________ by ______________

That's the finish line. From here, your team can ask any number question and get the answer your CRM would give, every single time.
