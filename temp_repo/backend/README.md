# 🚀 Backend - Do Zero ao Milhão

Backend seguro e automatizado para processamento de vendas, entrega de ebooks, e-mails e gestão de leads.

## ✨ Funcionalidades

### 🔒 Segurança
- ✅ Proteção XSS (sanitização de inputs)
- ✅ Proteção CSRF (tokens + cookies seguros)
- ✅ Rate limiting (100 req/15min global, 5 req/hora checkout)
- ✅ Validação de todos os formulários (Zod + express-validator)
- ✅ Anti-spam (honeypot fields)
- ✅ Anti-bots (rate limiting + honeypot)
- ✅ Secure Headers (Helmet.js)
- ✅ Logs de erros e atividades (Winston)
- ✅ Preparado para Cloudflare (TRUST_PROXY)
- ✅ Apenas HTTPS (redirect automático)

### 🤖 Automação Completa
1. **Cliente realiza pagamento** → Stripe Checkout
2. **Stripe confirma** → Webhook recebido
3. **Sistema valida** → Assinatura do webhook verificada
4. **Salva no banco** → PostgreSQL (Drizzle ORM)
5. **Envia e-mail** → Nodemailer + SendGrid/SMTP
6. **Adiciona à newsletter** → Mailchimp API
7. **Gera token de download** → 256 bits, expira em 30 dias
8. **Página de sucesso** → Frontend React

## 🛠️ Stack Tecnológica

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Database:** PostgreSQL (Drizzle ORM)
- **Payments:** Stripe
- **Email:** Nodemailer + SendGrid
- **Newsletter:** Mailchimp API
- **Validation:** Zod + express-validator
- **Security:** Helmet, CORS, Rate Limit, Honeypot
- **Logging:** Winston
- **Deploy:** Railway, Render, Fly.io, AWS, Vercel (serverless)

## 📦 Instalação

```bash
cd backend
npm install
```

## 🔐 Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Preencha as variáveis:
- `COOKIE_SECRET`: Gere com `openssl rand -hex 64`
- `STRIPE_SECRET_KEY`: Obtenha em [stripe.com](https://stripe.com)
- `STRIPE_WEBHOOK_SECRET`: Configure em [stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
- `DATABASE_URL`: URL do PostgreSQL (Supabase, Railway, Neon, etc.)
- `SENDGRID_API_KEY`: Obtenha em [sendgrid.com](https://sendgrid.com)
- `MAILCHIMP_API_KEY`: Obtenha em [mailchimp.com](https://mailchimp.com)

## 🚀 Desenvolvimento

```bash
npm run dev
```

Servidor roda em `http://localhost:3000`

## 🏗️ Build

```bash
npm run build
```

## ▶️ Produção

```bash
npm start
```

## 📡 API Endpoints

### POST /checkout/session
Cria sessão de pagamento Stripe

**Body:**
```json
{
  "email": "cliente@email.com",
  "name": "João Silva"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### POST /webhook/stripe
Recebe eventos do Stripe (automático)

**Headers:**
- `Stripe-Signature`: `whsec_...`

### GET /download/:token
Entrega arquivo após validação do token

### POST /newsletter/subscribe
Adiciona e-mail à newsletter

**Body:**
```json
{
  "email": "cliente@email.com",
  "name": "João Silva"
}
```

### GET /health
Verificação de saúde do servidor

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 12345,
  "memory": { "rss": 123456789, "heapTotal": 12345678, "heapUsed": 9876543 }
}
```

## 🗄️ Database Schema

### Tabela: purchases
- `id` (serial, PK)
- `stripe_session_id` (text, unique)
- `stripe_payment_intent_id` (text)
- `email` (text, not null)
- `name` (text, not null)
- `product` (text, not null)
- `amount` (decimal)
- `currency` (text, default: "brl")
- `status` (text, default: "pending")
- `paid_at` (timestamp)
- `metadata` (jsonb)
- `created_at` (timestamp)

### Tabela: downloads
- `id` (serial, PK)
- `purchase_id` (serial, FK → purchases)
- `token` (text, unique)
- `expires_at` (timestamp)
- `used_count` (serial)
- `last_used_ip` (text)
- `created_at` (timestamp)

##  Deploy

### Railway
```bash
railway init
railway up
railway domain
```

### Render
```bash
render deploy
```

### Vercel (Serverless)
Adicione `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    { "src": "src/server.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "src/server.ts" }
  ]
}
```

### Cloudflare + Custom Server
1. Configure domínio no Cloudflare
2. Ative "Always Use HTTPS"
3. Configure proxy (DNS + HTTP proxy)
4. Adicione TRUST_PROXY=true no .env

## 🔧 Integração com Frontend

No frontend, atualize o botão de compra:

```typescript
// src/App.tsx
const handleCheckout = async () => {
  const response = await fetch("https://api.dozeroaomilhao.com/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "cliente@email.com" }),
  });
  const data = await response.json();
  window.location.href = data.url;
};
```

## 📊 Monitoramento

### Logs
- `logs/error.log` - Erros críticos
- `logs/combined.log` - Todas as requisições

### Health Check
```bash
curl https://api.dozeroaomilhao.com/health
```

## 🔐 Segurança Adicional

### Firewall (UFW)
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### Fail2Ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Backup Database
```bash
pg_dump dozeroaomilhao > backup_$(date +%Y%m%d).sql
```

## 📝 Licença

MIT

## 🤝 Suporte

contato@dozeroaomilhao.com
