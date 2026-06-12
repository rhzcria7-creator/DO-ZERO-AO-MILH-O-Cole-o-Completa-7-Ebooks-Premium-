import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../server.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function getTransporter() {
  if (config.EMAIL_PROVIDER === "sendgrid" && config.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: config.SENDGRID_API_KEY,
      },
    });
  }

  if (config.SMTP_HOST) {
    return nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  return null;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = getTransporter();
  
  if (!transporter) {
    logger.warn("Email transporter not configured - email not sent", { 
      to: options.to, 
      subject: options.subject 
    });
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    logger.info("Email sent successfully", { 
      to: options.to, 
      subject: options.subject 
    });
    return true;
  } catch (error: any) {
    logger.error("Failed to send email", { 
      error: error.message, 
      to: options.to, 
      subject: options.subject 
    });
    return false;
  }
}

export async function sendPurchaseConfirmation(data: {
  to: string;
  name: string;
  downloadToken: string;
  purchaseId: number;
  amount: number;
}): Promise<boolean> {
  const downloadUrl = `${config.DOWNLOAD_URL}/download/${data.downloadToken}`;
  const purchaseDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000; color: #fff; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #0A0A0A; border-radius: 16px; padding: 40px; border: 1px solid rgba(245, 197, 66, 0.2); }
        .logo { color: #F5C542; font-size: 24px; font-weight: 600; letter-spacing: 0.15em; margin-bottom: 30px; text-align: center; }
        h1 { color: #fff; font-size: 28px; margin: 0 0 20px; text-align: center; }
        p { color: #B3B3B3; margin: 16px 0; }
        .highlight { color: #F5C542; font-weight: 600; }
        .details { background: rgba(245, 197, 66, 0.1); border-radius: 12px; padding: 20px; margin: 24px 0; }
        .details p { margin: 8px 0; color: #fff; }
        .btn { display: inline-block; background: #F5C542; color: #000; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; margin: 20px 0; text-align: center; }
        .btn:hover { background: #e6b53d; }
        .warning { font-size: 14px; color: #888; margin-top: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; }
        .footer p { font-size: 12px; color: #666; margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">DO ZERO AO MILHÃO</div>
          
          <h1>🎉 Compra Confirmada!</h1>
          
          <p>Olá, <span class="highlight">${data.name}</span>!</p>
          <p>Sua compra foi confirmada com sucesso. Obrigado por confiar no nosso material!</p>
          
          <div class="details">
            <p><strong>📦 Produto:</strong> ebook Do Zero ao Milhão</p>
            <p><strong>💰 Valor:</strong> R$ ${data.amount.toFixed(2)}</p>
            <p><strong>📅 Data:</strong> ${purchaseDate}</p>
            <p><strong>🔖 Pedido:</strong> #${data.purchaseId}</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${downloadUrl}" class="btn">📥 Baixar Agora</a>
          </div>
          
          <p class="warning">⚠️ Este link expira em 30 dias. Guarde este e-mail.</p>
          
          <div class="footer">
            <p>Este é um e-mail automático. Não responda esta mensagem.</p>
            <p>© ${new Date().getFullYear()} Do Zero ao Milhão</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.to,
    subject: "✅ Compra Confirmada - Do Zero ao Milhão",
    html,
    text: `Olá ${data.name}! Sua compra foi confirmada. Baixe seu ebook: ${downloadUrl}`,
  });
}

export async function sendDownloadLink(data: {
  to: string;
  name: string;
  downloadToken: string;
}): Promise<boolean> {
  const downloadUrl = `${config.DOWNLOAD_URL}/download/${data.downloadToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #000; color: #fff; padding: 40px; }
        .container { max-width: 600px; margin: 0 auto; background: #0A0A0A; border-radius: 16px; padding: 40px; border: 1px solid rgba(245, 197, 66, 0.2); }
        .logo { color: #F5C542; font-size: 24px; font-weight: 600; letter-spacing: 0.15em; margin-bottom: 30px; }
        h1 { color: #fff; font-size: 28px; margin: 0 0 20px; }
        p { color: #B3B3B3; line-height: 1.6; margin: 16px 0; }
        .btn { display: inline-block; background: #F5C542; color: #000; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">DO ZERO AO MILHÃO</div>
        <h1>📥 Link de Download</h1>
        <p>Olá ${data.name}, aqui está seu link para baixar o ebook:</p>
        <a href="${downloadUrl}" class="btn">Baixar eBook</a>
        <p>Este link expira em 30 dias.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.to,
    subject: "📥 Seu Link de Download - Do Zero ao Milhão",
    html,
  });
}