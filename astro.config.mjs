// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/config/site.ts';
import { sitemapPaths } from './src/lib/site-pages.mjs';

// Only the site's own pages go in the sitemap. Prospect pages, /thanks/ and 404 never do.
const listed = new Set(sitemapPaths());

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // One HTML request per page: the CSS is small enough to inline everywhere.
    inlineStylesheets: 'always',
  },
  // Astro 7 defaults to 'jsx', which can drop spaces between inline elements in prose.
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: (page) => listed.has(new URL(page).pathname),
    }),
  ],
});
