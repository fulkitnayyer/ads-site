/**
 * Brand, prices, contact details, IDs and URLs. They live here and nowhere else.
 *
 * - Renaming the business is one edit: `name` below.
 * - Placeholders are marked TODO(owner). `npm run build` warns while any of them reach a page;
 *   `npm run check:launch` fails until they're all replaced.
 * - Never put a founder or personal name in this file or anywhere else in the site.
 */

export const site = {
  name: 'Ads Mechanic',

  // The production domain, apex only (www redirects to it). No trailing slash.
  url: 'https://adsmechanic.com',

  offer: {
    name: 'Ads Upkeep',
    /** USD per month, month to month. */
    price: 179,
    plusName: 'Upkeep Plus',
    /** Upkeep Plus starting price, USD per month. */
    plusFrom: 349,
    currency: 'USD',
  },

  booking: {
    // The Cal.com event link for the 15-minute review.
    url: 'https://cal.com/adsmechanic/15min',
  },

  tally: {
    // TODO(owner): Tally form IDs (the part after tally.so/r/). Set each form to redirect to /thanks/.
    contactFormId: 'TALLY_FORM_ID',
    // Asks for name, email, business, website and Google Ads customer ID.
    writtenReviewFormId: 'TALLY_FORM_ID',
  },

  analytics: {
    // TODO(owner): Cloudflare Web Analytics token. Empty means no analytics script is loaded.
    cloudflareToken: '',
  },

  visitLogger: {
    // TODO(owner): Apps Script web app URL (ends in /exec), set up from
    // reference/landing-page-kit/visit_logger.gs. Empty means prospect pages log nothing.
    // If the host isn't script.google.com, add it to connect-src in public/_headers.
    url: '',
  },

  contact: {
    // For now. Read-only Google Ads invitations for written reviews go to this address, so it needs
    // a Google account too (one can be created on an existing non-Gmail address).
    email: 'adsmechanic@outlook.com',
    // TODO(owner): business phone, written as it should appear, e.g. '(555) 010-0000'.
    phone: 'TODO(owner): business phone',
    // TODO(owner): postal address (street, city, state ZIP), shown on Contact and the legal pages, not the footer.
    address: 'TODO(owner): business postal address',
    hours: 'Monday to Friday, 9 a.m. to 5 p.m. US Eastern',
  },

  /** Shown in the key details at the top of the legal pages, which never name the business themselves. */
  legal: {
    // A company or registered trade name, never a personal name. When it matches `name`, the
    // legal pages show it once.
    // TODO(owner): Ads Mechanic is a trade name, not yet registered. Update this once the business is registered.
    entity: 'Ads Mechanic',
    /** The law that governs the website and service terms. */
    governingLaw: 'The laws of India',
  },

  /**
   * Experience claims the owner has confirmed (the list is in CLAUDE.md); don't add to them.
   * They describe "one specialist" and never a name, an employer or a client.
   */
  experience: {
    /**
     * Small-business Google Ads accounts worked in hands-on: 150 to 200 new businesses a quarter
     * for 3 years, so 1,800 to 2,400. Pages show it as "2,000+" and "more than 2,000".
     * Say "worked hands-on in", never "managed": most of it was setup and optimization work.
     */
    accounts: 2000,
    campaignTypes: ['Search', 'Performance Max', 'Demand Gen', 'Display', 'Shopping', 'Video'],
  },

  /**
   * Google Skillshop certifications. Keep only ones that are currently valid.
   * None are listed yet, so About hides the block until certifications are renewed and added here.
   */
  certifications: [] as readonly string[],
} as const;

export type Site = typeof site;
