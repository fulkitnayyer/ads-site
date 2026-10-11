import { site } from '../config/site';

/** The only label the booking button ever has. */
export const BOOKING_LABEL = 'Book a 15-minute review';

/** Where "Get a written review" goes. */
export const WRITTEN_REVIEW_HREF = '/free-review/#written-review';

/**
 * The booking link with UTM tags. `content` is the page id on site pages ('home', 'pricing')
 * and the business slug on prospect pages.
 */
export function bookingUrl(content: string, source: 'site' | 'outreach' = 'site', base: string = site.booking.url): string {
  const url = new URL(base);
  url.searchParams.set('utm_source', source === 'site' ? 'website' : 'outreach');
  url.searchParams.set('utm_medium', source === 'site' ? 'button' : 'page');
  url.searchParams.set('utm_content', content);
  return url.toString();
}
