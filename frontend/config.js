// Frontend runtime configuration resolver
// Priority (highest → lowest):
// 1) window.API_BASE_URL (hard override in page)
// 2) window.ENV.API_BASE_URL (from optional env.js)
// 3) <meta name="api-base-url" content="..."> (in index.html)
// 4) Same-origin '/api' when not on localhost
// 5) Fallback to local dev: http://localhost:4000/api

(function resolveApiBase() {
  try {
    var explicit = window.API_BASE_URL;
    if (explicit && typeof explicit === 'string') {
      window.API_BASE_URL = explicit;
      return;
    }

    var env = (window.ENV && (window.ENV.API_BASE_URL || window.ENV.PUBLIC_API_BASE_URL)) || null;
    if (env && typeof env === 'string') {
      window.API_BASE_URL = env;
      return;
    }

    var meta = document.querySelector('meta[name="api-base-url"]');
    if (meta && meta.content) {
      window.API_BASE_URL = meta.content;
      return;
    }

    var isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    if (!isLocal && window.location.origin) {
      window.API_BASE_URL = window.location.origin.replace(/\/$/, '') + '/api';
      return;
    }

    window.API_BASE_URL = 'http://localhost:4000/api';
  } catch (_e) {
    window.API_BASE_URL = 'http://localhost:4000/api';
  }
})();
