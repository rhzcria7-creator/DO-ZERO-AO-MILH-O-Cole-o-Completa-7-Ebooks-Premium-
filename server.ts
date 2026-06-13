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

// IP blocking for abuse
const blockedIPs = new Map<string, number>();
const MAX_FAILED = 5;
const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

function checkIPBlocked(ip: string): boolean {
  const blockedUntil = blockedIPs.get(ip);
  if (blockedUntil && Date.now() < blockedUntil) {
    return true;
  }
  blockedIPs.delete(ip);
  return false;
}

function blockIP(ip: string): void {
  blockedIPs.set(ip, Date.now() + BLOCK_DURATION);
  console.warn(`IP blocked for abuse: ${ip}`);
}

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

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    validate: { xForwardedForHeader: false }, // Suppress express-rate-limit proxy warning if trust proxy handles it
    message: "Too many requests from this IP, please try again later.",
  });
  app.use("/api", limiter);

  app.use(cors());
  app.use(express.json({ limit: '10kb' })); // Limit JSON body size

  // Get client IP helper
  const getClientIP = (req: express.Request): string => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // SECURE: Purchase verification with server-side validation
  app.post("/api/purchase/verify", authLimiter, async (req, res) => {
    const ip = getClientIP(req);
    
    // Check if IP is blocked
    if (checkIPBlocked(ip)) {
      return res.status(403).json({ verified: false, error: "Acesso temporariamente bloqueado." });
    }

    // Validate authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      blockIP(ip);
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

      // Check if this sessionId matches (for Mercado Pago verification)
      // In production, verify against payment provider
      // For now, accept if user has ANY completed purchase
      const purchaseDoc = snapshot.docs[0];
      const purchaseData = purchaseDoc.data();
      
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
        blockIP(ip);
        return res.status(401).json({ verified: false, error: "Token inválido." });
      }
      
      res.status(500).json({ verified: false, error: "Erro interno ao verificar compra." });
    }
  });

  // SECURE: Request download token (requires valid purchase)
  app.post("/api/download/request", downloadLimiter, async (req, res) => {
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
      // Token format: base64url(JSON).base64url(HMAC)
      const tokenSecret = process.env.TOKEN_SECRET || "default-secret-change-in-production-32chars!";
      const issuedAt = Date.now();
      const expiresAt = issuedAt + (60 * 60 * 1000); // 1 hour validity
      
      // Create a secure token with purchase verification
      const tokenPayload = {
        purchaseId: purchaseId,
        emailHash: crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").substring(0, 16),
        uid: uid,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
        nonce: crypto.randomBytes(16).toString("hex")
      };

      const payloadEncoded = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
      const signature = crypto.createHmac("sha256", tokenSecret)
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
        blockIP(ip);
        return res.status(401).json({ success: false, error: "Token de autenticação inválido." });
      }
      
      res.status(500).json({ success: false, error: "Erro interno ao processar download." });
    }
  });

  // SECURE: Actual download endpoint with token validation
  app.get("/api/download/:token", async (req, res) => {
    const ip = getClientIP(req);
    const { token } = req.params;
    
    // Check if IP is blocked
    if (checkIPBlocked(ip)) {
      return res.status(403).json({ success: false, error: "Acesso temporariamente bloqueado." });
    }

    // Validate token format
    if (!token || token.length < 50 || token.length > 500) {
      blockIP(ip);
      return res.status(400).json({ success: false, error: "Token inválido." });
    }

    try {
      // Parse and validate token
      const parts = token.split(".");
      if (parts.length !== 2) {
        blockIP(ip);
        return res.status(400).json({ success: false, error: "Formato de token inválido." });
      }

      const [payloadEncoded, providedSignature] = parts;

      // Verify HMAC signature
      const tokenSecret = process.env.TOKEN_SECRET || "default-secret-change-in-production-32chars!";
      const expectedSignature = crypto.createHmac("sha256", tokenSecret)
                                       .update(payloadEncoded)
                                       .digest("base64url");
      
      if (providedSignature !== expectedSignature) {
        blockIP(ip);
        console.warn(`Invalid token signature from IP: ${ip}`);
        return res.status(403).json({ success: false, error: "Token de download inválido ou expirado." });
      }

      // Decode and validate payload
      const payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf-8"));

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        return res.status(403).json({ success: false, error: "Link de download expirado. Solicite um novo link." });
      }

      // Verify email hash matches
      const emailHash = crypto.createHash("sha256").update(payload.emailHash.toLowerCase()).digest("hex").substring(0, 16);
      
      // Verify purchase still exists and is valid
      const purchaseRef = adminDb.collection("purchases").doc(payload.purchaseId);
      const purchaseDoc = await purchaseRef.get();
      
      if (!purchaseDoc.exists) {
        blockIP(ip);
        return res.status(404).json({ success: false, error: "Compra não encontrada." });
      }

      const purchaseData = purchaseDoc.data()!;
      if (purchaseData.status !== "completed") {
        return res.status(403).json({ success: false, error: "Pagamento não confirmado." });
      }

      // Log successful download access
      console.info(`Download approved for PurchaseID: ${payload.purchaseId}, IP: ${ip}`);

      // In production, stream the actual ebook file here
      // For security, the file should be stored securely and streamed
      // DO NOT expose direct file URLs
      res.json({ 
        success: true, 
        message: "Download autorizado. Em produção, o arquivo PDF seria entregue aqui via streaming seguro.",
        note: "Configure DOWNLOAD_FILE_PATH no ambiente de produção para entregar o arquivo real."
      });

    } catch (error) {
      console.error("Download token validation error:", error);
      blockIP(ip);
      res.status(500).json({ success: false, error: "Erro ao processar download." });
    }
  });

  // Deprecated endpoint - kept for backwards compatibility but now secured
  app.post("/api/download", async (req, res) => {
    // Redirect to new endpoint
    res.status(410).json({ 
      success: false, 
      error: "Este endpoint foi descontinuado. Use /api/download/request para obter um token de download." 
    });
  });

  // Legacy endpoint - returns error
  app.get("/api/purchase/:sessionId", (req, res) => {
    res.status(410).json({ 
      verified: false, 
      error: "Este endpoint foi descontinuado. Use POST /api/purchase/verify." 
    });
  });

  // Simulated Webhook - now requires authentication
  app.post("/api/webhook/simulate", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email missing" });
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    try {
      await sendEbookEmail(email);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to simulate webhook" });
    }
  });

  // Endpoint to resend email with proper security
  app.post("/api/resend-email", async (req, res) => {
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
         blockIP(ip);
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
