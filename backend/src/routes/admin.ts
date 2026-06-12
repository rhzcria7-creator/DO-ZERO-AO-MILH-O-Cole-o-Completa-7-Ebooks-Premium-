import { Router, Request, Response, NextFunction } from "express";
import { body, query, validationResult } from "express-validator";
import crypto from "crypto";
import { config } from "../config/env.js";
import { logger } from "../server.js";
import { db, purchases, downloads, subscribers, activityLogs, eq, desc, and, gte } from "../services/database.js";
import { authenticateAdmin, createSession, validateSession, invalidateSession } from "../services/auth.js";
import { checkAbuse, recordAbuseAttempt } from "../middleware/abuse-detection.js";

export const adminRouter = Router();

// Rate limiting para login (3 tentativas por hora)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT = 3;
const LOGIN_RATE_WINDOW = 60 * 60 * 1000;

// IP blocking para admin
const adminBlockedIPs = new Map<string, { until: number }>();
const ADMIN_BLOCK_DURATION = 60 * 60 * 1000; // 1 hora

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || record.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW });
    return true;
  }

  if (record.count >= LOGIN_RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

function checkAdminBlocked(ip: string): boolean {
  const record = adminBlockedIPs.get(ip);
  if (!record) return false;
  
  if (Date.now() > record.until) {
    adminBlockedIPs.delete(ip);
    return false;
  }
  return true;
}

function blockAdminIP(ip: string): void {
  adminBlockedIPs.set(ip, { until: Date.now() + ADMIN_BLOCK_DURATION });
  logger.warn("Admin IP blocked", { ip });
}

// Auth middleware
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";
  
  // Verificar IP bloqueado
  if (checkAdminBlocked(ip)) {
    logger.warn("Admin access blocked", { ip });
    return res.status(403).json({ error: "Acesso temporariamente bloqueado" });
  }
  
  // Verificar abuso
  const abuseResult = checkAbuse(ip);
  if (abuseResult.isBlocked) {
    blockAdminIP(ip);
    return res.status(403).json({ error: "Acesso temporariamente bloqueado" });
  }

  const sessionId = req.headers["x-session-id"] as string || 
                    req.cookies?.session_id;

  if (!sessionId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const session = validateSession(sessionId);
  if (!session) {
    recordAbuseAttempt(ip, "Invalid admin session");
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }

  (req as any).adminSession = session;
  next();
}

/**
 * POST /admin/login
 * Autentica admin
 */
adminRouter.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
    body("password").isString().isLength({ min: 6 }).withMessage("Senha muito curta"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Rate limit
      const ip = req.ip || "unknown";
      if (!checkLoginRateLimit(ip)) {
        logger.warn("Admin login rate limited", { ip });
        return res.status(429).json({ 
          error: "Muitas tentativas. Tente novamente em 1 hora." 
        });
      }

      // Validate
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Dados inválidos", details: errors.array() });
      }

      const { email, password } = req.body;

      // Authenticate
      const sessionId = authenticateAdmin(email, password);
      if (!sessionId) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      // Set cookie
      res.cookie("session_id", sessionId, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });

      logger.info("Admin logged in", { email });
      res.json({ success: true, message: "Login realizado" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/logout
 * Encerra sessão
 */
adminRouter.post("/logout", adminAuth, (req: Request, res: Response) => {
  const sessionId = req.headers["x-session-id"] as string || 
                    req.cookies?.session_id;
  
  if (sessionId) {
    invalidateSession(sessionId);
  }

  res.clearCookie("session_id");
  logger.info("Admin logged out", { email: (req as any).adminSession?.email });
  res.json({ success: true, message: "Logout realizado" });
});

/**
 * GET /admin/stats
 * Estatísticas do sistema
 */
adminRouter.get("/stats", adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total purchases
    const [totalPurchases] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.status, "completed"));

    const allPurchases = await db.select().from(purchases);
    const completedPurchases = allPurchases.filter(p => p.status === "completed");
    const totalRevenue = completedPurchases.reduce((sum, p) => sum + Number(p.amount), 0);

    // Purchases this month
    const recentPurchases = completedPurchases.filter(p => 
      p.paidAt && new Date(p.paidAt) >= thirtyDaysAgo
    );

    // Active downloads
    const allDownloads = await db.select().from(downloads);
    const activeDownloads = allDownloads.filter(d => 
      d.expiresAt && new Date(d.expiresAt) > now
    );

    // Subscribers
    const allSubscribers = await db.select().from(subscribers);

    res.json({
      totalPurchases: completedPurchases.length,
      totalRevenue: totalRevenue.toFixed(2),
      purchasesThisMonth: recentPurchases.length,
      revenueThisMonth: recentPurchases.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2),
      activeDownloads: activeDownloads.length,
      totalSubscribers: allSubscribers.length,
      refundedPurchases: allPurchases.filter(p => p.status === "refunded").length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/purchases
 * Lista de compras (paginado)
 */
adminRouter.get(
  "/purchases",
  adminAuth,
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const allPurchases = await db
        .select()
        .from(purchases)
        .orderBy(desc(purchases.createdAt))
        .limit(limit)
        .offset(offset);

      const total = (await db.select().from(purchases)).length;

      res.json({
        purchases: allPurchases.map(p => ({
          id: p.id,
          email: p.email,
          name: p.name,
          product: p.product,
          amount: p.amount,
          status: p.status,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/purchases/:id
 * Detalhes de uma compra
 */
adminRouter.get("/purchases/:id", adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchaseId = parseInt(req.params.id);

    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    // Get download info
    const purchaseDownloads = await db
      .select()
      .from(downloads)
      .where(eq(downloads.purchaseId, purchaseId));

    // Get activity logs
    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.entityId, purchaseId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(50);

    res.json({
      purchase: {
        id: purchase.id,
        email: purchase.email,
        name: purchase.name,
        product: purchase.product,
        amount: purchase.amount,
        currency: purchase.currency,
        status: purchase.status,
        stripeSessionId: purchase.stripeSessionId,
        paidAt: purchase.paidAt,
        refundedAt: purchase.refundedAt,
        createdAt: purchase.createdAt,
      },
      downloads: purchaseDownloads.map(d => ({
        id: d.id,
        token: d.token,
        expiresAt: d.expiresAt,
        usedCount: d.usedCount,
        lastUsedIp: d.lastUsedIp,
      })),
      activityLogs: logs.map(l => ({
        action: l.action,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/subscribers
 * Lista de inscritos
 */
adminRouter.get("/subscribers", adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allSubscribers = await db
      .select()
      .from(subscribers)
      .orderBy(desc(subscribers.subscribedAt));

    res.json({
      subscribers: allSubscribers.map(s => ({
        id: s.id,
        email: s.email,
        name: s.name,
        source: s.source,
        tags: s.tags,
        subscribedAt: s.subscribedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/downloads
 * Estatísticas de downloads
 */
adminRouter.get("/downloads", adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allDownloads = await db.select().from(downloads);
    const now = Date.now();

    const stats = {
      total: allDownloads.length,
      active: allDownloads.filter(d => d.expiresAt && new Date(d.expiresAt) > now).length,
      expired: allDownloads.filter(d => d.expiresAt && new Date(d.expiresAt) <= now).length,
      totalDownloads: allDownloads.reduce((sum, d) => sum + (d.usedCount || 0), 0),
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/activity
 * Logs de atividade
 */
adminRouter.get(
  "/activity",
  adminAuth,
  [
    query("limit").optional().isInt({ min: 1, max: 500 }).toInt(),
    query("action").optional().isString(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 100;
      
      const logs = await db
        .select()
        .from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);

      res.json({
        logs: logs.map(l => ({
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          metadata: l.metadata,
          ipAddress: l.ipAddress,
          userAgent: l.userAgent,
          createdAt: l.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/resend-download
 * Reenvia link de download para email
 */
adminRouter.post(
  "/resend-download",
  adminAuth,
  [
    body("purchaseId").isInt().withMessage("ID da compra inválido"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { purchaseId } = req.body;

      const [purchase] = await db
        .select()
        .from(purchases)
        .where(eq(purchases.id, purchaseId))
        .limit(1);

      if (!purchase) {
        return res.status(404).json({ error: "Compra não encontrada" });
      }

      // Generate new token
      const { createSecureDownloadToken } = await import("../services/download.js");
      const token = await createSecureDownloadToken(purchaseId, purchase.email);

      // TODO: Send email with new token
      logger.info("Admin resend download", { purchaseId, email: purchase.email });

      res.json({ 
        success: true, 
        message: "Link regenerado",
        downloadUrl: `${config.DOWNLOAD_URL}/download/${token}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/health
 * Health check para admin
 */
adminRouter.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    admin: !!config.ADMIN_EMAIL,
    stripe: !!config.STRIPE_SECRET_KEY,
    email: !!config.SENDGRID_API_KEY || !!config.SMTP_HOST,
  });
});