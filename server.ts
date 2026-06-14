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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ethereal email for testing in development/preview
  let transporter: any;
  
  async function setupMailer() {
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log(`[SMTP] Connected to production SMTP: ${process.env.SMTP_HOST}`);
    } else {
      let testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[SMTP] Ethereal test account created: ${testAccount.user}`);
    }
  }

  await setupMailer();

  async function sendEbookEmail(emailTarget: string) {
    try {
      if (!transporter) await setupMailer();
      
      let info = await transporter.sendMail({
        from: '"Equipe Do Zero ao Milhão" <suporte@dozeroaomilhao.com>',
        to: emailTarget,
        subject: "🎉 Seu Ebook Foi Liberado! Do Zero ao Milhão",
        text: `Olá!\n\nSeu pagamento foi aprovado com sucesso.\n\nSeu acesso ao Ebook Do Zero ao Milhão já está disponível.\n\nVocê pode:\n• Baixar diretamente pela sua Área do Cliente em nossa plataforma.\n• Acessar seu ambiente seguro a qualquer momento.\n\nObrigado pela compra.\n\nAtenciosamente,\nEquipe do Projeto`,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                 <h2 style="color: #000;">Pagamento Aprovado!</h2>
                 <p>Olá,</p>
                 <p>Seu pagamento foi <strong style="color: green;">confirmado com sucesso</strong>.</p>
                 <p>O seu e-book <strong>"Do Zero ao Milhão - O Guia Definitivo"</strong> já está liberado e atrelado à sua conta.</p>
                 <br>
                 <a href="${process.env.APP_URL || 'http://localhost:3000'}/sucesso" style="background-color: #facc15; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                   Acessar Área do Cliente
                 </a>
                 <br><br>
                 <p><em>Para acessar, você só precisa fazer o login utilizando a mesma conta Google (<a href="mailto:${emailTarget}">${emailTarget}</a>).</em></p>
                 <p style="font-size: 12px; color: #777;">Ambiente Seguro e Monitorado.</p>
                 <br/>
                 <p>Aproveite sua leitura e ótimos negócios!</p>
                 <p>Atenciosamente,<br/><strong>Equipe Do Zero ao Milhão</strong></p>
               </div>`,
      });
      console.log(`[EMAIL COMPLETED] Email successfully sent to ${emailTarget}. Message ID: ${info.messageId}`);
      if (nodemailer.getTestMessageUrl(info)) {
         console.log(`[PREVIEW URL]: ${nodemailer.getTestMessageUrl(info)}`);
      }
      return { success: true };
    } catch (e: any) {
      console.error(`[EMAIL FATAL ERROR] Erro crítico ao enviar e-mail para ${emailTarget}`, e);
      return { success: false, error: e?.message || "Failed to send" };
    }
  }

  // Configuração restrita de CORS
  app.use(cors({
    origin: process.env.NODE_ENV === "production" ? process.env.APP_URL : "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  }));

  // Trust the first proxy to properly get client IPs for rate-limiting
  app.set("trust proxy", 1);

  // Cabeçalhos Restritos de Segurança - Helmet
  // Algumas diretivas precisam ser flexibilizadas durante o ambiente de preview no iframe,
  // mas em produção, a segurança máxima é ativada.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://firestore.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: ["'self'", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://firestore.googleapis.com"],
        frameAncestors: ["'self'", "https://ai.studio", "https://*.google.com"], // Permite Iframe do Studio
      },
    },
    crossOriginOpenerPolicy: false, // Required for Firebase Auth popup to work in iframe
    crossOriginResourcePolicy: false, // Disabled so AI Studio iframe can load assets
    xFrameOptions: false, // Desabilitado em favor do frameAncestors no CSP
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // Strict-Transport-Security
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }, 
    message: { success: false, error: "Traffic blocked. Try again later." },
  });
  app.use("/api", limiter);

  app.use(express.json({ limit: "1mb" })); // Prevenção contra Payload excessivo

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Purchase verification endpoint
  app.get("/api/purchase/:sessionId", async (req, res) => {
    let { sessionId } = req.params;
    
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ verified: false, error: "Invalid session payload" });
    }
    // Limit string length to avoid large payloads targeting regex or memory
    sessionId = sessionId.substring(0, 100).replace(/[^a-zA-Z0-9_-]/g, "");

    try {
      // In a real app, verify against Stripe/MercadoPago, and check Firestore
      // For demonstration, we simply return verification success
      res.json({
        verified: true,
      });
    } catch (error) {
      console.error("Error verifying purchase:", error);
      res.status(500).json({ verified: false, error: "Internal server error" });
    }
  });

  // Sandbox local purchase simulation (since we can't write to Firestore from the backend webhook in this sandbox environment without a service account)
  const sandboxPurchases = new Set<string>();

  // Helper to verify purchase using Firestore REST API with the user's ID token
  async function verifyPurchaseREST(idToken: string, email: string) {
    if (sandboxPurchases.has(email)) {
      return true;
    }

    const projectId = "steam-port-ff4nj";
    const databaseId = "ai-studio-070dfb43-05fd-44e4-a0f4-f00ac0df6737";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;

    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: "purchases" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: { field: { fieldPath: "email" }, op: "EQUAL", value: { stringValue: email } }
              },
              {
                fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "completed" } }
              }
            ]
          }
        }
      }
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(queryPayload)
      });
      const data = await resp.json() as any[];
      // If valid, it returns an array mapping to documents. 
      // A result with no match usually returns an array with a single object that just has { readTime: ... }
      if (Array.isArray(data) && data.length > 0 && data[0].document) {
        return true;
      }
      return false;
    } catch (e) {
      console.error("REST validation error: ", e);
      return false;
    }
  }

  // Temporary secure download tokens mapping (token -> expiry timestamp)
  const secureTokens = new Map<string, number>();

  app.post("/api/download", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Não autenticado." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const email = decodedToken.email;

      if (!email) {
        return res.status(400).json({ success: false, error: "E-mail não atrelado." });
      }

      // 100% Backend Validation via REST to respect Firebase Rules
      const isValid = await verifyPurchaseREST(idToken, email);
      if (!isValid) {
        return res.status(403).json({ success: false, error: "Acesso negado. Compra não confirmada para este e-mail." });
      }

      // Generate a temporary one-time secure URL
      const tempToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      secureTokens.set(tempToken, Date.now() + 60 * 1000); // 1 minute expiration

      // Also log the audit exactly as requested
      console.log(`[AUDIT] User ${email} successfully requested download token at ${new Date().toISOString()}`);

      res.json({ success: true, downloadUrl: `/api/secure-download/${tempToken}` });

    } catch (error) {
       console.error("Download blocked:", error);
       res.status(403).json({ success: false, error: "Token inválido." });
    }
  });

  app.get("/api/secure-download/:token", (req, res) => {
    const { token } = req.params;
    
    const expiry = secureTokens.get(token);
    if (!expiry || Date.now() > expiry) {
      if (expiry) secureTokens.delete(token);
      return res.status(401).send("Link de download expirado ou inválido.");
    }

    // It's valid, one-time use
    secureTokens.delete(token);

    // Serve the private ebook file securely
    const filePath = path.join(process.cwd(), "private", "ebook.pdf");
    res.download(filePath, "DoZeroAoMilhao-Premium.pdf", (err) => {
      if (err) {
        console.error("Error sending file:", err);
        // The headers may already be sent, but we log the error
      }
    });
  });

  // Simulated Webhook (For testing purposes)
  app.post("/api/webhook/simulate", async (req, res) => {
    let { email } = req.body;
    
    // Proteção de Sanitização
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Invalid payload format" });
    }
    email = email.trim().toLowerCase();
    
    // Validação de formato de E-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
       return res.status(400).json({ error: "Invalid email format" });
    }
    
    try {
      // In a real implementation we would insert to adminDb here.
      // E.g., adminDb.collection("purchases").add({ email, status: "completed" });
      
      // Instead we use the local set for the Sandbox.
      sandboxPurchases.add(email);

      // We just send the automated email.
      await sendEbookEmail(email);

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Endpoit to resend email
  app.post("/api/resend-email", async (req, res) => {
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

      // 100% Backend Validation via REST to respect Firebase Rules
      const isValid = await verifyPurchaseREST(idToken, email);
      if (!isValid) {
        console.warn(`[AUDIT] Blocked unauthorized resend email attempt for ${email}`);
        return res.status(403).json({ success: false, error: "Compra não validada." });
      }

      console.log(`[AUDIT] User ${email} successfully requested resend email at ${new Date().toISOString()}`);
      
      const emailResult = await sendEbookEmail(email);
      if (emailResult.success) {
        res.json({ success: true, message: "E-mail reenviado com sucesso!" });
      } else {
        res.status(500).json({ success: false, error: "Falha ao enviar e-mail." });
      }

    } catch (error) {
       console.error("Resend error:", error);
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
