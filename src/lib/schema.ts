// Structured data: Organization, Service and FAQPage. Never Person, and never a founder.
import { site } from '../config/site';
import { formatCount, plainText } from './text';

const isPlaceholder = (value: string) => value.includes('TODO(owner)');
const orgId = `${site.url}/#organization`;

const provider = { '@type': 'Organization', '@id': orgId, name: site.name, url: `${site.url}/` };

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    ...provider,
    description:
      `${site.offer.name}: Google Ads management for small US businesses, done by one specialist who has ` +
      `worked hands-on in more than ${formatCount(site.experience.accounts)} small-business Google Ads ` +
      'accounts across the US and Canada over three years.',
    email: site.contact.email,
    ...(isPlaceholder(site.contact.phone) ? {} : { telephone: site.contact.phone }),
    ...(isPlaceholder(site.contact.address) ? {} : { address: site.contact.address }),
    areaServed: { '@type': 'Country', name: 'United States' },
  };
}

export function serviceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${site.url}/#service`,
    name: site.offer.name,
    serviceType: 'Google Ads management',
    description:
      'Monthly Google Ads management for small US businesses: a month-1 clean-up, a weekly check, ' +
      'a monthly optimization pass and a one-page report. Month to month, no setup fee.',
    provider,
    areaServed: { '@type': 'Country', name: 'United States' },
    offers: {
      '@type': 'Offer',
      price: site.offer.price,
      priceCurrency: site.offer.currency,
      url: `${site.url}/pricing/`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: site.offer.price,
        priceCurrency: site.offer.currency,
        unitCode: 'MON',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
    },
  };
}

/** For /faq/ only: Google asks for one FAQPage per site. */
export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: plainText(answer) },
    })),
  };
}
