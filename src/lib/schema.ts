// Structured data. Organization and Service only: never Person, and never a founder.
import { site } from '../config/site';

const isPlaceholder = (value: string) => value.includes('TODO(owner)');
const orgId = `${site.url}/#organization`;

const provider = { '@type': 'Organization', '@id': orgId, name: site.name, url: `${site.url}/` };

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    ...provider,
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
