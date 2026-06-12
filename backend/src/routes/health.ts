import { Router } from "express";
import { db } from "../services/database.js";
import { config } from "../config/env.js";

export const healthRouter = Router();

// Métricas de performance
let requestCount = 0;
let errorCount = 0;
const startTime = Date.now();

/**
 * GET /health
 * Verificação de saúde do servidor (para monitoramento)
 */
healthRouter.get("/", async (_req, res) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  let allHealthy = true;

  // Verificar banco de dados
  try {
    const dbStart = Date.now();
    await db.execute("SELECT 1");
    checks.database = { 
      status: "healthy", 
      latency: Date.now() - dbStart 
    };
  } catch (error: any) {
    checks.database = { 
      status: "unhealthy", 
      error: error.message 
    };
    allHealthy = false;
  }

  // Verificar configurações
  checks.config = {
    status: config.DATABASE_URL ? "configured" : "missing",
  };

  // Estatísticas
  const uptime = Date.now() - startTime;
  const memUsage = process.memoryUsage();

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    version: process.env.npm_package_version || "1.0.0",
    checks,
    metrics: {
      requests: requestCount,
      errors: errorCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount * 100).toFixed(2) + "%" : "0%",
    },
    memory: {
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      rss: formatBytes(memUsage.rss),
      external: formatBytes(memUsage.external),
    },
  });
});

/**
 * GET /health/ready
 * Verifica se o servidor está pronto para receber tráfego
 */
healthRouter.get("/ready", async (_req, res) => {
  try {
    // Verificar DB
    await db.execute("SELECT 1");
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false, reason: "Database not available" });
  }
});

/**
 * GET /health/live
 * Verifica se o servidor está vivo (liveness probe)
 */
healthRouter.get("/live", (_req, res) => {
  res.json({ alive: true });
});

// Funções auxiliares
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

// Middleware para contar requests (para métricas)
export function metricsMiddleware(req: any, _res: any, next: any) {
  requestCount++;
  _res.on("finish", () => {
    if (_res.statusCode >= 400) {
      errorCount++;
    }
  });
  next();
}
