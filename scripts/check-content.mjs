#!/usr/bin/env node
// Content and honesty checks. Runs after `astro build` (npm run build) or on its own (npm run check).
//
// Fails on: personal-name placeholders or forbidden names in the output, a Person in structured
// data, prospect rows with a reserved/duplicate slug or a missing required field, prospect pages
// without noindex or listed in the sitemap, site pages left noindexed by public/_headers, and
// booking links without utm_content.
// Warns on: wording in prospect observations ("audit", "wasting", "losing", "guarantee",
// percentages), pages marked expired too soon, and TODO(owner) placeholders.
//
//   node scripts/check-content.mjs            # warnings for placeholders
//   node scripts/check-content.mjs --launch   # placeholders and sample pages fail too
//
// Names that must never appear (the owner's own name, for instance) go in .env, which git ignores:
//   FORBIDDEN_NAMES=First Last,Nickname
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { site } from '../src/config/site.ts';
import { PROSPECTS_CSV, prospectRowSchema, readProspects } from '../src/lib/prospects.mjs';
import { NOINDEX_PATHS, sitemapPaths } from '../src/lib/site-pages.mjs';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const launch = process.argv.includes('--launch');

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const placeholder = (message) => (launch ? fail : warn)(message);

// Placeholder syntax for a person's name. Sentence-case copy like "your name" is fine.
const NAME_PLACEHOLDERS = [
  /\{\{\s*\w*name\w*\s*\}\}/i,
  /\{\s*(first|last|full|your|owner|founder)_?name\s*\}/i,
  /\[(your|first|last|full|owner|founder)?\s*name\]/i,
  /<(your|first|full|owner|founder)\s*name>/i,
  /\b(YOUR|FIRST|LAST|FULL|OWNER|FOUNDER)_NAME\b/,
  /\*\|FNAME\|\*/,
  /%FIRSTNAME%/i,
  /\b(Your|Founder|Owner|First) Name\b/,
  /\b(John|Jane) (Doe|Smith)\b/,
  /\bAlex Rivera\b/, // the reference kit's sample sender
  /\blorem ipsum\b/i,
];

const PLACEHOLDER_TOKENS = ['TODO(owner)', 'TALLY_FORM_ID', 'working-name', 'Working Name'];

function readEnvNames() {
  let raw = process.env.FORBIDDEN_NAMES ?? '';
  const envFile = join(ROOT, '.env');
  if (!raw && existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('FORBIDDEN_NAMES='));
    raw = line ? line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, '') : '';
  }
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordPattern = (text) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(text)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');

// 1. Prospect rows -------------------------------------------------------------------------------

const prospects = readProspects(ROOT);
const parsed = new Map();
for (const message of prospects.errors) fail(`${PROSPECTS_CSV}: ${message}`);
for (const message of prospects.warnings) warn(`${PROSPECTS_CSV}: ${message}`);
for (const { line, slug, row } of prospects.pages) {
  const result = prospectRowSchema.safeParse(row);
  if (result.success) parsed.set(slug, result.data);
  else {
    for (const issue of result.error.issues) fail(`${PROSPECTS_CSV}: line ${line} (${slug}): ${issue.message}`);
  }
  if (launch && (row.status ?? '').toLowerCase() === 'sample') {
    fail(`${PROSPECTS_CSV}: line ${line} (${slug}) is a sample row; delete it before launch`);
  }
}
const prospectSlugs = new Set(prospects.pages.map((page) => page.slug));

// 2. Source placeholders --------------------------------------------------------------------------

