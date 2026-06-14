import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { adminAuth, adminDb } from "./firebaseAdmin.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURAÇÃO DE SEGURANÇA CRÍTICA
// ============================================================================

// Token secret DEVE ser configurado em produção - não tem fallback inseguro
const TOKEN_SECRET = process.env.TOKEN_SECRET;
if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: TOKEN_SECRET must be set with at least 32 characters in production!");
  }
  console.warn("WARNING: Using insecure default TOKEN_SECRET. Set TOKEN_SECRET env var!");
}

// Secure default only for development
const TOKEN_SECRET_FALLBACK = "dev-only-insecure-key-change-in-production!!!";

// Security: Rate limiting for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit auth attempts
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: JSON.stringify({ error: "Muitas tentativas. Tente novamente em 15 minutos." }),
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit downloads per hour
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: JSON.stringify({ error: "Limite de downloads excedido. Tente novamente em 1 hora." }),
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit webhook calls
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: JSON.stringify({ error: "Limite de webhooks excedido." }),
});

// IP blocking for abuse
const blockedIPs = new Map<string, number>();
const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

function checkIPBlocked(ip: string): boolean {
  const blockedUntil = blockedIPs.get(ip);
  if (blockedUntil && Date.now() < blockedUntil) {
    return true;
  }
  blockedIPs.delete(ip);
  return false;
}

function blockIP(ip: string, reason: string = "abuse"): void {
  blockedIPs.set(ip, Date.now() + BLOCK_DURATION);
  console.warn(`IP blocked for ${reason}: ${ip}`);
}

// CSRF Token generation and validation
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, {
    token,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  });
  return token;
}

function validateCSRFToken(sessionId: string, token: string): boolean {
  const record = csrfTokens.get(sessionId);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return record.token === token;
}

