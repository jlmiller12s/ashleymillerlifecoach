# Freebie email flow — Resend

The site uses Resend, not MailerLite. Both resources have first-name/email/consent forms, a check-your-inbox page, an explicit email-confirmation page, and an unsubscribe page. PDFs are unlisted and linked only from emails. Original files in Downloads are untouched; the packaged Momentum Map corrects overlapping first-page instructions/footer.

## Current account setup

The verified sender is `Ashley Miller <ashley@rootedwomencollective.com>`. The existing Resend plan allows three segments, two already used by The Rooted Letter and General. The third, `Ashley Free Worksheets`, was created for these resources. Both environment segment IDs currently point to it. No existing segment was changed.

Distinct `resource` values in `ashley_freebies.signups` preserve Map versus Matrix attribution, consent and confirmation dates. Each resource has its own welcome and follow-up copy. If the Resend plan later allows more segments, create two and change the IDs; no application rewrite is needed.

## Production configuration

Local configuration is in ignored `.env.local`. Copy these values securely to the Ashley Miller Vercel project, never to browser code:

- `FREEBIE_POSTGRES_URL` — durable database connection scoped to the freebie service (local development can fall back to `POSTGRES_URL`)
- `ROOTED_RESEND_API_KEY` (existing full-access key), or dedicated `FREEBIE_RESEND_API_KEY` with email/contact/segment access
- `FREEBIE_MOMENTUM_SEGMENT_ID` and `FREEBIE_RELEASE_SEGMENT_ID`
- `FREEBIE_SITE_URL=https://www.ashleymillerlifecoach.com` (must match canonical browser origin)
- `CRON_SECRET` — locally generated secret for Vercel's scheduler
- Optional `FREEBIE_EMAIL_FROM` after verifying a different sender domain

Build: `node scripts/build-site.js`. The first signup initializes a separate `ashley_freebies` database schema. Confirmation links expire after 24 hours; scanners visiting the link do not confirm subscriptions because an explicit button POST is required. No provider credentials are exposed publicly.

On confirmation, the contact is added to Resend and the welcome email includes the correct PDF. Three follow-ups become due after 2, 4 and 7 days. Vercel's daily 15:00 UTC cron processes due messages, so delivery occurs on the next daily run. The worker checks both local and Resend unsubscribe status before sending. Repeat requests deliver another worksheet but do not restart the same follow-up sequence. Both resources may run separate sequences if requested.

Unsubscribe links stop both freebie sequences, without changing the separate Rooted Letter subscription. Existing global Resend unsubscribes are respected. The source-of-truth for freebie follow-up suppression is the local table; do not manually broadcast to this segment without applying the local suppression list.

## Attribution report

Run against the configured database (never expose this endpoint publicly):

```sql
SELECT resource,
       count(DISTINCT email) AS requests,
       count(DISTINCT email) FILTER (WHERE confirmed_at IS NOT NULL) AS confirmed,
       count(DISTINCT email) FILTER (WHERE unsubscribed_at IS NOT NULL) AS unsubscribed
FROM ashley_freebies.signups
GROUP BY resource;
```

## Email drafts — Momentum Map

Immediately after confirmed signup

Subject: Your next 48 hours start here

Your next chapter doesn’t need a permission slip. It needs a first step. Your Momentum Map is ready. Set aside 15 minutes, open it, and choose one move that fits your real life. Small counts.

Button: Open my Momentum Map
URL: https://www.ashleymillerlifecoach.com/downloads/momentum-map.pdf

Day 2 — Subject: Did you make your 15-minute move?

You don’t need a perfect afternoon. What’s one thing you can do with the next 15 minutes? Open your map, pick your move, and give it a place on today’s calendar. If you already started, pause long enough to notice that. You moved.

Day 4 — Subject: Someday is sneaky

Someday sounds reasonable. After the busy week. After everyone else is settled. But another week can pass while your own next step waits. Today, try a smaller question: what is possible with the time I actually have? Let that be enough to begin.

Day 7 — Subject: You don’t have to keep going alone

If your map helped you find a first step, Homeroom is a place to keep showing up with coaching and community. Want to talk through your next chapter one-on-one first? Book a free Clarity Call. Bring your real life.

Buttons: Explore Homeroom → https://www.ashleymillerlifecoach.com/homeroom
Book a free Clarity Call → https://www.ashleymillerlifecoach.com/book

## Email drafts — Release & Reclaim Matrix

Immediately after confirmed signup

Subject: You get to put some things down

Your Release & Reclaim Matrix is here. You don’t have to solve your whole life today. Give yourself a quiet few minutes to notice what you’re carrying and what you want to make room for. Start honestly. Start small.

Button: Open my Matrix
URL: https://www.ashleymillerlifecoach.com/downloads/release-reclaim-matrix.pdf

Day 2 — Subject: What are you ready to release?

Take another look at your matrix. Which thing keeps asking for more energy than you have to give? Name one small boundary or conversation that could help. You’re allowed to practice before it feels natural.

Day 4 — Subject: A yes needs room

It’s hard to hear your own next step when every spare minute already belongs to something else. What would you like to reclaim: rest, creativity, a little courage? Choose one small way to give it room this week.

Day 7 — Subject: Let’s name your next step

Releasing what’s been holding you back is part of our work in 1:1 coaching. If your matrix brought up more questions, bring them to a free Clarity Call. We’ll talk about what’s shifting and a next step that fits your life. Prefer coaching with community? Come explore Homeroom.

Buttons: Book a free Clarity Call → https://www.ashleymillerlifecoach.com/book
Explore Homeroom → https://www.ashleymillerlifecoach.com/homeroom

## Verification and launch status

- Freebie backend tests cover consent, confirmation, per-resource delivery, expiration, provider failure, cron authorization, repeat confirmation, and unsubscribe suppression.
- Mobile and desktop layouts were inspected locally. The build includes PDFs and all success/confirmation/unsubscribe pages.
- No live subscriber emails were sent during development. Production environment configuration, deployment, and a real inbox delivery check remain to be completed.
- Download responses use `X-Robots-Tag: noindex, nofollow, noarchive`. URLs are unlisted, not access-controlled: an email recipient can share a link.
- Monitor scheduled delivery backlog and Resend usage as the list grows. Use more frequent cron runs on a plan that supports them for larger volume.

Resend contacts reference: https://resend.com/blog/new-contacts-experience
