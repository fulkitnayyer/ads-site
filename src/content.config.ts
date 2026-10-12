import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineCollection } from 'astro:content';
import type { Loader, LoaderContext } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';
import { PROSPECTS_CSV, prospectRowSchema, readProspects } from './lib/prospects.mjs';
import { fillTokensDeep } from './lib/text';

type Entry = { id: string; data: Record<string, unknown> };

/**
 * Loads entries and validates each against the collection schema. Unlike Astro's file()
 * loader, a file that can't be read or parsed fails the build instead of logging and moving on.
 */
function strictLoader(name: string, path: string, read: (context: LoaderContext) => Promise<Entry[]>): Loader {
  return {
    name,
    async load(context) {
      const { store, parseData, watcher, logger } = context;
      const sync = async () => {
        const entries = await read(context);
        const parsed = [];
        for (const { id, data } of entries) parsed.push({ id, data: await parseData({ id, data }) });
        store.clear();
        for (const entry of parsed) store.set(entry);
      };
      await sync();
      const file = resolve(path);
      watcher?.add(file);
      watcher?.on('change', async (changed) => {
        if (resolve(changed) !== file) return;
        try {
          await sync();
          logger.info(`Reloaded ${path}`);
        } catch (error) {
          logger.error(`${path}: ${error instanceof Error ? error.message : error}`);
        }
      });
    },
  };
}

const yamlFile = (path: string) => async () => fillTokensDeep(parseYaml(await readFile(path, 'utf8')));

const item = z.object({ title: z.string().min(1), detail: z.string().min(1) });

const offer = defineCollection({
  loader: strictLoader('offer-yaml', 'src/data/offer.yaml', async () => [
    { id: 'offer', data: await yamlFile('src/data/offer.yaml')() },
  ]),
  schema: z.object({
    included: z.array(item).min(1),
    not_included: z.array(z.string().min(1)).min(1),
    promises: z.array(item).length(3),
    cant_promise: z.array(z.string().min(1)).min(1),
    fit: z.object({ good: z.array(z.string().min(1)).min(1), poor: z.array(z.string().min(1)).min(1) }),
    limits: z.array(z.string().min(1)).min(1),
    plus: z.string().min(1),
    addons: z.array(
      z.object({
        name: z.string().min(1),
        detail: z.string().min(1),
        /** Whole US dollars. null until the owner sets it. */
        price: z.number().int().positive().nullable(),
        /** What one price covers, e.g. "campaign". Omit for a single job. */
        per: z.string().min(1).optional(),
      }),
    ),
  }),
});

const faq = defineCollection({
  loader: strictLoader('faq-yaml', 'src/data/faq.yaml', async () => {
    const items = await yamlFile('src/data/faq.yaml')();
    if (!Array.isArray(items)) throw new Error('src/data/faq.yaml must be a list of questions');
    // getCollection() sorts by id, so keep the file's order for the FAQ page.
    return items.map(({ id, ...data }, order) => ({ id: String(id), data: { ...data, order } }));
  }),
  schema: z.object({ question: z.string().min(1), answer: z.string().min(1), order: z.number().int() }),
});

/** "Problems fixed again and again" on About. Patterns and the kind of fix, never client results. */
const problems = defineCollection({
  loader: strictLoader('problems-yaml', 'src/data/problems.yaml', async () => {
    const items = await yamlFile('src/data/problems.yaml')();
    if (!Array.isArray(items)) throw new Error('src/data/problems.yaml must be a list of problems');
    // Keep the file's order: it's the research ranking.
    return items.map(({ id, ...data }, order) => ({ id: String(id), data: { ...data, order } }));
  }),
  schema: z.object({
    title: z.string().min(1),
    /** Typical owner wording, shown as a one-line label. Never a testimonial. */
    quote: z.string().min(1).optional(),
    cause: z.string().min(1),
    fix: z.string().min(1),
    order: z.number().int(),
  }),
});

/**
 * One page per publishable row of src/data/prospects.csv, at /<slug>/.
 * Skipped rows (fit=N, dnc, unsubscribed, expired) get no page. A reserved or duplicate slug,
 * or a row missing a required field, fails the build.
 */
const prospects = defineCollection({
  loader: strictLoader('prospects-csv', PROSPECTS_CSV, async ({ logger }) => {
    const { pages, skipped, errors } = readProspects();
    if (errors.length) throw new Error(`${PROSPECTS_CSV} needs fixing:\n  - ${errors.join('\n  - ')}`);
    for (const { line, label, reason } of skipped) logger.info(`No page for line ${line}, ${label}: ${reason}`);
    return pages.map(({ slug, row }) => ({ id: slug, data: row }));
  }),
  schema: prospectRowSchema,
});

export const collections = { offer, faq, problems, prospects };
