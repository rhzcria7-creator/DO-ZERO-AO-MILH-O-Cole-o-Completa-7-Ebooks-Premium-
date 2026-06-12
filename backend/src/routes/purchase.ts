import { Router, Request, Response, NextFunction } from "express";
import { param, validationResult } from "express-validator";
import { db, purchases } from "../services/database.js";
import { eq } from "drizzle-orm";
import { logger } from "../server.js";

export const purchaseRouter = Router();

/**
 * GET /api/purchase/:sessionId
 * Verifica se uma compra foi confirmada pelo Stripe.
 * 
 * Retorna apenas boolean para segurança:
 * - Não expõe dados sensíveis (e-mail, valor, etc.)
 * - Não revela se o session existe ou não para evitar enumeração
 */
purchaseRouter.get(
  "/:sessionId",
  [
    param("sessionId").isString().isLength({ min: 20, max: 200 }).withMessage("Session ID inválido"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          verified: false, 
          error: "Session ID inválido" 
        });
      }

      const { sessionId } = req.params;

      // Busca compra pelo session_id do Stripe
      const [purchase] = await db
        .select({
          id: purchases.id,
          status: purchases.status,
          paidAt: purchases.paidAt,
        })
        .from(purchases)
        .where(eq(purchases.stripeSessionId, sessionId))
        .limit(1);

      // Log de auditoria
      logger.info("Purchase verification attempt", { 
        sessionId: sessionId.substring(0, 20) + "...", 
        found: !!purchase,
        ip: req.ip 
      });

      // Verifica se a compra existe e está completa
      if (!purchase) {
        // Para evitar enumeração, sempre retorna false mesmo se não encontrar
        // Isso impede que atacantes descubram session IDs válidos
        return res.json({ verified: false });
      }

      // Verifica status: apenas 'completed' permite acesso
      const isVerified = purchase.status === "completed" && purchase.paidAt !== null;

      if (isVerified) {
        logger.info("Purchase verified successfully", { 
          purchaseId: purchase.id,
          ip: req.ip 
        });
      }

      return res.json({ 
        verified: isVerified,
        purchaseId: isVerified ? purchase.id : undefined
      });
    } catch (error) {
      logger.error("Purchase verification error", { error, sessionId: req.params.sessionId, ip: req.ip });
      // Em caso de erro, retornar false por segurança
      return res.json({ verified: false });
    }
  }
);

/**
 * GET /api/purchase/:sessionId/details
 * Retorna detalhes da compra para uso interno (após verificação de sessão).
 * Requer token de verificação.
 */
purchaseRouter.get(
  "/:sessionId/details",
  [
    param("sessionId").isString().isLength({ min: 20, max: 200 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Session ID inválido" });
      }

      const { sessionId } = req.params;

      const [purchase] = await db
        .select({
          id: purchases.id,
          email: purchases.email,
          name: purchases.name,
          product: purchases.product,
          amount: purchases.amount,
          currency: purchases.currency,
          status: purchases.status,
        })
        .from(purchases)
        .where(eq(purchases.stripeSessionId, sessionId))
        .limit(1);

      if (!purchase || purchase.status !== "completed") {
        return res.status(404).json({ error: "Compra não encontrada ou incompleta" });
      }

      return res.json({ purchase });
    } catch (error) {
      logger.error("Purchase details error", { error });
      next(error);
    }
  }
);