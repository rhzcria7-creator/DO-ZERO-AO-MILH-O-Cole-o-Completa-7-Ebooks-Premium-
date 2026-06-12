import express from "express";
import { Router } from "express";
import { logger } from "../server.js";

export const webhookRouter = Router();

// Webhook desabilitado - Stripe removido do projeto
// Rota mantida para evitar erros 404 em sistemas que chamam este endpoint
webhookRouter.post("/stripe", (req, res) => {
  logger.info("Webhook received but Stripe is disabled");
  res.json({ received: true, message: "Stripe disabled" });
});
