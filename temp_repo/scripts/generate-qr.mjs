// Script para gerar QR Code PIX
// Execute: node scripts/generate-qr.mjs

import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PIX_CODE = "00020126580014br.gov.bcb.pix0136b1734aa3-6240-4d95-9194-33387d596f4a5204000053039865406129.905802BR5924Rhian Augusto Reis Lopes6009Sao Paulo62240520daqr3180513534991866630477BB";

async function generateQR() {
  const publicDir = path.join(__dirname, "..", "public");
  const distDir = path.join(__dirname, "..", "dist");
  
  // Garantir que diretórios existem
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const outputPath = path.join(publicDir, "qr-code-pix.png");
  
  try {
    // Gerar QR Code
    await QRCode.toFile(outputPath, PIX_CODE, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });
    
    console.log(`✅ QR Code gerado: ${outputPath}`);
    
    // Copiar para dist se existir
    if (fs.existsSync(distDir)) {
      const distPath = path.join(distDir, "qr-code-pix.png");
      fs.copyFileSync(outputPath, distPath);
      console.log(`✅ QR Code copiado: ${distPath}`);
    }
    
    // Retornar base64 para debug
    const base64 = await QRCode.toDataURL(PIX_CODE, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });
    console.log(`📊 Base64 (primeiros 100 chars): ${base64.substring(0, 100)}...`);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

generateQR();