import crypto from "crypto";
import { config } from "../config/env.js";
import { logger } from "../server.js";

interface Session {
  id: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory session store (use Redis in production)
const sessions = new Map<string, Session>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash password with PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify password against hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
}

/**
 * Create admin session
 */
export function createSession(email: string): string {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  
  sessions.set(sessionId, {
    id: sessionId,
    email,
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  });

  logger.info("Admin session created", { email, sessionId: sessionId.substring(0, 8) });
  return sessionId;
}

/**
 * Validate session and return session data
 */
export function validateSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    logger.info("Admin session expired", { sessionId: sessionId.substring(0, 8) });
    return null;
  }

  return session;
}

/**
 * Invalidate session
 */
export function invalidateSession(sessionId: string): void {
  sessions.delete(sessionId);
  logger.info("Admin session invalidated", { sessionId: sessionId.substring(0, 8) });
}

/**
 * Authenticate admin with credentials
 */
export function authenticateAdmin(email: string, password: string): string | null {
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH) {
    logger.warn("Admin authentication attempted but not configured");
    return null;
  }

  if (email !== config.ADMIN_EMAIL) {
    logger.warn("Admin login with wrong email", { email });
    return null;
  }

  if (!verifyPassword(password, config.ADMIN_PASSWORD_HASH)) {
    logger.warn("Admin login with wrong password", { email });
    return null;
  }

  return createSession(email);
}

/**
 * Cleanup expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let count = 0;
  
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
      count++;
    }
  }

  if (count > 0) {
    logger.info("Cleaned up expired admin sessions", { count });
  }

  return count;
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);