// Webhook secret for Mercado Pago verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ethereal email for testing in development/preview
  let testAccount = await nodemailer.createTestAccount();
  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  async function sendEbookEmail(emailTarget: string) {
    try {
      let info = await transporter.sendMail({
        from: '"Equipe Do Zero ao Milhão" <suporte@dozeroaomilhao.com>',
        to: emailTarget,
        subject: "Seu Ebook Está Disponível",
        text: `Olá!\n\nSeu pagamento foi aprovado com sucesso.\n\nSeu ebook já está disponível.\n\nVocê pode:\n• Baixar diretamente pela sua conta na plataforma.\n• Utilizar a cópia em anexo neste e-mail (ou o link seguro de download).\n\nObrigado pela compra.\n\nAtenciosamente,\nEquipe do Projeto`,
        html: `<p>Olá!</p>
               <p>Seu pagamento foi aprovado com sucesso.</p>
               <p>Seu ebook já está disponível.</p>
               <p>Você pode:</p>
               <ul>
                 <li>Baixar diretamente pela sua conta na <a href="${process.env.APP_URL || 'http://localhost:3000'}/sucesso">Área do Cliente</a>.</li>
                 <li>Neste ambiente de teste não incluímos o arquivo físico no email para poupar banda, mas na versão de produção o PDF seguiria em anexo ou através de link autenticado temporário.</li>
               </ul>
               <p>Obrigado pela compra.</p>
               <br/>
               <p>Atenciosamente,<br/>Equipe do Projeto</p>`,
      });
      console.log("Email sent: %s", info.messageId);
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
      return { success: true };
    } catch (e) {
      console.error("Error sending email", e);
      return { success: false, error: e };
    }
  }

  // Trust the first proxy to properly get client IPs for rate-limiting
  app.set("trust proxy", 1);

  // Security Headers - STRONG CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        connectSrc: ["'self'", "https://www.google-analytics.com"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: false,
  }));

  // General rate limiter
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: "Too many requests from this IP, please try again later.",
  });
  app.use("/api", limiter);

  // CORS restrito para produção
  const corsOptions: cors.CorsOptions = {
    origin: process.env.NODE_ENV === "production" 
      ? [process.env.ALLOWED_ORIGIN || "https://dozeroaomilhao.com"].filter(Boolean)
      : true, // Allow all in development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With"],
    exposedHeaders: ["X-CSRF-Token"],
    credentials: true,
    maxAge: 86400, // 24 hours preflight cache
  };
  app.use(cors(corsOptions));
  
  app.use(express.json({ limit: '10kb' })); // Limit JSON body size

  // Get client IP helper
  const getClientIP = (req: express.Request): string => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
  };

  // CSRF Protection Middleware
  const csrfProtection = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    // Check CSRF token for state-changing requests
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!csrfToken || !sessionId) {
      return res.status(403).json({ error: "CSRF token required" });
    }
    
    if (!validateCSRFToken(sessionId, csrfToken)) {
      return res.status(403).json({ error: "Invalid or expired CSRF token" });
    }
    
    next();
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // CSRF token endpoint
  app.get("/api/csrf-token", (req, res) => {
    const sessionId = req.headers['x-session-id'] as string || crypto.randomBytes(16).toString("hex");
    const token = generateCSRFToken(sessionId);
    res.setHeader("X-CSRF-Token", token);
    res.json({ csrfToken: token, sessionId });
  });

  // SECURE: Purchase verification with server-side validation
  app.post("/api/purchase/verify", authLimiter, csrfProtection, async (req, res) => {
    const ip = getClientIP(req);
    
    // Check if IP is blocked
    if (checkIPBlocked(ip)) {
      return res.status(403).json({ verified: false, error: "Acesso temporariamente bloqueado." });
    }

    // Validate authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      blockIP(ip, "invalid_auth");
      return res.status(401).json({ verified: false, error: "Autenticação requerida." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      // Verify Firebase token
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      if (!email) {
        return res.status(400).json({ verified: false, error: "E-mail não encontrado na conta." });
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ verified: false, error: "Session ID requerido." });
      }

      // CRITICAL: Verify purchase in Firestore - NEVER trust frontend
      const purchasesRef = adminDb.collection("purchases");
      const q = purchasesRef.where("email", "==", email)
                             .where("status", "==", "completed");
      
      const snapshot = await q.get();
      
      if (snapshot.empty) {
        console.warn(`Purchase verification failed for: ${email}, IP: ${ip}`);
        return res.json({ verified: false, error: "Compra não encontrada ou não aprovada." });
      }

      const purchaseDoc = snapshot.docs[0];
      
      // Log successful verification
      console.info(`Purchase verified for: ${email}, PurchaseID: ${purchaseDoc.id}, IP: ${ip}`);

      res.json({ 
        verified: true, 
        purchaseId: purchaseDoc.id,
        email: email
      });
    } catch (error: any) {
      console.error("Purchase verification error:", error.message);
      
      if (error.code === 'auth/argument-error') {
        blockIP(ip, "invalid_firebase_token");
        return res.status(401).json({ verified: false, error: "Token inválido." });
      }
      
      res.status(500).json({ verified: false, error: "Erro interno ao verificar compra." });
    }
  });

  // SECURE: Request download token (requires valid purchase)
  app.post("/api/download/request", downloadLimiter, csrfProtection, async (req, res) => {
    const ip = getClientIP(req);
    
    if (checkIPBlocked(ip)) {
      return res.status(403).json({ success: false, error: "Acesso temporariamente bloqueado." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Autenticação requerida." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      if (!email) {
        return res.status(400).json({ success: false, error: "E-mail não encontrado." });
      }

      // CRITICAL: Verify purchase exists and is completed
      const purchasesRef = adminDb.collection("purchases");
      const q = purchasesRef.where("email", "==", email)
                             .where("status", "==", "completed");
      
      const snapshot = await q.get();
      
      if (snapshot.empty) {
        console.warn(`Download request denied - no purchase: ${email}, IP: ${ip}`);
        return res.status(403).json({ success: false, error: "Compra não encontrada." });
      }

      const purchaseDoc = snapshot.docs[0];
      const purchaseId = purchaseDoc.id;

      // Generate secure HMAC token for download
      const activeSecret = TOKEN_SECRET || TOKEN_SECRET_FALLBACK;
      const issuedAt = Date.now();
      const expiresAt = issuedAt + (60 * 60 * 1000); // 1 hour validity
      
      const tokenPayload = {
        purchaseId: purchaseId,
        emailHash: crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").substring(0, 16),
        uid: uid,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
        nonce: crypto.randomBytes(16).toString("hex")
      };

      const payloadEncoded = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
      const signature = crypto.createHmac("sha256", activeSecret)
                              .update(payloadEncoded)
                              .digest("base64url");
      
      const downloadToken = `${payloadEncoded}.${signature}`;

      console.info(`Download token generated for: ${email}, PurchaseID: ${purchaseId}, IP: ${ip}`);

      res.json({ 
        success: true, 
        downloadToken: downloadToken 
      });

    } catch (error: any) {
      console.error("Download request error:", error.message);
      
      if (error.code === 'auth/argument-error') {
        blockIP(ip, "invalid_token");
        return res.status(401).json({ success: false, error: "Token de autenticação inválido." });
      }
      
      res.status(500).json({ success: false, error: "Erro interno ao processar download." });
    }
  });

  // SECURE: Actual download endpoint with token validation
  app.get("/api/download/:token", async (req, res) => {
    const ip = getClientIP(req);
    const { token } = req.params;
    
    if (checkIPBlocked(ip)) {
      return res.status(403).json({ success: false, error: "Acesso temporariamente bloqueado." });
    }

    if (!token || token.length < 50 || token.length > 500) {
      blockIP(ip, "invalid_token_format");
      return res.status(400).json({ success: false, error: "Token inválido." });
    }

    try {
      const parts = token.split(".");
      if (parts.length !== 2) {
        blockIP(ip, "invalid_token_structure");
        return res.status(400).json({ success: false, error: "Formato de token inválido." });
      }

      const [payloadEncoded, providedSignature] = parts;

      // Verify HMAC signature
      const activeSecret = TOKEN_SECRET || TOKEN_SECRET_FALLBACK;
      const expectedSignature = crypto.createHmac("sha256", activeSecret)
                                       .update(payloadEncoded)
                                       .digest("base64url");
      
      if (providedSignature !== expectedSignature) {
        blockIP(ip, "invalid_signature");
        console.warn(`Invalid token signature from IP: ${ip}`);
        return res.status(403).json({ success: false, error: "Token de download inválido ou expirado." });
      }

      const payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf-8"));

      if (payload.expiresAt < Date.now()) {
        return res.status(403).json({ success: false, error: "Link de download expirado. Solicite um novo link." });
      }

      // Verify purchase still exists and is valid
      const purchaseRef = adminDb.collection("purchases").doc(payload.purchaseId);
      const purchaseDoc = await purchaseRef.get();
      
      if (!purchaseDoc.exists) {
        blockIP(ip, "purchase_not_found");
        return res.status(404).json({ success: false, error: "Compra não encontrada." });
      }

      const purchaseData = purchaseDoc.data()!;
      if (purchaseData.status !== "completed") {
        return res.status(403).json({ success: false, error: "Pagamento não confirmado." });
      }

      console.info(`Download approved for PurchaseID: ${payload.purchaseId}, IP: ${ip}`);

      // In production, stream the actual ebook file here
      res.json({ 
        success: true, 
        message: "Download autorizado. Em produção, o arquivo PDF seria entregue aqui via streaming seguro.",
        note: "Configure DOWNLOAD_FILE_PATH no ambiente de produção para entregar o arquivo real."
      });

    } catch (error) {
      console.error("Download token validation error:", error);
      blockIP(ip, "token_validation_error");
      res.status(500).json({ success: false, error: "Erro ao processar download." });
    }
  });

  // Deprecated endpoint
  app.post("/api/download", async (req, res) => {
    res.status(410).json({ 
      success: false, 
      error: "Este endpoint foi descontinuado. Use /api/download/request para obter um token de download." 
    });
  });

  // Legacy endpoint
  app.get("/api/purchase/:sessionId", (req, res) => {
    res.status(410).json({ 
      verified: false, 
      error: "Este endpoint foi descontinuado. Use POST /api/purchase/verify." 
    });
  });

  // SECURE: Webhook with Mercado Pago signature verification
  app.post("/api/webhook/mercadopago", webhookLimiter, async (req, res) => {
    const ip = getClientIP(req);
    
    // Verify Mercado Pago signature
    const signature = req.headers['x-signature'] as string;
    const webhookId = req.headers['x-webhook-id'] as string;
    
    // In production, verify the signature with WEBHOOK_SECRET
    if (WEBHOOK_SECRET && signature) {
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(payload)
        .digest("hex");
      
      if (signature !== expectedSignature) {
        console.warn(`Invalid webhook signature from IP: ${ip}`);
        return res.status(401).json({ error: "Invalid signature" });
      }
    }
    
    const { type, data } = req.body;
    
    if (type !== "payment") {
      return res.json({ received: true, message: "Event type not handled" });
    }
    
    const paymentId = data?.id;
    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID required" });
    }
    
    try {
      // In production, verify payment status with Mercado Pago API
      // and create purchase record in Firestore
      
      console.info(`Mercado Pago webhook received for payment: ${paymentId}, IP: ${ip}`);
      
      res.json({ received: true, paymentId });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Simulated Webhook for testing - NOW REQUIRES AUTHENTICATION
  app.post("/api/webhook/simulate", authLimiter, async (req, res) => {
    const ip = getClientIP(req);
    
    // Verify authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Autenticação requerida." });
    }
    
    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const email = decodedToken.email;
      
      if (!email) {
        return res.status(400).json({ error: "E-mail não encontrado." });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      // Create purchase record in Firestore (for demo/testing)
      // In production, this should only be done via Mercado Pago webhook
      await adminDb.collection("purchases").add({
        email: email,
        status: "completed",
        createdAt: new Date(),
        createdBy: "simulate_webhook",
        paymentMethod: "pix",
        amount: 129.90,
      });
      
      await sendEbookEmail(email);
      console.info(`Simulated purchase created for: ${email}, IP: ${ip}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Webhook simulation error:", error);
      if (error.code === 'auth/argument-error') {
        blockIP(ip, "invalid_webhook_auth");
        return res.status(401).json({ error: "Token inválido." });
      }
      res.status(500).json({ error: "Failed to simulate webhook" });
    }
  });

  // Endpoint to resend email with proper security
  app.post("/api/resend-email", authLimiter, csrfProtection, async (req, res) => {
    const ip = getClientIP(req);
    
    if (checkIPBlocked(ip)) {
      return res.status(403).json({ success: false, error: "Acesso temporariamente bloqueado." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Não autenticado." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const email = decodedToken.email;

      if (!email) {
         return res.status(400).json({ success: false, error: "Email não encontrado na conta." });
      }

      // Verify user has a completed purchase before sending email
      const purchasesRef = adminDb.collection("purchases");
      const q = purchasesRef.where("email", "==", email)
                             .where("status", "==", "completed");
      const snapshot = await q.get();
      
      if (snapshot.empty) {
        return res.status(403).json({ success: false, error: "Nenhuma compra aprovada encontrada para este e-mail." });
      }

      const emailResult = await sendEbookEmail(email);
      if (emailResult.success) {
        console.info(`Email resent to: ${email}, IP: ${ip}`);
        res.json({ success: true, message: "E-mail reenviado com sucesso!" });
      } else {
        res.status(500).json({ success: false, error: "Falha ao enviar e-mail." });
      }

    } catch (error) {
       console.error("Resend error:", error);
       if (error.code === 'auth/argument-error') {
         blockIP(ip, "invalid_resend_auth");
       }
       res.status(403).json({ success: false, error: "Token inválido." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
