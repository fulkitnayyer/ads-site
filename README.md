# Ads Upkeep website

A small static site that sells one service, Ads Upkeep (Google Ads management, $179 a month),
and hosts personalized prospect pages for cold outreach. The plan and all the rules are in
[CLAUDE.md](CLAUDE.md).

**Status: review checkpoint.** Built so far: design tokens, layouts, components, Home, Pricing and
prospect pages. Links to the other pages (How it works, Free review, FAQ, About, Contact, legal)
return 404 until those pages are built.

## Commands

Node 22.18 or newer.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server with live reload |
| `npm run build` | Build to `dist/`, then run the content check |
| `npm run check` | Run the content check on its own (after a build) |
| `npm run check:launch` | Stricter check for launch: placeholders and sample pages fail |
| `npm run check:types` | Type-check every `.astro` and `.ts` file |
| `npm run preview` | Serve `dist/` through Cloudflare's runtime, with `_headers` and `_redirects` applied |
| `npm run deploy` | Build, check, and deploy to Cloudflare Workers |

## Where things live

| What | Where |
| --- | --- |
| Brand name, prices, booking link, Tally ID, analytics token, address, certifications | `src/config/site.ts` (the only place) |
| What's included, not included, promises, fit, add-ons | `src/data/offer.yaml` |
| Questions and answers | `src/data/faq.yaml` |
| Prospect rows | `src/data/prospects.csv` |
| Colours, type sizes, spacing | `src/styles/tokens.css` |
| Security headers, CSP, noindex rules | `public/_headers` |

Renaming the business is one edit: `name` in `src/config/site.ts`.

## Prospect pages

Each publishable row of `src/data/prospects.csv` becomes a page at `/<business-slug>/`. The
columns are the ones in `reference/landing-page-kit/leads_template.csv`.

- **Required:** `business_name`, `email`, `search_term`, `checked_on` (YYYY-MM-DD),
  `observation_1_title`, `observation_1`. Observations 2 and 3 are optional, but each needs both
  its title and its text.
- **No page** for rows with `fit` = `N` or `status` = `dnc`, `unsubscribed` or `expired`. Leave a
  page up at least 30 days after the last email; the check warns if a row is marked `expired` sooner.
- **Slugs** come from the business name ("Harbor Point Plumbing LLC" becomes
  `harbor-point-plumbing`), or from the `slug` column. A second business with the same name gets
  its city appended. Don't reorder rows after sending links; pin a slug in the `slug` column instead.
  A slug that matches a site page or a reserved word fails the build.
- **Screenshots:** put the file in `src/data/prospect-images/` (create the folder) and its name in
  `observation_N_image`. PNG, JPG or WebP.
- **Booking links** carry `utm_content=<slug>`. `cta_link` overrides the link for one row; the
  button label never changes, so `cta_label` is ignored.
- `first_name` is for emails only and never appears on a page.
- `status` = `sample` adds a "Sample" banner. The two rows in the file now are made up; delete them
  before adding real leads. **Never commit real leads unless this repository is private.**

Pages are kept out of search three ways: a `noindex` meta tag, an `X-Robots-Tag` header (every
one-segment path gets it in `public/_headers`, and the site's own pages detach it), and exclusion
from the sitemap. They're never linked from the site.

To know who opened their page, set up `reference/landing-page-kit/visit_logger.gs` and put its web
app URL in `site.visitLogger.url`. The page footer then says that opens are noted.

## The content check

`scripts/check-content.mjs` runs after every build. It fails the build on:

- personal-name placeholders (`{{your_name}}`, `[Your Name]` and the like) anywhere in the output
- any name in `FORBIDDEN_NAMES`, and `Person` in structured data
- prospect rows with a reserved or duplicate slug, or a missing or malformed field
- prospect pages without `noindex`, or listed in the sitemap
- a site page that `public/_headers` would mark noindex (add a `! X-Robots-Tag` block for new pages)
- booking links without `utm_content`, duplicate titles or descriptions, pages without one `<h1>`

It warns on "audit", "wasting", "losing", "guarantee" and percentages in observations, and on
`TODO(owner)` placeholders.

To make sure your own name can never be published, add it to `.env` (git ignores this file):

```
FORBIDDEN_NAMES=First Last,Nickname
```

## Deploying to Cloudflare

The site is static files served by Workers static assets (`wrangler.jsonc`); no Worker script runs.

1. `npx wrangler login`, then `npm run deploy`.
2. In the Cloudflare dashboard, add the apex domain to the Worker as a custom domain (or add a
   `routes` entry with `custom_domain: true` in `wrangler.jsonc`).
3. Redirect `www` to the apex with a Cloudflare Redirect Rule (Rules > Redirect Rules >
   "Redirect from WWW to root"). `_redirects` can't do this because it only sees paths.
4. Create a Cloudflare Web Analytics site and put its token in `site.analytics.cloudflareToken`.

## Font

Archivo (SIL Open Font License, `public/fonts/OFL.txt`), one variable woff2 subset to Latin,
width 100–118 and weight 400–800. `scripts/subset-font.sh` rebuilds it if the type scale ever
needs a width, weight or character outside those ranges.

## Before launch

Run `npm run check:launch`. It lists every `TODO(owner)` left in `src/config/site.ts` and
`src/data/`, including the brand name, domain, booking link, Tally form, address, phone,
certifications, add-on prices, and the FAQ answers that need your confirmation.
