# Connecting AccuLynx to your Pulse

*Prepared by Benny Fisher | Visionary Navigator | bennyfisher.com*

This is the part where your AccuLynx numbers start flowing into your own Pulse, on their own, every half hour of the workday. It takes about an hour, and most of that is building three reports. I'll be with you for it, so treat this as the map we're both looking at.

A quick word on safety before we start. Everything here only reads from AccuLynx. Nothing ever changes a job, a contact or a number in your account. Your API key goes in one place only, a locked secret inside your own GitHub, and you're the one who types it in. Please never email it, text it or paste it into a chat, not even to me. And the reports leave out customer names, phone numbers, emails and street addresses entirely. Your Pulse only ever needs the job number, the zip code and the numbers.

## What you'll need

- An AccuLynx login with admin rights (usually the owner or the office manager)
- About an hour
- Your GitHub account, set up in step 4 if you don't have one yet

## Step 1. Make your API key

The person with AccuLynx admin rights does this one.

1. In AccuLynx, open your company settings and find the API keys page. AccuLynx keeps it with the admin settings. If you don't see it, your plan may need API access switched on, and AccuLynx support can do that for you.
2. Create a new key and name it **Pulse**. If AccuLynx offers a read-only option, pick it.
3. Copy the key, but don't paste it anywhere yet. Leave the AccuLynx tab open. You'll paste it straight into GitHub in step 4.

If a key is ever shared by mistake, delete it in AccuLynx and make a new one. Nothing else needs to change except the secret in GitHub.

## Step 2. Build the three reports

Your Pulse reads three saved reports. The report names matter, because AccuLynx names each file after its report and that's how the Pulse knows which is which. The columns matter too: these are the exact column names the rules were matched to, down to the penny.

In AccuLynx Reports, create a new custom report for each one. Keep every other setting simple: all locations, no extra grouping, CSV output.

### Report 1: `job_export_raw`

Every lead, prospect, job and dead lead, all time (or as far back as you want history; three years is great). Include dead leads and every stage.

Columns:

| | | |
|---|---|---|
| Job Number | Job Number Url | Job Category |
| Job Trade Type | Work Type | Primary Salesperson |
| Contract Amount | Primary Estimate Total | Estimates |
| Discount Amount | Comissions (the Additional Expenses field) | Profit |
| Profit % | Parent Lead Source | Sub Lead Source |
| Appointment Set By | Appointment Rating | Current Milestone |
| Current Milestone Date | Lead Milestone Date | Prospect Milestone Date |
| Initial Appointment Date | Submitted for Approval Date | Approved Milestone Date |
| Completed Milestone Date | Invoiced Milestone Date | Closed Milestone Date |
| Dead Lead Milestone Date | Dead Lead Reason | Current Status |
| Current Status Date | Job Last Touched Date | Job: Location City |
| Job: Location Zip Code | Initial Lead Notes (optional) | Post Appointment Notes #1 and #2 (optional) |

Please leave out every customer column: the contact's name, phone, email and the street address. If the notes columns are added, the Pulse masks any phone number, email or address it finds inside them before anything is saved, but you're welcome to leave the notes off too.

### Report 2: `revenue_in_progress`

Approved jobs with installs on the schedule.

Columns: Job Number, Job Number Url, Primary Salesperson, Trade Name, Crew Start Date, Crew End Date, Job Value, Current Status, Current Milestone.

### Report 3: `job_expenses_raw` (optional, for job costing)

Every cost line on Closed jobs from the last 365 days. Without it, the Pulse simply leaves the Job costing page off.

Columns: Job Number, Job Number Url, Payment Type, Payment Amount, To/Method, Check Number/Reference, Memo/Notes, Job Value, Balance Due, Paid in Full, Work Type, Trade Type, Job Category, Additional Expenses, Total Expenses.

A good gut check: run each report once by hand and look at it. If Report 1 has your dead leads in it and the dates look right, you're in good shape.

## Step 3. Schedule them

1. Open each saved report and choose to schedule it.
2. Delivery: CSV, to an office email you check now and then. That email is just the receipt; the Pulse picks the files up through the API.
3. Times: pick the moments you want fresh numbers. Four a day works well for most teams, for example 6 AM, 10 AM, 2 PM and 5 PM. One schedule can carry all three reports, and that keeps things tidy.
4. Save.

## Step 4. Your GitHub account, and where the key lives

If you don't have GitHub yet, go to github.com, sign up with your work email, and create an organization for your company (the free plan is fine). I'll set up your private Pulse repository inside it with you.

Then, in your Pulse repository on github.com:

1. Settings, Secrets and variables, Actions.
2. **Secrets** tab, New repository secret. Name: `ACCULYNX_API_KEY`. Paste the key from step 1. Save. You won't be able to see it again, and that's the point.
3. **Variables** tab, New repository variable. Name: `CRM_CONNECTOR`, value `acculynx`.

## Step 5. Find your schedule IDs

1. In your repository, open **Actions**, pick **acculynx-list-schedules**, and click **Run workflow**.
2. Open the run when it finishes. It lists each scheduled report with its ID and the files it sent.
3. Back in Settings, Secrets and variables, Actions, **Variables** tab, add `ACCULYNX_SCHEDULES` with your IDs and a label for each, like `a1b2c3:Morning,d4e5f6:Afternoon`.

If the list ever comes back empty, open the schedule in AccuLynx; the ID is in the page address.

## Step 6. The first pull

Actions, **pull-acculynx**, Run workflow. A green check means your data landed. You'll see it on the `data` branch of your repository, along with a small `status.json` that says when AccuLynx made each file. A red X tells you exactly which report or column needs a look, and GitHub emails you about it too.

From here it runs itself. If a pull ever fails, the last good numbers stay in place, so your team is never staring at a blank screen.

That's the plumbing. The meaningful part comes next, when we sit down together and decide exactly how your company counts its numbers.
