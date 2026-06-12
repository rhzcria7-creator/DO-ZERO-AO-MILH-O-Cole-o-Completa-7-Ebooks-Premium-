import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { config } from "./config/env.js";
import { checkoutRouter } from "./routes/checkout.js";
import { webhookRouter } from "./routes/webhook.js";
import { downloadRouter } from "./routes/download.js";
import { purchaseRouter } from "./routes/purchase.js";
import { newsletterRouter } from "./routes/newsletter.js";
import { healthRouter } from "./routes/health.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler } from "./middleware/error-handler.js";

// Logger
const logger = winston.createLogger({
  level: config.NODE_ENV === "production" ? "warn" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (config.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }));
}

const app = express();

// ============================================================
// OPEN REDIRECT PROTECTION
// ============================================================
const ALLOWED_REDIRECT_PATTERNS = [
  /^https:\/\/dozeroaomilhao\.com/,
  /^https:\/\/www\.dozeroaomilhao\.com/,
  /^https:\/\/api\.dozeroaomilhao\.com/,
];

app.use((req, res, next) => {
  // Validar query parameter 'returnTo' para evitar open redirect
  const returnTo = req.query.returnTo as string;
  if (returnTo) {
    let isAllowed = false;
    for (const pattern of ALLOWED_REDIRECT_PATTERNS) {
      if (pattern.test(returnTo)) {
        isAllowed = true;
        break;
      }
    }
    if (!isAllowed && !returnTo.startsWith("/")) {
      logger.warn("Blocked open redirect attempt", { returnTo, ip: req.ip });
      req.query.returnTo = undefined;
    }
  }
  next();
});

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// 1. HTTPS redirect (production only)
app.use((req, res, next) => {
  if (config.NODE_ENV === "production" && !req.secure && config.TRUST_PROXY) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// 2. Helmet - secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  hidePoweredBy: true,
  xssFilter: true,
}));

// 3. CORS - apenas domínio do frontend
app.use(cors({
  origin: config.ALLOWED_ORIGINS.split(","),
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  maxAge: 86400,
}));

// 4. Compression
app.use(compression());

// 5. Body parser - limit size, parse JSON
app.use(express.json({ limit: "10kb", strict: true }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 6. Cookie parser (para CSRF token)
app.use(cookieParser(config.COOKIE_SECRET));

// 7. NoSQL injection protection (sanitiza $ e . nos inputs)
app.use(mongoSanitize());

// 8. HTTP Parameter Pollution protection
app.use(hpp());

// 9. XSS sanitization (limpa inputs maliciosos)
app.use((req, _res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key]
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;")
          .replace(/\//g, "&#x2F;")
          .trim();
      }
    });
  }
  next();
});

// ============================================================
// RATE LIMITING
// ============================================================

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em 15 minutos." },
  skipSuccessfulRequests: false,
  handler: (_req, res) => {
    logger.warn("Rate limit exceeded");
    res.status(429).json({ error: "Muitas requisições. Tente novamente em breve." });
  },
});
app.use(globalLimiter);

// Rate limit específico para checkout (mais restrito)
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 tentativas por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de checkout. Aguarde 1 hora." },
});

// Rate limit para webhook
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(webhookLimiter);

// ============================================================
// ANTI-BOT / ANTI-SPAM (Honeypot)
// ============================================================
app.use((req, _res, next) => {
  // Honeypot field - se preenchido, é bot
  if (req.body && (req.body.hp_name || req.body.hp_email || req.body.hp_website || req.body.bot_field)) {
    logger.warn("Bot detected via honeypot", { ip: req.ip });
    // Responde 200 para não alertar o bot
    return _res.status(200).json({ success: true });
  }
  next();
});

// ============================================================
// REQUEST LOGGING
// ============================================================
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });
  next();
});

// ============================================================
// ROUTES
// ============================================================
app.use("/health", healthRouter);
app.use("/checkout", checkoutLimiter, checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/api/purchase", purchaseRouter);
app.use("/api/download", downloadRouter);
app.use("/newsletter", newsletterRouter);
app.use("/admin", adminRouter);

// ============================================================
// SECURITY HEADERS (extra)
// ============================================================
app.use((req, res, next) => {
  // Remove headers que revelam informação do servidor
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  res.removeHeader("X-AspNet-Version");
  res.removeHeader("X-AspNetMvc-Version");
  
  // Adiciona headers extras
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  next();
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use(errorHandler(logger));

// ============================================================
// START SERVER
// ============================================================
const PORT = config.PORT || 3000;

if (config.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} (${config.NODE_ENV})`);
    logger.info(`🔒 Security: Helmet, CORS, Rate Limit, XSS Sanitize enabled`);
  });
}

export { app, logger };
