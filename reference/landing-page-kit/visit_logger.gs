/**
 * Visit logger for your personalized landing pages.
 *
 * Logs three events per page into a "Visits" tab of your lead-tracker Google Sheet:
 *   view       the page stayed open and visible for 4+ seconds
 *   engaged    the visitor scrolled, tapped or clicked
 *   cta_click  the visitor pressed "Book a 15-minute review"
 * Only the page slug, the event and a timestamp are stored. No IP address, no cookies.
 *
 * Setup (5 minutes):
 *   1. Open your lead-tracker Google Sheet > Extensions > Apps Script.
 *   2. Replace the editor's contents with this file. Set NOTIFY_EMAIL if you want alerts.
 *   3. Deploy > New deployment > type "Web app".
 *      Execute as: Me.  Who has access: Anyone.  Deploy, then authorize.
 *   4. Copy the Web app URL (ends in /exec) into config.json as "visit_logger_url".
 *   5. Rebuild your pages with build_pages.py and re-upload them.
 *
 * Note: email security scanners sometimes open links seconds after delivery.
 * A "view" within a minute of sending, with no "engaged", is probably a scanner.
 */

const SHEET_NAME = 'Visits';
const NOTIFY_EMAIL = '';            // e.g. 'you@yourbrand.com' to get an email on engaged / cta_click
const ALLOWED_EVENTS = ['view', 'engaged', 'cta_click'];

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const slug = String(data.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
    const event = ALLOWED_EVENTS.indexOf(data.event) >= 0 ? data.event : '';
    if (!slug || !event) return ContentService.createTextOutput('ignored');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(['timestamp', 'slug', 'event']);
    sheet.appendRow([new Date(), slug, event]);

    if (NOTIFY_EMAIL && event !== 'view') notifyOnce_(slug, event);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  }
}

// Send at most one alert per page per event every 6 hours.
function notifyOnce_(slug, event) {
  const cache = CacheService.getScriptCache();
  const key = slug + ':' + event;
  if (cache.get(key)) return;
  cache.put(key, '1', 6 * 60 * 60);
  const what = event === 'cta_click' ? 'clicked "Book a 15-minute review" on' : 'is reading';
  MailApp.sendEmail(NOTIFY_EMAIL, 'Page activity: ' + slug,
    'Someone ' + what + ' the page /' + slug + ' just now. Good moment for a call.');
}
