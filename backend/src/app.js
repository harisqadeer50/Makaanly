import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isProd } from './config/env.js';
import routes from './routes/index.js';
import seoRoutes from './routes/seo.routes.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { sanitize } from './middleware/sanitize.js';
import { csrfProtect } from './middleware/csrf.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './utils/ApiError.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY); // see TRUST_PROXY in .env.example and docs/DEPLOYMENT.md
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
      return cb(ApiError.forbidden('Origin not allowed'));
    },
  }));
  if (env.NODE_ENV !== 'test') app.use(morgan(isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitize);

  app.use('/api', apiLimiter, csrfProtect, routes);
  app.use(seoRoutes); // /robots.txt and /sitemap.xml (read-only GET pages, so no CSRF or API rate limit)
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
