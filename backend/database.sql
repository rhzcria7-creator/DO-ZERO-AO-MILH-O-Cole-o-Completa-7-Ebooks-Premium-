-- Schema do banco de dados - Do Zero ao Milhão
-- Execute este script no PostgreSQL

-- Extensão para UUIDs (opcional)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de compras
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  product TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'brl',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  status_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_amount CHECK (amount >= 0),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled'))
);

-- Índices otimizados para compras
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_paid_at ON purchases(paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_status_paid ON purchases(status, paid_at) WHERE status = 'completed';

-- Tabela de tokens de download
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_count INTEGER DEFAULT 0,
  last_used_ip TEXT,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_token CHECK (length(token) >= 40),
  CONSTRAINT valid_token_hash CHECK (length(token_hash) >= 64)
);

-- Índices para downloads
CREATE INDEX IF NOT EXISTS idx_downloads_token ON downloads(token);
CREATE INDEX IF NOT EXISTS idx_downloads_token_hash ON downloads(token_hash);
CREATE INDEX IF NOT EXISTS idx_downloads_purchase_id ON downloads(purchase_id);
CREATE INDEX IF NOT EXISTS idx_downloads_expires_at ON downloads(expires_at) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_downloads_active ON downloads(purchase_id, expires_at) WHERE expires_at > NOW();

-- Tabela de tokens revogados (para segurança adicional)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id SERIAL PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  revoked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  reason TEXT,
  revoked_by_ip TEXT,
  
  CONSTRAINT valid_token_hash CHECK (length(token_hash) >= 64)
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_hash ON revoked_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_revoked_at ON revoked_tokens(revoked_at DESC);

-- Tabela de newsletter/leads
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source TEXT DEFAULT 'website' NOT NULL,
  tags JSONB DEFAULT '[]',
  subscribed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  unsubscribed_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  confirmation_token TEXT UNIQUE,
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_source CHECK (source IN ('website', 'purchase', 'import'))
);

-- Índices para subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_source ON subscribers(source);
CREATE INDEX IF NOT EXISTS idx_subscribers_subscribed_at ON subscribers(subscribed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirmed ON subscribers(confirmed_at) WHERE confirmed_at IS NOT NULL;

-- Tabela de logs de atividade (auditoria)
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Constraints para prevenir SQL injection em action
  CONSTRAINT valid_action CHECK (action ~ '^[a-z_]+$')
);

-- Índices para logs (importante para performance)
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_ip ON activity_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_recent ON activity_logs(created_at DESC, action) LIMIT 1000;

-- Tabela de sessões admin
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  last_activity_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_session_id CHECK (length(id) >= 32)
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at) WHERE expires_at > NOW();

-- Tabela de bloqueios de IP
CREATE TABLE IF NOT EXISTS ip_blocks (
  id SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  unblocked_at TIMESTAMP,
  attempts INTEGER DEFAULT 1,
  
  CONSTRAINT valid_ip CHECK (ip_address ~ '^[0-9a-f.:]+$')
);

CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip ON ip_blocks(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_active ON ip_blocks(ip_address, expires_at) WHERE unblocked_at IS NULL;

-- Tabela de métricas agregadas (para dashboards)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_purchases INTEGER DEFAULT 0,
  completed_purchases INTEGER DEFAULT 0,
  refunded_purchases INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  total_downloads INTEGER DEFAULT 0,
  unique_ips INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at em purchases
DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para limpar logs antigos (mais de 90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE purchases IS 'Registra todas as compras realizadas';
COMMENT ON TABLE downloads IS 'Tokens seguros para download de arquivos';
COMMENT ON TABLE revoked_tokens IS 'Tokens que foram revogados por segurança';
COMMENT ON TABLE subscribers IS 'Assinantes da newsletter';
COMMENT ON TABLE activity_logs IS 'Logs de auditoria de todas as ações';
COMMENT ON TABLE admin_sessions IS 'Sessões ativas do painel admin';
COMMENT ON TABLE ip_blocks IS 'IPs bloqueados por comportamento suspeito';
COMMENT ON TABLE daily_metrics IS 'Métricas agregadas por dia para dashboards';

-- Permissões (ajuste conforme seu usuário)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_logs() TO your_app_user;
