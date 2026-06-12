// Script para gerar QR Code PIX
// Execute: npx tsx scripts/generate-qr.ts

import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const PIX_CODE = "00020126580014br.gov.bcb.pix0136b1734aa3-6240-4d95-9194-33387d596f4a5204000053039865406129.905802BR5924Rhian Augusto Reis Lopes6009Sao Paulo62240520daqr3180513534182201630407DD";

async function generateQR() {
  const outputPath = path.join(process.cwd(), "public", "qr-code-pix.png");
  
  try {
    await QRCode.toFile(outputPath, PIX_CODE, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });
    
    console.log(`✅ QR Code gerado com sucesso: ${outputPath}`);
    
    // Também gerar versão para dist
    const distPath = path.join(process.cwd(), "dist", "qr-code-pix.png");
    if (fs.existsSync(path.join(process.cwd(), "dist"))) {
      await QRCode.toFile(distPath, PIX_CODE, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      });
      console.log(`✅ QR Code copiado para: ${distPath}`);
    }
  } catch (error) {
    console.error("❌ Erro ao gerar QR Code:", error);
    process.exit(1);
  }
}

generateQR();