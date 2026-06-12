import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { logger } from "../server.js";

export const checkoutRouter = Router();

// Checkout desabilitado - Stripe removido do projeto
// Rota mantida para evitar erros em sistemas existentes
checkoutRouter.post(
  "/session",
  [
    body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
    body("name").optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage("Nome inválido"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Checkout validation failed", { errors: errors.array(), ip: req.ip });
        return res.status(400).json({ error: "Dados inválidos", details: errors.array() });
      }

      logger.info("Checkout attempted but Stripe is disabled", { email: req.body.email, ip: req.ip });

      res.status(503).json({
        error: "Checkout temporariamente indisponível",
        message: "Em breve, novas formas de pagamento serão disponibilizadas.",
      });
    } catch (error) {
      logger.error("Checkout error", { error, ip: req.ip });
      next(error);
    }
  }
);
