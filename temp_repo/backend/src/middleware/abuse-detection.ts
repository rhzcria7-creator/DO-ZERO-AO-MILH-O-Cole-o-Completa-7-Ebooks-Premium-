import crypto from "crypto";
import { logger } from "../server.js";

/**
 * Sistema anti-abuso para proteger contra ataques automatizados.
 * Monitora comportamento suspeito e bloqueia IPs maliciosos.
 */

interface AbuseRecord {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
  blockedUntil: number;
  reasons: string[];
}

// Armazenamento em memória (use Redis em produção)
const abuseRecords = new Map<string, AbuseRecord>();

// Configurações
const MAX_ATTEMPTS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 1000; // 1 minuto
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutos
const SUSPICIOUS_PATTERNS = [
  /\.\./,           // Path traversal
  /<[^>]*>/,        // HTML tags (XSS)
  /\\x/,            // Hex encoded
  /eval/,           // Code injection
  /union.*select/i,  // SQL injection
  /script/i,        // Script injection
  /javascript:/i,   // JS injection
  /on\w+=/i,        // Event handlers (XSS)
];

export interface AbuseCheckResult {
  isBlocked: boolean;
  isSuspicious: boolean;
  reason?: string;
  remainingAttempts: number;
}

/**
 * Verifica se um IP está em modo de abuso
 */
export function checkAbuse(ip: string): AbuseCheckResult {
  const record = abuseRecords.get(ip);
  
  if (!record) {
    return { 
      isBlocked: false, 
      isSuspicious: false, 
      remainingAttempts: MAX_ATTEMPTS_PER_WINDOW 
    };
  }

  // Verificar se ainda está bloqueado
  if (record.blocked && Date.now() < record.blockedUntil) {
    return { 
      isBlocked: true, 
      isSuspicious: true, 
      reason: "IP bloqueado temporariamente",
      remainingAttempts: 0 
    };
  }

  // Limpar bloqueio expirado
  if (record.blocked && Date.now() >= record.blockedUntil) {
    record.blocked = false;
    record.attempts = 0;
  }

  // Verificar janela de tempo
  if (Date.now() - record.firstAttempt > WINDOW_MS) {
    record.attempts = 0;
    record.firstAttempt = Date.now();
  }

  return {
    isBlocked: false,
    isSuspicious: false,
    remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - record.attempts
  };
}

/**
 * Registra uma tentativa de abuso
 */
export function recordAbuseAttempt(ip: string, reason: string): void {
  let record = abuseRecords.get(ip);
  
  if (!record) {
    record = {
      attempts: 0,
      firstAttempt: Date.now(),
      lastAttempt: Date.now(),
      blocked: false,
      blockedUntil: 0,
      reasons: [],
    };
    abuseRecords.set(ip, record);
  }

  record.attempts++;
  record.lastAttempt = Date.now();
  
  if (!record.reasons.includes(reason)) {
    record.reasons.push(reason);
  }

  // Verificar se deve bloquear
  if (record.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    record.blocked = true;
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    
    logger.warn("IP blocked for abuse", {
      ip,
      attempts: record.attempts,
      reasons: record.reasons,
      blockedUntil: new Date(record.blockedUntil).toISOString()
    });
  } else {
    logger.info("Abuse attempt recorded", {
      ip,
      reason,
      attempts: record.attempts,
      remaining: MAX_ATTEMPTS_PER_WINDOW - record.attempts
    });
  }
}

/**
 * Verifica padrões suspeitos em strings
 */
export function detectSuspiciousPattern(value: string): boolean {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Limpa registros antigos (chamar periodicamente)
 */
export function cleanupOldRecords(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [ip, record] of abuseRecords.entries()) {
    // Remover registros com mais de 1 hora sem atividade
    if (now - record.lastAttempt > 60 * 60 * 1000) {
      abuseRecords.delete(ip);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info("Cleaned up old abuse records", { cleaned });
  }

  return cleaned;
}

/**
 * Middleware para verificar abuso em todas as requisições
 */
export function abuseDetectionMiddleware(ip: string): void {
  const result = checkAbuse(ip);
  
  if (result.isBlocked) {
    logger.warn("Blocked request from abused IP", { ip });
    throw new Error("IP temporariamente bloqueado");
  }
}

// Limpar registros a cada hora
setInterval(cleanupOldRecords, 60 * 60 * 1000);