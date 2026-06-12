import crypto from "crypto";

interface TokenPayload {
  purchaseId: number;
  emailHash: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface SignedToken {
  token: string;
  payload: TokenPayload;
}

/**
 * Serviço de tokens HMAC-assinados para downloads seguros.
 * 
 * Token formato: base64url(payload).base64url(signature)
 * - Payload: JSON codificado em base64url
 * - Signature: HMAC-SHA256 do payload
 */
export class TokenService {
  private readonly secret: string;
  private readonly defaultExpiryDays: number;

  constructor(secret: string, defaultExpiryDays: number = 30) {
    if (!secret || secret.length < 32) {
      throw new Error("Token secret must be at least 32 characters");
    }
    this.secret = secret;
    this.defaultExpiryDays = defaultExpiryDays;
  }

  /**
   * Cria um hash do e-mail para vincular ao token
   */
  hashEmail(email: string): string {
    return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex").substring(0, 16);
  }

  /**
   * Gera um nonce criptograficamente seguro
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Cria um novo token HMAC-assinado
   */
  createToken(purchaseId: number, email: string, expiryDays?: number): SignedToken {
    const now = Date.now();
    const expiresAt = now + (expiryDays ?? this.defaultExpiryDays) * 24 * 60 * 60 * 1000;

    const payload: TokenPayload = {
      purchaseId,
      emailHash: this.hashEmail(email),
      issuedAt: now,
      expiresAt,
      nonce: this.generateNonce(),
    };

    const payloadEncoded = this.encodePayload(payload);
    const signature = this.createSignature(payloadEncoded);
    const signatureEncoded = signature.toString("base64url");

    const token = `${payloadEncoded}.${signatureEncoded}`;

    return { token, payload };
  }

  /**
   * Valida e decodifica um token HMAC-assinado
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) {
        return null;
      }

      const [payloadEncoded, signatureEncoded] = parts;

      // Verificar assinatura
      const expectedSignature = this.createSignature(payloadEncoded);
      const providedSignature = Buffer.from(signatureEncoded, "base64url");

      // Usar timing-safe comparison para evitar timing attacks
      if (!crypto.timingSafeEqual(expectedSignature, providedSignature)) {
        return null;
      }

      // Decodificar payload
      const payload = this.decodePayload(payloadEncoded);

      // Verificar expiração
      if (payload.expiresAt < Date.now()) {
        return null;
      }

      // Verificar campos obrigatórios
      if (!payload.purchaseId || !payload.emailHash || !payload.nonce) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Codifica o payload para base64url
   */
  private encodePayload(payload: TokenPayload): string {
    const json = JSON.stringify(payload);
    return Buffer.from(json).toString("base64url");
  }

  /**
   * Decodifica o payload de base64url
   */
  private decodePayload(encoded: string): TokenPayload {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(json) as TokenPayload;
  }

  /**
   * Cria assinatura HMAC-SHA256
   */
  private createSignature(data: string): Buffer {
    return crypto.createHmac("sha256", this.secret).update(data).digest();
  }

  /**
   * Gera um hash SHA-256 de um token para armazenamento
   */
  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}

// Instância singleton para uso global
let tokenServiceInstance: TokenService | null = null;

export function getTokenService(): TokenService {
  if (!tokenServiceInstance) {
    const secret = process.env.TOKEN_SECRET || process.env.DOWNLOAD_SECRET;
    if (!secret) {
      throw new Error("TOKEN_SECRET or DOWNLOAD_SECRET environment variable is required");
    }
    tokenServiceInstance = new TokenService(secret);
  }
  return tokenServiceInstance;
}

export { TokenPayload, SignedToken };