// The site's own pages, read from src/pages so nothing keeps a second list.
// Used by astro.config.mjs (sitemap), the prospects loader (reserved slugs) and the content check.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const PAGE_FILE = /\.(astro|md|mdx|html)$/;
const ROUTE_FILE = /\.(astro|md|mdx|html|js|ts|mjs)$/;

/** Built and reachable, but kept out of the sitemap and search. */
export const NOINDEX_PATHS = ['/thanks/', '/404/'];

function isStatic(name) {
  return !name.startsWith('_') && !name.startsWith('.') && !name.includes('[');
}

/** Every static page as a URL path with a trailing slash: '/', '/pricing/', '/legal/terms/'. */
export function sitePagePaths(root = process.cwd()) {
  const paths = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!isStatic(entry.name)) continue;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (PAGE_FILE.test(entry.name)) {
        const name = entry.name.replace(PAGE_FILE, '');
        paths.push(name === 'index' ? prefix : `${prefix}${name}/`);
      }
    }
  };
  walk(join(root, 'src/pages'), '/');
  return paths.sort();
}

/** Paths that belong in sitemap.xml: static pages minus the noindex ones. */
export function sitemapPaths(root = process.cwd()) {
  return sitePagePaths(root).filter((path) => !NOINDEX_PATHS.includes(path));
}

/** Top-level names taken by src/pages (pages, endpoints and folders), e.g. 'pricing', '404'. */
export function siteSlugs(root = process.cwd()) {
  const slugs = [];
  for (const entry of readdirSync(join(root, 'src/pages'), { withFileTypes: true })) {
    if (!isStatic(entry.name)) continue;
    if (entry.isDirectory()) slugs.push(entry.name);
    else if (ROUTE_FILE.test(entry.name)) {
      const name = entry.name.replace(ROUTE_FILE, '');
      if (name !== 'index') slugs.push(name);
    }
  }
  return slugs.sort();
}
