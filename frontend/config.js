// Frontend runtime configuration resolver
// Priority (highest → lowest):
// 1) window.API_BASE_URL (hard override in page)
// 2) window.ENV.API_BASE_URL (from optional env.js)
// 3) <meta name="api-base-url" content="..."> (in index.html)
// 4) Same-origin '/api' when not on localhost
// 5) Fallback to local dev: http://localhost:4000/api

(function resolveApiBase() {
  const defaultApiBase = 'http://localhost:4000/api';
  const envApiBase = window.ENV && window.ENV.API_BASE_URL;
  window.API_BASE_URL = envApiBase || defaultApiBase;
})();
