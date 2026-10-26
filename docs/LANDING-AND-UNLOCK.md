# The Pulse Kit landing page and automatic unlock

For Benny only. How someone finds the DIY Pulse Report (the Pulse Kit), signs up on Benny's GoHighLevel landing page, and gets access on their own, with nobody added by hand.

Clients never touch GoHighLevel or this page's setup. Their Pulse runs on its own in their Vercel account at an address like pulse.theircompany.com, whatever their own website is built on (WordPress, Wix, Squarespace, anything): they add one DNS record where their domain is registered (docs/SETUP.md step 10), and, if they like, a "Team Pulse" link on their website.

```
Landing page in GoHighLevel (page + form)
        │  each sign-up
        ▼
GoHighLevel workflow: 1. tags the contact "Pulse Kit"
                      2. sends the sign-up to Zapier
                      3. a welcome email from Benny
                      4. 14 days later, a check-in email
        ▼
Zapier: GitHub gives their GitHub account read access to BigFishSynergy/pulse-kit (and emails Benny if it fails)
        ▼
They accept GitHub's invite, make their copy, open it in Claude, and say "Help me set up my Pulse."
```

The kit stays private. The only way in is the landing page: no sign-up, no invite. Benny can still unlock someone by hand (Good to know, below).

## 1. The page and form in GoHighLevel

**The form first.** Sites, Forms, Builder, Add Form, "Pulse Kit sign-up". Fields, in this order:

| Field | Kind | Note on the form |
|---|---|---|
| Name | full name, required | |
| Email | email, required | |
| Company | company name, required | |
| Phone | phone, optional | |
| CRM | custom dropdown: AccuLynx, JobNimbus, Other | |
| Team size | custom dropdown: 1 to 5, 6 to 15, 16 to 50, 50+ | |
| Other tools | custom single line, optional | "QuickBooks, your marketing software, anything else" |
| What should the Pulse fix? | custom multi line, optional | |
| GitHub username | custom single line, required | "Free at github.com/signup. Takes 2 minutes. This is where your copy of the Pulse lives." |

On submit, show: "You're in. Check your email in the next few minutes, and accept the GitHub invite when it arrives."

**Then the page.** Sites, Funnels (or Websites), New, "DIY Pulse Report", one step at `/pulse`, on your bennyfisher.com domain or a subdomain like `pulse.bennyfisher.com`. Add the form to it. Suggested copy:

> **The DIY Pulse Report**
>
> Your company's numbers, counted your way, updated through the day. Every rep sees their own numbers. Leadership sees everything. A TV on the sales floor shows who's winning this week.
>
> It's free. It runs in your own accounts, and you own all of it. Your own Claude sets it up with you, step by step, from your CRM to your first login. No technical skills needed.
>
> Works with AccuLynx today, and with any CRM that can export a spreadsheet.
>
> **Unlock the DIY Pulse Report** (the form)
>
> Built by Benny Fisher, Visionary Navigator. I walk with founders who want impact in their business and peace in their life.

## 2. One GitHub key, for Zapier only

Benny makes this once; it never goes anywhere but Zapier.

1. github.com, Settings, Developer settings, Personal access tokens, **Fine-grained tokens**, Generate new token.
2. Name: `Pulse Kit unlock (Zapier)`. Expiration: 1 year (put a reminder on the calendar). Resource owner: **BigFishSynergy**. Repository access: **Only select repositories**, `pulse-kit`.
3. Permissions, Repository permissions, **Administration: Read and write** (this is what lets it add a reader). Nothing else.
4. Generate, and paste it straight into Zapier in step 3 below. Don't save it anywhere else.

If the organization asks to approve fine-grained tokens, approve it under the organization's Settings, Personal access tokens.

## 3. The Zap (only the GitHub unlock)

In Zapier, Create Zap:

**Trigger.** **Webhooks by Zapier**, **Catch Hook**. Copy the webhook URL it gives you for step 4.

**Action 1.** **Webhooks by Zapier**, **Custom Request**:

| Setting | Value |
|---|---|
| Method | PUT |
| URL | `https://api.github.com/repos/BigFishSynergy/pulse-kit/collaborators/` then the GitHub username from the hook (trimmed, no @) |
| Data | `{"permission":"pull"}` |
| Headers | `Authorization` = `Bearer ` then the token from step 2 · `Accept` = `application/vnd.github+json` · `X-GitHub-Api-Version` = `2022-11-28` |

GitHub answers 201 (invite sent) or 204 (they already had access). GitHub emails them the invite; they accept it within 7 days. "Read" access only lets them copy the kit; they can't change it.

**Action 2.** **Filter by Zapier**: continue only if Action 1 failed (Zapier's error, or a status other than 201 and 204). Then **Gmail** or **Email by Zapier**, to benny@bennyfisher.com: "Pulse Kit unlock failed for {name} ({GitHub username})". Most failures are a mistyped username: check github.com/{username}, then unlock by hand.

## 4. The workflow in GoHighLevel

Automation, Workflows, Create Workflow, start from scratch, "DIY Pulse Report sign-up".

- **Trigger:** Form Submitted, filter Form is "Pulse Kit sign-up".
- **Add Contact Tag:** `Pulse Kit`.
- **Webhook:** POST to the Zapier URL from step 3, with the contact's name, email, company and GitHub username fields.
- **Send Email** from benny@bennyfisher.com:

> Subject: Your DIY Pulse Report is unlocked
>
> Hi {{contact.first_name}},
>
> Welcome. GitHub is emailing you an invite right now. Accept it, then follow the Start Here guide: [Start Here: Your DIY Pulse Report in 6 Steps](https://claude.ai/artifact/1RKn49JZGkJdnkrimWrwHu). Steps 3 to 6 take about 30 minutes, and your own Claude does the rest with you.
>
> It's yours: your accounts, your numbers, your rules. If you get stuck or want a hand, just reply to this email.
>
> Benny Fisher
> Visionary Navigator · bennyfisher.com

- **Wait:** 14 days.
- **Send Email:**

> Subject: How's your Pulse?
>
> Hi {{contact.first_name}},
>
> It's been a couple of weeks. How's the Pulse treating you? What's working, and what isn't? If you're live, I'd love to see a screenshot.
>
> Just reply here.
>
> Benny

- Optional: **Internal Notification** to Benny for each sign-up (name, company, CRM, team size, what they want fixed).

Publish the workflow.

## 5. Verify it before you share the page

1. Make a test GitHub account (any spare email) and sign up on the page with it.
2. Within a few minutes: the contact shows in GoHighLevel tagged `Pulse Kit`, the welcome email arrives, and the Zap's history shows a 201.
3. github.com/BigFishSynergy/pulse-kit, Settings, Collaborators: the test username is listed as invited. The test account's email has the invite.
4. Sign up again with a made-up username: Benny gets the "unlock failed" email.
5. Remove the test username from Collaborators.

Only share the page once all five check out.

## Good to know

- Anyone who has a copy can share it; the page is about knowing who's using it and staying in touch, not locking it down.
- To unlock someone by hand (like the first pilot): github.com, BigFishSynergy/pulse-kit, Settings, Collaborators, Add people, their username, Read.
- To stop new copies for someone: github.com, BigFishSynergy/pulse-kit, Settings, Collaborators, remove them. Copies already made stay theirs.
- When the kit improves, people who copied it earlier don't get the changes on their own. Their Claude can bring a change over when they ask for it.
