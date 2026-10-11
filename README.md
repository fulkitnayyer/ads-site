# Ads Upkeep website

A small static site that sells one service, Ads Upkeep (Google Ads management, $179 a month),
and hosts personalized prospect pages for cold outreach. The plan and all the rules are in
[CLAUDE.md](CLAUDE.md).

**Status:** every page in the brief is built. The legal pages (privacy, website terms, service
terms) are plain-English drafts with `TODO(owner)` markers; have them checked before launch.

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
| Legal pages | `src/pages/privacy.md`, `terms.md`, `service-terms.md` (business name, contact details and governing state come from `site.ts`; the service terms' price and scope come from `offer.yaml`) |

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

The site is static files served by Workers static assets (`wrangler.jsonc`); no Worker script
runs. Cloudflare builds from GitHub and deploys every push to `main`. Other branches get their own
preview links.

One-time setup, in the Cloudflare dashboard:

1. **Domain.** Register adsmechanic.com under Domain Registration > Register Domains, so it's
   active in the same account as the site.
2. **Connect the repository.** Workers & Pages > Create application > next to "Import a
   repository", Get started. Connect GitHub and choose `fulkitnayyer/ads-site`. Keep the name
   `ads-site` (it must match `name` in `wrangler.jsonc`), set the build command to
   `npm run build`, keep the deploy command `npx wrangler deploy`, then Save and Deploy. The
   first build gives a `.workers.dev` address.
3. **Custom domain.** On the Worker: Settings > Domains & Routes > Add > Custom Domain, enter
   `adsmechanic.com`, then Add Custom Domain.
4. **www.** In the domain's DNS records, add type `A`, name `www`, IPv4 address `192.0.2.0`,
   proxied. Then add a redirect rule: wildcard request URL `https://www.adsmechanic.com/*`, target
   URL `https://adsmechanic.com/${1}`, status code 301, preserve query string. `_redirects` can't
   do this because it only sees paths.
5. **Analytics.** Add adsmechanic.com under Web Analytics and put its token in
   `site.analytics.cloudflareToken`.
6. **Email.** Under the domain's Email Routing, forward hello@adsmechanic.com to your inbox.
7. **Bookings and forms.** In Cal.com, set the review event to redirect to
   `https://adsmechanic.com/thanks/` after booking. In Tally, set both forms to redirect there
   when they're sent.

Once adsmechanic.com works, set `"workers_dev": false` in `wrangler.jsonc` so the site has only
one address. Deploys then report "No targets deployed", which is expected: the custom domain is
managed in the dashboard and Wrangler leaves it alone.

To deploy from your own computer instead: `npx wrangler login`, then `npm run deploy`.

## Font

Archivo (SIL Open Font License, `public/fonts/OFL.txt`), one variable woff2 subset to Latin,
width 100–118 and weight 400–800. `scripts/subset-font.sh` rebuilds it if the type scale ever
needs a width, weight or character outside those ranges.

## Before launch

Run `npm run check:launch`. It lists every `TODO(owner)` left: in `src/config/site.ts` and
`src/data/`, in the legal Markdown, and in code comments. That covers the brand name, domain,
booking link, Tally forms, address, phone, hours, certifications, legal entity and governing state,
add-on prices, the FAQ answers and legal terms that need your confirmation, and the Google Ads menu
names quoted on How it works, Free review and Thanks.
