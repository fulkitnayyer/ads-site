// Logs prospect-page activity to the Apps Script web app set up from
// reference/landing-page-kit/visit_logger.gs. Loaded only when site.visitLogger.url is set.
//   view       the page stayed open and visible for 4+ seconds
//   engaged    the visitor scrolled, tapped, clicked or pressed a key
//   cta_click  the visitor pressed "Book a 15-minute review"
// Only the page slug and the event are sent. No cookies, no storage, no personal data.
(function () {
  var script = document.currentScript;
  var url = script && script.getAttribute('data-endpoint');
  var slug = script && script.getAttribute('data-slug');
  if (!url || !slug) return;

  var sent = {};
  function send(event) {
    if (sent[event]) return;
    sent[event] = true;
    var body = JSON.stringify({ slug: slug, event: event });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
      fetch(url, { method: 'POST', mode: 'no-cors', body: body, keepalive: true });
    } catch (e) {}
  }

  // Wait before logging a view: email link scanners often open a page for a moment and leave.
  setTimeout(function () {
    if (document.visibilityState === 'visible') send('view');
  }, 4000);

  ['scroll', 'touchstart', 'pointerdown', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function () { send('engaged'); }, { once: true, passive: true });
  });

  document.querySelectorAll('[data-track="cta"]').forEach(function (link) {
    link.addEventListener('click', function () { send('cta_click'); });
  });
})();
