/**
 * Proteção contra SSRF (Server-Side Request Forgery)
 * Verifica URLs e URLs antes de fazer requisições externas.
 */

import { URL } from "url";

// IPs e hostnames bloqueados (loopback, private, etc)
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "::",
]);

const BLOCKED_IP_RANGES = [
  /^10\./,                           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
  /^192\.168\./,                     // 192.168.0.0/16
  /^169\.254\./,                     // Link-local
  /^127\./,                          // Loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^::1$/i,                          // IPv6 loopback
  /^::$/i,                           // IPv6 unspecified
];

const BLOCKED_DOMAINS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.internal",
  "169.254.169.254",
  "metadata.azure.com",
  "ip169.254.169.254",
]);

export interface SSRFCheckResult {
  isSafe: boolean;
  reason?: string;
}

/**
 * Verifica se um hostname é seguro para requisições externas
 */
export function isHostnameSafe(hostname: string): SSRFCheckResult {
  const normalizedHostname = hostname.toLowerCase().trim();

  // Verificar hostnames bloqueados
  if (BLOCKED_HOSTS.has(normalizedHostname)) {
    return { isSafe: false, reason: "Hostname bloqueado: localhost" };
  }

  // Verificar domínios bloqueados
  if (BLOCKED_DOMAINS.has(normalizedHostname)) {
    return { isSafe: false, reason: "Hostname bloqueado: domínio de nuvem" };
  }

  // Verificar IP ranges privados
  for (const range of BLOCKED_IP_RANGES) {
    if (range.test(normalizedHostname)) {
      return { isSafe: false, reason: "IP privado não permitido" };
    }
  }

  return { isSafe: true };
}

/**
 * Verifica se uma URL é segura para requisições
 */
export function isURLSafe(urlString: string): SSRFCheckResult {
  try {
    const url = new URL(urlString);
    
    // Verificar protocolo (apenas http/https)
    if (!["http:", "https:"].includes(url.protocol)) {
      return { isSafe: false, reason: "Protocolo não permitido" };
    }

    // Verificar hostname
    const hostnameResult = isHostnameSafe(url.hostname);
    if (!hostnameResult.isSafe) {
      return hostnameResult;
    }

    // Verificar credentials na URL
    if (url.username || url.password) {
      return { isSafe: false, reason: "Credentials não permitidos na URL" };
    }

    return { isSafe: true };
  } catch (error) {
    return { isSafe: false, reason: "URL inválida" };
  }
}

/**
 * Valida headers de Host para evitar ataques
 */
export function validateHostHeader(host: string | undefined): SSRFCheckResult {
  if (!host) {
    return { isSafe: false, reason: "Host header ausente" };
  }

  // Verificar se contém caracteres suspeitos
  if (/[<>'"]/.test(host)) {
    return { isSafe: false, reason: "Caracteres suspects no Host" };
  }

  return { isSafe: true };
}