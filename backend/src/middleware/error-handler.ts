import { Request, Response, NextFunction } from "express";
import winston from "winston";
import crypto from "crypto";

// Tipos de erro conhecidos
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Erros pré-definidos
export const Errors = {
  badRequest: (msg = "Requisição inválida") => new AppError(400, msg, "BAD_REQUEST"),
  unauthorized: (msg = "Não autenticado") => new AppError(401, msg, "UNAUTHORIZED"),
  forbidden: (msg = "Acesso negado") => new AppError(403, msg, "FORBIDDEN"),
  notFound: (msg = "Recurso não encontrado") => new AppError(404, msg, "NOT_FOUND"),
  conflict: (msg = "Conflito") => new AppError(409, msg, "CONFLICT"),
  tooManyRequests: (msg = "Muitas requisições") => new AppError(429, msg, "RATE_LIMITED"),
  internal: (msg = "Erro interno") => new AppError(500, msg, "INTERNAL_ERROR"),
};

export function errorHandler(logger: winston.Logger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    // Classificar erro
    const isAppError = err instanceof AppError;
    const statusCode = isAppError ? err.statusCode : 500;
    const errorCode = isAppError ? err.code : "INTERNAL_ERROR";

    // Log detalhado (incluir stack apenas em dev)
    const logData = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      errorName: err.name,
      errorMessage: err.message,
      errorCode,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      logger.error("Server error", { ...logData, stack: err.stack });
    } else if (statusCode >= 400) {
      logger.warn("Client error", logData);
    }

    // Não expõe stack trace em produção
    const response: Record<string, unknown> = {
      error: isAppError ? err.message : "Erro interno do servidor",
      code: errorCode,
    };

    // Adicionar request ID para rastreamento
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    response.requestId = requestId;

    if (process.env.NODE_ENV !== "production") {
      response.stack = err.stack;
    }

    res.status(statusCode).json(response);
  };
}

// Helper para validar e lançar erros
export function validateOrThrow(condition: boolean, error: AppError): void {
  if (!condition) {
    throw error;
  }
}
