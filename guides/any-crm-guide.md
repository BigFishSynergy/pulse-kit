# Connecting any CRM to your Pulse

*Prepared by Benny Fisher | Visionary Navigator | bennyfisher.com*

Not every CRM has a direct connection to the Pulse yet, and that's okay. If your CRM can export a spreadsheet (a CSV file), it can feed your Pulse. You export three reports, upload them to your own GitHub, and the Pulse takes it from there. The numbers are just as exact. The only difference is that the data refreshes when you upload, instead of on its own.

A word on safety. This route never touches your CRM at all; you're simply exporting your own reports. When the files land, the Pulse keeps only the columns it counts with and throws everything else away, so customer names, phone numbers, emails and street addresses never get saved. Even so, if your CRM lets you leave those columns out of the export, please do.

## What your exports need to hold

Your CRM will call things by its own names, and that's fine. Your Claude writes down which of your columns means what, once, and the Pulse translates every upload the same way from then on.

**Export 1, all your jobs and leads.** One row per lead or job, dead leads included, with:

- The job number and a link to the record in your CRM
- The rep who owns it, the setter who booked it, and the lead source (the big bucket and the specific source)
- The date it reached each step: came in as a lead, appointment booked, appointment held, sold, installed, billed, closed out, and the date it died with the reason
- Where it is now (its stage and status)
- The money: contract amount, the quoted estimate total, any discount, and gross profit on closed jobs
- The work type, the trade, the category (residential, commercial) and the job's zip code and town

**Export 2, jobs scheduled to install.** Job number, rep, trade, crew start and end dates, job value, status.

**Export 3, job costs (optional).** Every cost line on closed jobs: job number, what was paid and to whom, the amount, and the job's totals. Without it, the Job costing page stays off.

If your CRM doesn't track one of these, tell your Claude. Some are optional, and for the rest there's usually a field we can use instead.

## Name the files

Name the exports so the Pulse can tell them apart. The defaults are anything with **job** and **export** in the name, anything with **progress** in it, and anything with **expense** in it. For example: `job-export-2026-10-25.csv`, `install-progress-2026-10-25.csv`, `job-expenses-2026-10-25.csv`.

## Upload them

1. Open your Pulse repository on github.com.
2. Switch the branch picker (top left) to **imports**.
3. Open the **imports** folder, click **Add file**, then **Upload files**, and drag in your exports.
4. Click **Commit changes**.

That's it. In a few minutes the Pulse converts the files, checks every column, saves the clean copy, clears out the raw uploads so they don't sit in your repository, and rebuilds your numbers. You'll see it under **Actions**, as **import-csv**. A green check means you're done. A red X tells you in plain words what's missing, and GitHub emails you as well.

## How often

As often as you want fresh numbers. Once a day, first thing in the morning, works for most teams. Monday morning before the leadership meeting is the one upload I'd never skip.

## Before the first upload

Your Claude fills in the translation file for you (`connectors/csv/mapping.json`) from your first export's column names: which of your columns feeds each Pulse column, how your CRM writes dates, and what your CRM calls each stage. For example, if your CRM says "Sold" where the Pulse says "Approved", it writes that down once. Then you do a practice run on one export, match the numbers against your CRM's own reports, and only then go live.
