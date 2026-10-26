# The Pulse Kit landing page and automatic unlock

For Benny. How someone finds the Pulse Kit, signs up, and gets access on their own, with nobody added by hand.

```
bennyfisher.com/pulse (Duda page + form)
        │  each sign-up
        ▼
Zapier: 1. a row in the "Pulse Kit sign-ups" Google Sheet
        2. GitHub gives their GitHub account read access to BigFishSynergy/pulse-kit
        3. a welcome email from Benny's Gmail
        4. 14 days later, a check-in email
        ▼
They accept GitHub's invite, click Use this template, open their copy in Claude, and say "Help me set up my Pulse."
```

The kit stays private. Only people who came through the page can copy it.

## 1. The page on Duda

Add a page at `/pulse` on bennyfisher.com. Keep it high level, in Benny's brand. Suggested copy:

> **The Pulse Kit**
>
> Your company's numbers, counted your way, live every hour. Every rep sees their own numbers. Leadership sees everything. A TV on the sales floor shows who's winning this week.
>
> It's free. It runs in your own accounts, and you own all of it. Your own Claude sets it up with you, step by step, from your CRM to your first login. No technical skills needed.
>
> Works with AccuLynx today, and with any CRM that can export a spreadsheet.
>
> **Unlock the Pulse Kit** (the form)
>
> Built by Benny Fisher, Visionary Navigator. I walk with founders who want impact in their business and peace in their life.

The form, with these field names (Zapier uses them):

| Field | Kind | Note on the form |
|---|---|---|
| Name | text, required | |
| Email | email, required | |
| Company | text, required | |
| Phone | phone, optional | |
| CRM | dropdown: AccuLynx, JobNimbus, Other | |
| Team size | dropdown: 1 to 5, 6 to 15, 16 to 50, 50+ | |
| Other tools | text, optional | "QuickBooks, your marketing software, anything else" |
| What should the Pulse fix? | long text, optional | |
| GitHub username | text, required | "Free at github.com. Takes 2 minutes. This is where your copy of the Pulse lives." |

After submit, show: "You're in. Check your email in the next few minutes, and accept the GitHub invite when it arrives."

## 2. One GitHub key, for Zapier only

Benny makes this once; it never goes anywhere but Zapier.

1. github.com, Settings, Developer settings, Personal access tokens, **Fine-grained tokens**, Generate new token.
2. Name: `Pulse Kit unlock (Zapier)`. Expiration: 1 year (put a reminder on the calendar). Resource owner: **BigFishSynergy**. Repository access: **Only select repositories**, `pulse-kit`.
3. Permissions, Repository permissions, **Administration: Read and write** (this is what lets it add a reader). Nothing else.
4. Generate, and paste it straight into Zapier in step 3.2 below. Don't save it anywhere else.

If the organization asks to approve fine-grained tokens, approve it under the organization's Settings, Personal access tokens.

## 3. The Zap

In Zapier, Create Zap:

**Trigger.** App **Duda**, event **New Form Submission**, pick bennyfisher.com and the Pulse Kit form. (If Zapier's Duda app asks for a Duda API or partner account you don't have, use the fallback below.)

*Fallback trigger:* in Duda's form settings, send submissions to benny@bennyfisher.com with the subject `Pulse Kit sign-up`. In Zapier: **Gmail**, **New Email Matching Search**, search `subject:"Pulse Kit sign-up"`, then add **Formatter**, **Text**, **Extract Pattern** steps to pull each field out of the email.

**Action 1.** **Google Sheets**, **Create Spreadsheet Row** in a sheet called "Pulse Kit sign-ups" with a column per form field plus "Signed up" (the trigger's date).

**Action 2.** **Webhooks by Zapier**, **Custom Request** (needs a paid Zapier plan):

| Setting | Value |
|---|---|
| Method | PUT |
| URL | `https://api.github.com/repos/BigFishSynergy/pulse-kit/collaborators/` then the GitHub username field |
| Data | `{"permission":"pull"}` |
| Headers | `Authorization` = `Bearer ` then the token from step 2 · `Accept` = `application/vnd.github+json` · `X-GitHub-Api-Version` = `2022-11-28` |

GitHub emails them an invite; they accept it within 7 days. "Read" access only lets them copy the kit; they can't change it.

**Action 3.** **Gmail**, **Send Email**, from benny@bennyfisher.com, to their email:

> Subject: Your Pulse Kit is unlocked
>
> Hi {first name},
>
> Welcome. Here's how to get your Pulse going:
>
> 1. Accept the invite GitHub just emailed you.
> 2. Open github.com/BigFishSynergy/pulse-kit, click **Use this template**, pick your account, name it pulse, choose **Private**.
> 3. Open your new copy in Claude (the Code tab in the Claude desktop app is best) and say: "Help me set up my Pulse." Claude walks you through the rest, one step at a time, from your CRM to your first login.
>
> It's yours: your accounts, your numbers, your rules. If you get stuck or want a hand, just reply to this email.
>
> Benny Fisher
> Visionary Navigator · bennyfisher.com

**Action 4.** **Delay by Zapier**, **Delay For**, 14 days.

**Action 5.** **Gmail**, **Send Email**:

> Subject: How's your Pulse?
>
> Hi {first name},
>
> It's been a couple of weeks. How's the Pulse treating you? What's working, and what isn't? If you're live, I'd love to see a screenshot.
>
> Just reply here.
>
> Benny

Optional: one more **Gmail** step that sends Benny a short note for each sign-up (name, company, CRM, team size, what they want fixed).

Turn the Zap on, then sign up once yourself with a test GitHub account to see every step land.

## Good to know

- Anyone who has a copy can share it; the page is about knowing who's using it and staying in touch, not locking it down.
- To stop new copies for someone: github.com, BigFishSynergy/pulse-kit, Settings, Collaborators, remove them. Copies already made stay theirs.
- When the kit improves, people who copied it earlier don't get the changes on their own. Their Claude can bring a change over when they ask for it.
