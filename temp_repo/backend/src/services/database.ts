import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import pg from "pg";
import { config } from "../config/env.js";

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool);

// Schema
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  stripeSessionId: text("stripe_session_id").unique().notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  email: text("email").notNull(),
  name: text("name").notNull(),
  product: text("product").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("brl"),
  status: text("status").default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  statusReason: text("status_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  purchaseId: serial("purchase_id").references(() => purchases.id).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedCount: serial("used_count").default(0),
  lastUsedIp: text("last_used_ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  source: text("source").default("website").notNull(),
  tags: jsonb("tags").default("[]"),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: serial("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export { eq };
