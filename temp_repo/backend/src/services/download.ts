import { getTokenService } from "./token.js";
import { db, downloads, eq } from "./database.js";
import { logger } from "../server.js";

interface DownloadToken {
  purchaseId: number;
  email: string;
}

/**
 * Cria token seguro HMAC-assinado para download.
 * O token é stateless e autocontido - não precisa ser armazenado no banco.
 * 
 * @param purchaseId - ID da compra no banco
 * @param email - Email do cliente (usado para vincular o token)
 * @param expiryDays - Dias até expiração (padrão: 30)
 * @returns Token HMAC-assinado
 */
export async function createSecureDownloadToken(
  purchaseId: number, 
  email: string, 
  expiryDays: number = 30
): Promise<string> {
  const tokenService = getTokenService();
  const { token } = tokenService.createToken(purchaseId, email, expiryDays);

  // Opcional: ainda registramos o token no banco para estatísticas
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  
  try {
    await db.insert(downloads).values({
      purchaseId,
      token, // Armazenamos para ter histórico de downloads
      expiresAt,
      usedCount: 0,
    });
  } catch (error) {
    // Se falhar, não impede a criação do token (token é stateless)
    logger.warn("Failed to record download token in database", { error, purchaseId });
  }

  logger.info("Download token created", { purchaseId, expiresAt: expiresAt.toISOString() });

  return token;
}

/**
 * Verifica token HMAC-assinado (stateless).
 * A verificação é feita via HMAC, não precisa buscar no banco.
 * A validação da compra deve ser feita na rota de download.
 * 
 * @deprecated Use getTokenService().verifyToken() diretamente
 */
export async function verifyDownloadToken(token: string): Promise<{ purchaseId: number } | null> {
  const tokenService = getTokenService();
  const payload = tokenService.verifyToken(token);
  
  if (!payload) return null;
  
  return { purchaseId: payload.purchaseId };
}

/**
 * Registra download (IP, user-agent, timestamp)
 */
export async function recordDownload(purchaseId: number, ip: string, userAgent: string) {
  try {
    const [record] = await db
      .select()
      .from(downloads)
      .where(eq(downloads.purchaseId, purchaseId))
      .limit(1);

    if (record) {
      await db
        .update(downloads)
        .set({ usedCount: record.usedCount + 1, lastUsedIp: ip })
        .where(eq(downloads.id, record.id));
    }

    logger.info("Download recorded", { purchaseId, ip, userAgent });
  } catch (error) {
    logger.warn("Failed to record download", { error, purchaseId });
  }
}
