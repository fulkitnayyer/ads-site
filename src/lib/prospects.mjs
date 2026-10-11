// Prospect rows: CSV parsing, slugs, skip rules, the row schema and wording checks.
// Shared by src/content.config.ts (builds the pages) and scripts/check-content.mjs.
// Columns and slug rules follow reference/landing-page-kit (leads_template.csv, build_pages.py).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { siteSlugs } from './site-pages.mjs';

export const PROSPECTS_CSV = 'src/data/prospects.csv';
export const PROSPECT_IMAGES_DIR = 'src/data/prospect-images';

/** Never usable as a prospect slug, on top of every top-level name in src/pages. */
export const RESERVED_SLUGS = [
  // Site pages, listed so they're reserved even before their files exist.
  'how-it-works', 'pricing', 'free-review', 'about', 'faq', 'contact', 'thanks',
  'privacy', 'terms', 'service-terms',
  // Kept free for later sections.
  'blog', 'guides', 'industries', 'resources', 'api', 'assets', 'fonts', 'admin', 'book', 'review', 'legal',
  // Paths the build or Cloudflare already use.
  '_astro', 'cdn-cgi', 'index', 'robots', 'sitemap', 'sitemap-index', 'sitemap-0', 'favicon', '404', '500',
];

/** Rows with one of these statuses get no page. */
export const SKIP_STATUSES = ['dnc', 'do not contact', 'unsubscribed', 'expired'];

/** Pages promise to stay up this long after the last email. */
export const MIN_DAYS_UP = 30;

const OBSERVATIONS = [1, 2, 3];

// Phrases that usually claim something nobody can see from outside an account.
const WORDING_RULES = [
  [/\baudit(s|ed|ing)?\b/i, 'an outside look is not an audit'],
  [/\bwast(e|es|ed|ing)\b/i, "wasted spend can't be seen from outside the account"],
  [/\blos(e|es|ing|t)\b/i, "losses can't be seen from outside the account"],
  [/\bguarantee/i, 'never imply guaranteed results'],
  [/\b\d+(\.\d+)?\s*(%|percent\b)/i, 'a percentage usually implies account data; say where it came from'],
  [/\byour (spend|budget|conversions?|cost per|cpc|quality score|ctr)\b/i, 'only visible inside their account'],
];

const COMPANY_SUFFIX =
  /[,\s]+(l\.?l\.?c\.?|inc\.?|incorporated|co\.?|corp\.?|corporation|ltd\.?|pllc|p\.?c\.?)\s*$/i;

/**
 * RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes.
 * Returns one object per record, keyed by the header row, values trimmed.
 */
export function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  const src = text.replace(/^﻿/, '');

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    if (record.some((cell) => cell.trim() !== '')) records.push({ line: recordLine, cells: record });
    record = [];
    recordLine = line;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\n') {
      line++;
      endRecord();
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (quoted) throw new Error(`a quoted field starting on line ${recordLine} is never closed`);
  if (field !== '' || record.length) endRecord();

  const [header, ...rows] = records;
  if (!header) return [];
  const columns = header.cells.map((name) => name.trim());
  return rows.map(({ line: rowLine, cells }) => {
    if (cells.length > columns.length) {
      throw new Error(`line ${rowLine} has ${cells.length} cells but the header has ${columns.length}`);
    }
    const row = Object.fromEntries(columns.map((name, i) => [name, (cells[i] ?? '').trim()]));
    return { line: rowLine, row };
  });
}

/** "Harbor Point Plumbing LLC" -> "harbor-point-plumbing". Same rules as build_pages.py. */
export function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Drops "LLC", "Inc", "P.C." and similar for display. Keeps "& Co." because it's part of the name. */
export function cleanBusinessName(name) {
  let clean = name.split(/\s+/).join(' ').trim();
  let previous;
  while (previous !== clean && !/(&|\band)\s+co\.?$/i.test(clean)) {
    previous = clean;
    clean = clean.replace(COMPANY_SUFFIX, '').replace(/[\s,]+$/, '');
  }
  return clean;
}

