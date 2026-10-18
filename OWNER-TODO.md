# Owner to-do list

Everything still waiting on the owner before launch. Each item is marked `TODO(owner)` in the code,
so you can find it with a search. `npm run check:launch` fails until they're all done.

Last checked: 2026-10-18.

## Settings in `src/config/site.ts`

- [ ] **Business phone** (`contact.phone`). Write it the way it should appear, e.g. `(555) 010-0000`.
      Until then Contact shows the placeholder text.
- [ ] **Postal address** (`contact.postalAddress`). Add it once the US virtual mailbox is active, in
      this format: `Ads Mechanic, 123 Main St #456, City, ST 00000`. Until then no page shows an
      address. **No cold email goes out until this is set**: CAN-SPAM requires it in every marketing
      email.
- [ ] **Cloudflare Web Analytics token** (`analytics.cloudflareToken`). While it's empty, no
      analytics run.
- [ ] **Visit-logger URL** (`visitLogger.url`). The Apps Script web app URL (ends in `/exec`), set
      up from `reference/landing-page-kit/visit_logger.gs`. While it's empty, prospect pages log
      nothing. If the host isn't `script.google.com`, add it to `connect-src` in `public/_headers`.
- [ ] **Legal entity** (`legal.entity`). "Ads Mechanic" is a trade name that isn't registered yet.
      Update it once the business is registered.
- [ ] **Certifications** (`certifications`). None are listed, so About hides the block. Add only
      Google Skillshop certifications that are currently valid.

## Legal pages

- [ ] **Lawyer review** of `src/pages/privacy.md`, `src/pages/terms.md` and
      `src/pages/service-terms.md`. They're drafts written without a lawyer. Get them reviewed
      before taking paying clients.
- [ ] **Outreach deletion window** in `src/pages/privacy.md` (Outreach section). Confirm "we'll stop
      and delete your details within 10 business days".

## Checks in a live Google Ads account

- [ ] **Menu names** quoted in the step-by-step instructions for granting and removing access. Check
      them once in a real account:
  - `src/pages/how-it-works.astro`
  - `src/pages/free-review.astro`
  - `src/pages/thanks.astro`

## Shows up only if data is missing

These have nothing to do today, but they print a `TODO(owner)` on the page if a value goes missing:

- **Add-on price** on Pricing shows `TODO(owner): price` if any add-on in `src/data/offer.yaml` has
  no price. They all have one today.
- **Tally form** shows a "set this form's Tally ID" note if a form ID in `site.ts` is empty. Both
  are set (`yXZM1d`, `EqzKal`). Check that both forms are published in Tally: in a preview the
  contact form showed Tally's "page not found".

## Outside the site (not code)

- [ ] Buy the US virtual mailbox, then put the address in the settings above and in the footer of
      every cold email.
