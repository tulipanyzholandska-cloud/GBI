// GetBizIdea — remembers where a visitor first came from, so sales can be traced to a channel
(function () {
  var KEY = 'gbi_attr';
  var attr = null;
  try {
    attr = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!attr) {
      var params = new URLSearchParams(window.location.search);
      var referrer = '';
      try {
        var host = document.referrer ? new URL(document.referrer).hostname : '';
        if (host && host !== window.location.hostname) referrer = host;
      } catch (e) {}
      attr = {
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        referrer: referrer,
        landing: window.location.pathname
      };
      localStorage.setItem(KEY, JSON.stringify(attr));
    }
  } catch (e) {}
  window.gbiAttribution = function () { return attr; };
})();
