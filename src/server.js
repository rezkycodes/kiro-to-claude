/**
 * Express App — Anthropic-compatible API proxied to AWS CodeWhisperer via Kiro.
 *
 * This module only wires up middleware and delegates all routing to
 * ./routes/index.js. Route handlers live under ./routes, domain logic under
 * ./kiro, ./auth, ./config, and presentation under ./ui.
 */

import express from 'express';
import cors from 'cors';
import { REQUEST_BODY_LIMIT } from './constants.js';
import { logger } from './utils/logger.js';
import { registerRoutes } from './routes/index.js';

const app = express();

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

// Support an ANTHROPIC_BASE_URL that already includes "/v1": the Anthropic SDK
// appends "/v1/messages", which would otherwise produce "/v1/v1/messages".
// Collapse a leading duplicate "/v1" so both base URL styles work.
app.use((req, res, next) => {
    if (req.url.startsWith('/v1/v1/')) {
        req.url = req.url.slice(3);
    }
    next();
});

// Request logging.
app.use((req, res, next) => {
    logger.info(`[${req.method}] ${req.path}`);
    next();
});

// ---- Routes ----
registerRoutes(app);

export default app;
