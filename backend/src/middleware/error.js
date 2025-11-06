function notFound(_req, res, _next) {
  return res.status(404).json({ message: 'Not found' });
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }
  const payload = {
    message: err.message || 'Something went wrong',
  };
  if (err.details) {
    payload.details = err.details;
  }
  return res.status(status).json(payload);
}

module.exports = {
  notFound,
  errorHandler,
};
