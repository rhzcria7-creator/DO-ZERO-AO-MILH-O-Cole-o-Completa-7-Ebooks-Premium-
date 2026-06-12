import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { logger } from "../server.js";
import { addSubscriber } from "../services/newsletter.js";

export const newsletterRouter = Router();

/**
 * POST /newsletter/subscribe
 * Adiciona e-mail à newsletter (anti-spam)
 */
newsletterRouter.post(
  "/subscribe",
  [
    body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
    body("name").optional().isString().trim().isLength({ min: 2, max: 100 }),
    body("hp_field").optional().isEmpty(), // honeypot
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      const { email, name } = req.body;

      await addSubscriber({
        email,
        name: name || "Assinante",
        source: "website",
        tags: ["newsletter", "lead"],
      });

      logger.info("Newsletter subscription", { email, ip: req.ip });

      res.json({ success: true, message: "Inscrição confirmada" });
    } catch (error) {
      logger.error("Newsletter subscription failed", { error });
      next(error);
    }
  }
);