export function possessive(name) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

/** Straight quotes typed in a spreadsheet become typographic: don't -> don’t, "Call Today" -> “Call Today”. */
export function smartQuotes(value) {
  return value
    .replace(/(^|[\s([{—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{—–-])'/g, '$1‘')
    .replace(/'/g, '’');
}

const dateLabel = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-10-09" -> "October 9, 2026" */
export function formatDate(iso) {
  return dateLabel.format(new Date(`${iso}T00:00:00Z`));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Why a row gets no page, or '' if it gets one. */
export function skipReason(row) {
  if ((row.fit ?? '').trim().toUpperCase() === 'N') return 'fit is N';
  const status = (row.status ?? '').trim().toLowerCase();
  if (SKIP_STATUSES.includes(status)) return `status is ${status}`;
  return '';
}

const text = z.string().trim().default('');
const required = (column) => z.string({ error: `${column} is missing` }).trim().min(1, { error: `${column} is empty` });

/**
 * One prospect row as it comes out of the CSV, plus its slug. Rejects rows that can't make a
 * complete page, then reshapes them into what src/pages/[slug].astro needs. Columns not listed
 * here (email aside) are dropped, so phone numbers and notes never reach the build output.
 */
export const prospectRowSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'slug must be lowercase letters, numbers and hyphens' }),
    business_name: required('business_name'),
    email: z.string({ error: 'email is missing' }).trim().pipe(z.email({ error: 'email is not a valid address' })),
    search_term: required('search_term'),
    checked_on: z
      .string({ error: 'checked_on is missing' })
      .trim()
      .pipe(
        z.iso
          .date({ error: 'checked_on must be a date written YYYY-MM-DD', abort: true })
          .refine((iso) => iso <= todayIso(), { error: 'checked_on is in the future' }),
      ),
    city: text,
    state: text,
    search_location: text,
    search_device: text,
    observation_1_title: required('observation_1_title'),
    observation_1: required('observation_1'),
    observation_1_check: text,
    observation_1_image: text,
    observation_2_title: text,
    observation_2: text,
    observation_2_check: text,
    observation_2_image: text,
    observation_3_title: text,
    observation_3: text,
    observation_3_check: text,
    observation_3_image: text,
    cta_link: z.union([z.literal(''), z.url({ protocol: /^https$/, error: 'cta_link must be a full https:// address' })]).default(''),
    status: text,
  })
  .superRefine((row, ctx) => {
    for (const n of [2, 3]) {
      if (Boolean(row[`observation_${n}_title`]) !== Boolean(row[`observation_${n}`])) {
        ctx.addIssue({
          code: 'custom',
          path: [`observation_${n}`],
          message: `observation_${n} and observation_${n}_title must both be filled in, or both left empty`,
        });
      }
    }
    for (const n of OBSERVATIONS) {
      const image = row[`observation_${n}_image`];
      if (image && !/\.(png|jpe?g|webp)$/.test(image)) {
        ctx.addIssue({
          code: 'custom',
          path: [`observation_${n}_image`],
          message: `${image} must end in .png, .jpg or .webp (lowercase)`,
        });
      } else if (image && !existsSync(join(process.cwd(), PROSPECT_IMAGES_DIR, image))) {
        ctx.addIssue({
          code: 'custom',
          path: [`observation_${n}_image`],
          message: `${image} is not in ${PROSPECT_IMAGES_DIR}/`,
        });
      }
    }
  })
  .transform((row) => {
    const businessName = smartQuotes(cleanBusinessName(row.business_name));
    const location = row.search_location || [row.city, row.state].filter(Boolean).join(', ');
    return {
      slug: row.slug,
      businessName,
      businessPossessive: possessive(businessName),
      searchTerm: row.search_term,
      searchLocation: location,
      searchDevice: row.search_device,
      checkedOn: row.checked_on,
      checkedOnLabel: formatDate(row.checked_on),
      observations: OBSERVATIONS.filter((n) => row[`observation_${n}_title`] && row[`observation_${n}`]).map((n) => ({
        title: smartQuotes(row[`observation_${n}_title`]),
        text: smartQuotes(row[`observation_${n}`]),
        check: smartQuotes(row[`observation_${n}_check`]),
        image: row[`observation_${n}_image`],
      })),
      ctaLink: row.cta_link,
      sample: row.status.toLowerCase() === 'sample',
    };
  });

/** Wording warnings for one row's observation fields. */
export function wordingWarnings(row) {
  const warnings = [];
  for (const n of OBSERVATIONS) {
    for (const field of [`observation_${n}_title`, `observation_${n}`, `observation_${n}_short`, `observation_${n}_check`]) {
      const value = row[field] ?? '';
      for (const [rule, reason] of WORDING_RULES) {
        // "What we'd check inside your account" may name account data.
        if (field.endsWith('_check') && rule.source.startsWith('\\byour')) continue;
        const match = value.match(rule);
        if (match) warnings.push(`${field}: ${reason} ("${match[0]}")`);
      }
    }
  }
  return warnings;
}

/**
 * Reads src/data/prospects.csv and works out which rows get a page and at which slug.
 * Per-row field checks live in prospectRowSchema; this handles skips, slugs, reserved names
 * and duplicates, which need the whole file. Never throws: callers decide what to do with errors.
 */
export function readProspects(root = process.cwd()) {
  const result = { pages: [], skipped: [], errors: [], warnings: [] };
  const file = join(root, PROSPECTS_CSV);
  if (!existsSync(file)) return result;

  let records;
  try {
    records = parseCsv(readFileSync(file, 'utf8'));
  } catch (error) {
    result.errors.push(`${PROSPECTS_CSV}: ${error.message}`);
    return result;
  }

  const reserved = new Set([...RESERVED_SLUGS, ...siteSlugs(root)]);
  const used = new Map();
  const today = todayIso();

  for (const { line, row } of records) {
    const label = row.business_name || '(no business_name)';
    const where = `line ${line}, ${label}`;

    const reason = skipReason(row);
    if (reason) {
      result.skipped.push({ line, label, reason });
      const lastTouch = row.last_touch ?? '';
      if (reason === 'status is expired' && /^\d{4}-\d{2}-\d{2}$/.test(lastTouch)) {
        const days = daysBetween(lastTouch, today);
        if (days < MIN_DAYS_UP) {
          result.warnings.push(
            `${where}: marked expired ${days} day(s) after the last email (${lastTouch}). ` +
              `Pages stay up at least ${MIN_DAYS_UP} days; use unsubscribed or dnc if they asked to be removed.`,
          );
        }
      }
      continue;
    }

    const custom = (row.slug ?? '').trim();
    let slug = slugify(custom || cleanBusinessName(row.business_name ?? ''));
    if (custom && slug !== custom) result.warnings.push(`${where}: slug "${custom}" becomes "${slug}"`);
    if (!slug) {
      result.errors.push(`${where}: can't make a slug; fill in business_name or slug`);
      continue;
    }
    // Same business name twice: the later row gets the city appended, so earlier links keep working.
    if (used.has(slug) && !custom && row.city) slug = slugify(`${slug}-${row.city}`);
    if (reserved.has(slug)) {
      result.errors.push(`${where}: slug "${slug}" is reserved for the site; set another one in the slug column`);
    } else if (used.has(slug)) {
      result.errors.push(`${where}: slug "${slug}" is already used on line ${used.get(slug)}; set a unique slug in the slug column`);
    }
    used.set(slug, line);

    for (const warning of wordingWarnings(row)) result.warnings.push(`${where}: ${warning}`);
    if (row.cta_label && row.cta_label !== 'Book a 15-minute review') {
      result.warnings.push(`${where}: cta_label is ignored; the button always says "Book a 15-minute review"`);
    }
    result.pages.push({ line, slug, row: { ...row, slug } });
  }
  return result;
}
