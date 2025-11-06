const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { attachUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth');
const loanRoutes = require('./routes/loans');
const adminRoutes = require('./routes/admin');

const app = express();

const allowedOriginsConfig = config.corsOrigins || [];
const allowAnyOrigin = allowedOriginsConfig.includes('*');
const allowNullOrigin = allowedOriginsConfig.includes('null');
const exactOrigins = new Set(
  allowedOriginsConfig.filter((value) => value && value !== '*' && !value.endsWith(':*') && value !== 'null')
);
const wildcardOrigins = allowedOriginsConfig
  .filter((value) => value && value.endsWith(':*'))
  .map((value) => value.slice(0, -1)); // keep trailing colon for prefix match

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const corsOptionsDelegate = (req, callback) => {
  const requestOrigin = req.header('Origin');
  if (!requestOrigin) {
    if (allowAnyOrigin) {
      return callback(null, { origin: true, credentials: true });
    }
    if (allowNullOrigin) {
      return callback(null, { origin: 'null', credentials: true });
    }
    return callback(null, { origin: false, credentials: true });
  }
  if (requestOrigin === 'null' && allowNullOrigin) {
    return callback(null, { origin: 'null', credentials: true });
  }
  const matchesWildcard = wildcardOrigins.some((prefix) => requestOrigin.startsWith(prefix));
  if (allowAnyOrigin || exactOrigins.has(requestOrigin) || matchesWildcard) {
    return callback(null, { origin: requestOrigin, credentials: true });
  }
  return callback(new Error('Not allowed by CORS'));
};

app.use(globalLimiter);
app.use(helmet());
app.use(cors(corsOptionsDelegate));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: config.env });
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
