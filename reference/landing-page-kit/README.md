# Personalized landing page kit

One short page per lead, at `yourbrand.com/<business-slug>/`, showing 2–3 things you saw from outside their Google ads, your offer, and one button: **Book a 15-minute review**.

Each page is a single self-contained HTML file of about 20 KB (CSS inlined, no JavaScript framework), so it loads fast if a prospect speed-tests it.

## What's in the box

| File | What it's for |
| --- | --- |
| `template.html` | The page, with `{{placeholders}}` and `<!--if:field-->…<!--endif:field-->` blocks that disappear when a field is empty |
| `styles.css` | Compiled Tailwind CSS that gets inlined into every page |
| `input.css`, `tailwind.config.js`, `package.json` | Only needed if you change the design (see below) |
| `build_pages.py` | Builds the pages and the email merge file from your CSV (Python 3.9+, no installs) |
| `config.json` | Your details: name, business, address, booking link, price, true credentials |
| `config.sample.json`, `sample_leads.csv` | Made-up data to try the build |
| `leads_template.csv` | Empty lead tracker with every enrichment column |
| `visit_logger.gs` | Optional Google Apps Script that logs page opens into your Sheet |

## Quick start

```bash
# 1. Try it with the made-up sample
python3 build_pages.py --leads sample_leads.csv --config config.sample.json --out sample_dist
open sample_dist/harbor-point-plumbing/index.html     # or double-click the file

# 2. Fill in config.json (the build refuses to run while it has EDIT placeholders)

# 3. Copy leads_template.csv to leads.csv, enrich leads, then build
python3 build_pages.py
```

The build prints every page URL, lists skipped rows with the reason, and flags wording that claims something you can't see from outside ("audit", "wasting", "losing", "guarantee", percentages). Fix those before you send.

## CSV columns the page uses

| Column | Required | Notes |
| --- | --- | --- |
| `business_name` | yes | "LLC", "Inc", "P.C." are stripped for display |
| `email` | yes | Goes into `outreach_merge.csv` |
| `search_term` | yes | Shown big in the hero, exactly as you searched it |
| `checked_on` | yes | `YYYY-MM-DD`, the day you looked |
| `observation_1_title`, `observation_1` | yes | Title is highlighted; text is 1–3 sentences |
| `observation_2_*`, `observation_3_*` | no | Leave blank to show fewer; the headline adjusts ("Two things…") |
| `observation_N_short` | for email | 12 words or fewer, used in emails 1 and 2 |
| `observation_N_check` | no | "What I'd check inside your account" line |
| `observation_N_image` | no | Screenshot file name inside `images/`; copied next to the page |
| `first_name` | no | "Hi Dana," when present, "Hi," when not |
| `search_location`, `search_device` | no | Defaults to `city, state`; e.g. "a phone" |
| `slug` | no | Override the URL slug; otherwise made from the business name |
| `cta_link` | no | Override the booking link for one lead |
| `cta_label` | no | Override the button text for one lead (for the CTA A/B test); default comes from `config.json` |
| `fit`, `status` | no | `fit=N` or `status=dnc/unsubscribed` rows are skipped |

## Hosting

Upload the whole `dist/` folder to a static host on a subdomain or path of your main brand domain:

- **Cloudflare Pages** (free, commercial use allowed): Workers & Pages > Create > Pages > Upload assets > drop `dist/`.
- **Netlify** (free tier): drag `dist/` onto app.netlify.com/drop, then attach your domain.
- Avoid Vercel's free Hobby plan for this: it's for non-commercial use only.

`dist/_headers` sends `X-Robots-Tag: noindex` on both hosts, and every page also carries a `noindex` meta tag, so pages stay out of search results. Rebuild and re-upload after each batch. Leave a page up for at least 30 days, since email 4 promises that, then drop the row (or set `status`) and rebuild.

## Knowing who opened their page

1. Follow the setup steps at the top of `visit_logger.gs`.
2. Put the web app URL in `config.json` as `visit_logger_url` and rebuild.
3. Opens show up in a **Visits** tab: `view`, `engaged`, `cta_click`. Set `NOTIFY_EMAIL` to get an email when someone engages, which is the best moment to call.

The footer tells visitors the page notes when it's opened, without cookies. Keep that line if you use the logger.

## Changing the design

```bash
npm install
npx tailwindcss -c tailwind.config.js -i input.css -o styles.css --minify
```

Colors live in `tailwind.config.js` (`paper`, `ink`, `slate`, `rule`, `marker`). Rebuild the pages afterwards.

## Honesty rules the template is built around

- Only list credentials in `config.json` that you can back up. No client logos, results or testimonials until you have real, permitted ones.
- Every observation is something any searcher could see, with the date you saw it.
- The "What I can't see from here" box stays on every page.
- Never click a prospect's ad to check it; it costs them money. Type the landing page URL instead.