// Every marker in config, data and Markdown counts. In code, only comments do: a string like the
// Tally placeholder message only renders while an ID is missing, and the output scan catches that.
const countTodos = (file) => {
  const text = readFileSync(file, 'utf8');
  const path = relative(ROOT, file);
  if (/^src\/(config|data)\//.test(path) || path.endsWith('.md')) return (text.match(/TODO\(owner\)/g) ?? []).length;
  return text.split('\n').filter((line) => /(\/\/|\/\*|<!--).*TODO\(owner\)/.test(line)).length;
};
const todoSources = walk(join(ROOT, 'src'))
  .filter((file) => /\.(ts|mjs|js|astro|md|ya?ml|csv)$/.test(file))
  .map((file) => [relative(ROOT, file), countTodos(file)])
  .filter(([, count]) => count > 0);
if (todoSources.length) {
  placeholder(
    `TODO(owner) items left to confirm: ${todoSources.map(([file, count]) => `${file} (${count})`).join(', ')}`,
  );
}

// 3. Build output ---------------------------------------------------------------------------------

if (!existsSync(DIST)) {
  fail('dist/ not found: run `npx astro build` first (npm run build does both)');
} else {
  const files = walk(DIST);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const forbidden = readEnvNames();

  // Names and placeholders, anywhere in the output: text, attributes, comments, structured data.
  const placeholderHits = new Map();
  for (const file of files.filter((f) => /\.(html|xml|txt|js|json|svg)$/.test(f))) {
    const content = readFileSync(file, 'utf8');
    const where = relative(ROOT, file);
    const nameMatch = NAME_PLACEHOLDERS.map((pattern) => content.match(pattern)).find(Boolean);
    if (nameMatch) fail(`${where}: personal-name placeholder "${nameMatch[0]}"`);
    for (const name of forbidden) {
      if (wordPattern(name).test(content)) fail(`${where}: contains a forbidden name from FORBIDDEN_NAMES`);
    }
    if (/"@type"\s*:\s*"Person"/.test(content)) fail(`${where}: structured data uses Person`);
    for (const token of PLACEHOLDER_TOKENS) {
      if (content.includes(token)) placeholderHits.set(token, [...(placeholderHits.get(token) ?? []), where]);
    }
  }
  for (const [token, where] of placeholderHits) {
    placeholder(`"${token}" still appears in ${where.length} built file(s), e.g. ${where.slice(0, 3).join(', ')}`);
  }

  // Sitemap: exactly the site's indexable pages.
  const sitemapUrls = files
    .filter((file) => /sitemap-\d+\.xml$/.test(file))
    .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const listed = new Set(sitemapUrls.map((url) => new URL(url).pathname));
  if (!sitemapUrls.length) fail('dist: no sitemap found');
  for (const path of listed) {
    if (prospectSlugs.has(path.split('/')[1])) fail(`sitemap lists the prospect page ${path}`);
    if (NOINDEX_PATHS.includes(path)) fail(`sitemap lists ${path}, which should be noindex`);
  }
  for (const path of sitemapPaths(ROOT)) {
    if (!listed.has(path)) fail(`sitemap is missing ${path}`);
  }

  // Pages.
  const titles = new Map();
  const descriptions = new Map();
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const where = relative(ROOT, file);
    const path = `/${relative(DIST, file).replace(/index\.html$/, '').replace(/\.html$/, '/')}`;
    const slug = path.split('/')[1];
    const isProspect = path === `/${slug}/` && prospectSlugs.has(slug);
    const noindex = /<meta name="robots" content="noindex/.test(html);
    const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1s !== 1) fail(`${where}: has ${h1s} <h1> elements; every page needs exactly one`);

    const bookingLinks = [...html.matchAll(/<a\b[^>]*data-track="cta"[^>]*>/g)].map((m) => m[0]);
    for (const link of bookingLinks) {
      const href = (link.match(/href="([^"]+)"/) ?? [])[1]?.replace(/&amp;/g, '&') ?? '';
      const content = href ? new URL(href).searchParams.get('utm_content') : null;
      if (!content) fail(`${where}: a booking link has no utm_content`);
      else if (isProspect && content !== slug) fail(`${where}: booking link carries utm_content=${content}, not ${slug}`);
    }

    if (isProspect) {
      if (!noindex) fail(`${where}: prospect page without a noindex meta tag`);
      if (/rel="canonical"/.test(html)) fail(`${where}: prospect page has a canonical link`);
      // The contact's first name is for emails only. It may legitimately be part of the
      // business name or the search term, so those are removed before looking for it.
      const row = prospects.pages.find((page) => page.slug === slug)?.row ?? {};
      const firstName = (row.first_name ?? '').trim();
      const data = parsed.get(slug);
      if (firstName && data) {
        const text = [data.businessName, data.searchTerm].reduce((t, part) => t.split(part).join(' '), textOf(html));
        if (wordPattern(firstName).test(text)) fail(`${where}: shows the contact's first name; pages never show a personal name`);
      }
    } else if (path !== '/404/') {
      if (noindex && !NOINDEX_PATHS.includes(path)) fail(`${where}: site page marked noindex`);
      if (!noindex && NOINDEX_PATHS.includes(path)) fail(`${where}: should carry a noindex meta tag`);
      const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '';
      const description = (html.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? '';
      if (!title) fail(`${where}: no <title>`);
      if (!description) fail(`${where}: no meta description`);
      if (titles.has(title)) fail(`${where}: same <title> as ${titles.get(title)}`);
      if (descriptions.has(description)) fail(`${where}: same description as ${descriptions.get(description)}`);
      titles.set(title, where);
      descriptions.set(description, where);
    }
  }

  // Every prospect row has its page.
  for (const slug of prospectSlugs) {
    if (!existsSync(join(DIST, slug, 'index.html'))) fail(`dist/${slug}/index.html is missing`);
  }

  // public/_headers: one-segment paths are noindex unless detached; only site pages are detached.
  const headersFile = join(DIST, '_headers');
  if (!existsSync(headersFile)) {
    fail('dist/_headers is missing');
  } else {
    const headers = readFileSync(headersFile, 'utf8');
    const rules = [];
    let current = null;
    for (const line of headers.split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      if (!/^\s/.test(line)) rules.push((current = { path: line.trim(), lines: [] }));
      else current?.lines.push(line.trim());
      if (line.length > 2000) fail(`_headers: a line is longer than 2,000 characters`);
    }
    if (rules.length > 100) fail(`_headers: ${rules.length} rules; Cloudflare allows 100`);
    const noindexRule = rules.find((r) => r.path === '/:slug/' && r.lines.some((l) => /^X-Robots-Tag:.*noindex/i.test(l)));
    if (!noindexRule) fail('_headers: the /:slug/ X-Robots-Tag noindex rule is missing');
    const detached = new Set(rules.filter((r) => r.lines.includes('! X-Robots-Tag')).map((r) => r.path));
    for (const path of sitemapPaths(ROOT)) {
      if (/^\/[^/]+\/$/.test(path) && !detached.has(path)) {
        fail(`_headers: ${path} gets X-Robots-Tag noindex; add "${path}" with "! X-Robots-Tag"`);
      }
    }
    for (const path of detached) {
      if (prospectSlugs.has(path.split('/')[1])) fail(`_headers: prospect page ${path} is detached from noindex`);
      if (NOINDEX_PATHS.includes(path)) fail(`_headers: ${path} must stay noindex`);
    }
    const csp = (headers.match(/Content-Security-Policy: ([^\n]+)/) ?? [])[1] ?? '';
    const connect = (csp.match(/connect-src ([^;]+)/) ?? [])[1] ?? '';
    if (site.visitLogger.url && !connect.includes(new URL(site.visitLogger.url).origin)) {
      fail(`_headers: connect-src doesn't allow the visit logger (${new URL(site.visitLogger.url).origin})`);
    }
  }
}

// Report -----------------------------------------------------------------------------------------

const pages = prospects.pages.length;
console.log(`\nContent check${launch ? ' (launch)' : ''}: ${pages} prospect page(s), ${prospects.skipped.length} row(s) skipped`);
for (const message of warnings) console.log(`  warn  ${message}`);
for (const message of errors) console.log(`  FAIL  ${message}`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s) to fix.\n`);
  process.exit(1);
}
console.log(`\nPassed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.\n`);
