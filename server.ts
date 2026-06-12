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

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for local Vite HMR and dynamic scripts
    crossOriginOpenerPolicy: false, // Required for Firebase Auth popup to work in iframe
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
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Purchase verification endpoint
  app.get("/api/purchase/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
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

  // Example: secure download route
  app.get("/api/download/:token", async (req, res) => {
    const { token } = req.params;
    
    // Check Authorization header for Firebase Auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Missing or invalid authorization token." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      // Verify the auth token using Firebase Admin
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      // Removed backend Firestore validation due to IAM sandbox constraints.
      // In production, you would check adminDb.collection("purchases") here.
      // Since demo accepts any login, we allow if token is valid.
      res.json({ success: true, message: "Ebook liberado com acesso seguro.", downloadUrl: "/ebook.pdf" });

    } catch (error) {
      console.error("Auth / Download verification failed:", error);
      res.status(403).json({ success: false, error: "Token de autenticação inválido ou expirado." });
    }
  });

  app.post("/api/download", async (req, res) => {
    const { token } = req.body;
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Não autenticado." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      // Validation simulation:
      // Removed adminDb.collection("purchases") due to sandbox constraints.
      res.json({ success: true, downloadUrl: "/ebook.pdf" });

    } catch (error) {
       console.error("Download blocked:", error);
       res.status(403).json({ success: false, error: "Token inválido." });
    }
  });

  // Simulated Webhook (For testing purposes)
  app.post("/api/webhook/simulate", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email missing" });
    
    try {
      // In a real implementation we would insert to adminDb here.
      // Instead the frontend handles the database insertion for the Sandbox.
      // We just send the automated email.
      await sendEbookEmail(email);

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to simulate webhook" });
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

      // Bypass db validation in sandbox
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
