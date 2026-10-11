import { site } from '../config/site';

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

/** Tokens YAML copy can use, so prices and names stay in site.ts. */
const TOKENS: Record<string, string> = {
  price: money(site.offer.price),
  plusFrom: money(site.offer.plusFrom),
  offer: site.offer.name,
  plus: site.offer.plusName,
};

/** Replaces {price}-style tokens. Fails the build on a token that doesn't exist. */
export function fillTokens(text: string): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = TOKENS[key];
    if (value === undefined) throw new Error(`Unknown token ${match} in "${text}"`);
    return value;
  });
}

/** Applies fillTokens to every string inside parsed YAML. */
export function fillTokensDeep<T>(value: T): T {
  if (typeof value === 'string') return fillTokens(value) as T;
  if (Array.isArray(value)) return value.map(fillTokensDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillTokensDeep(item)])) as T;
  }
  return value;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Plain text with [label](href) links, as safe HTML. */
export function inlineHtml(text: string): string {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    html += escapeHtml(text.slice(last, match.index));
    html += `<a href="${escapeHtml(match[2])}">${escapeHtml(match[1])}</a>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
}

/** Same text without link markup, for structured data. */
export function plainText(text: string): string {
  return text.replace(LINK, '$1');
}

/** Splits on line breaks left in a folded YAML scalar. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatMoney(amount: number): string {
  return money(amount);
}
