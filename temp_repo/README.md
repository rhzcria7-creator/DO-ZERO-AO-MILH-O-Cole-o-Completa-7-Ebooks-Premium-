# 💸 Do Zero ao Milhão - Sistema Completo de Vendas de eBook

Plataforma de e-commerce completa para venda de ebooks com sistema de pagamentos, entrega segura, automação de e-mails e painel administrativo.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Funcionalidades](#-funcionalidades)
- [Segurança](#-segurança)
- [Stack Tecnológica](#-stack-tecnológica)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Deploy](#-deploy)
- [API Endpoints](#-api-endpoints)
- [Sistema Admin](#-sistema-admin)
- [Monitoramento](#-monitoramento)
- [Customização](#-customização)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Visão Geral

Este projeto é uma solução completa de e-commerce para venda de ebooks, incluindo:

- **Landing Page Premium** - Design responsivo e alta conversão
- **Checkout Seguro** - Integração com Stripe (opcional)
- **Entrega Automática** - Links temporários e assinados
- **Sistema de E-mails** - Confirmações automáticas via SendGrid/SMTP
- **Painel Admin** - Gerenciamento de pedidos e downloads
- **Logs de Auditoria** - Rastreamento completo de atividades

---

## 📦 Estrutura do Projeto

```
do-zero-ao-milhao/
├── src/                        # Frontend React
│   ├── App.tsx                 # Componente principal
│   ├── pages/
│   │   ├── CheckoutPage.tsx   # Página de checkout
│   │   └── SuccessPage.tsx     # Página de sucesso
│   └── ...
├── backend/                    # API Node.js + Express
│   ├── src/
│   │   ├── server.ts           # Servidor principal
│   │   ├── config/
│   │   │   └── env.ts          # Validação de variáveis (Zod)
│   │   ├── routes/
│   │   │   ├── admin.ts        # Painel administrativo
│   │   │   ├── checkout.ts     # Checkout
│   │   │   ├── webhook.ts      # Webhooks
│   │   │   ├── download.ts     # Entrega de arquivos
│   │   │   ├── newsletter.ts   # Newsletter
│   │   │   ├── purchase.ts     # Consulta de compras
│   │   │   └── health.ts       # Health check
│   │   ├── services/
│   │   │   ├── auth.ts         # Autenticação admin
│   │   │   ├── database.ts     # PostgreSQL + Drizzle ORM
│   │   │   ├── download.ts    # Tokens HMAC
│   │   │   ├── email.ts        # Envio de e-mails
│   │   │   ├── newsletter.ts  # Mailchimp API
│   │   │   └── token.ts        # Geração de tokens
│   │   └── middleware/
│   │       └── error-handler.ts
│   ├── database.sql            # Schema do banco
│   └── .env.example            # Template de variáveis
├── public/
│   ├── _headers               # Headers de segurança (Netlify)
│   └── _redirects             # Redirecionamentos
└── README.md                  # Este arquivo
```

---

## ✨ Funcionalidades

### 🎨 Frontend
- ✅ Design premium inspirado em Apple
- ✅ Animações suaves (scroll reveal, parallax, hover effects)
- ✅ 100% responsivo (mobile, tablet, desktop)
- ✅ Performance otimizada
- ✅ SEO completo (meta tags, Open Graph, Schema.org)
- ✅ Checkout integrado

### 🔒 Segurança (Multicamadas)
- ✅ Proteção XSS (sanitização de inputs)
- ✅ Proteção CSRF (tokens + cookies seguros)
- ✅ SQL/NoSQL Injection protection
- ✅ Rate Limiting (100 req/15min global)
- ✅ Honeypot anti-bot
- ✅ Tokens HMAC para downloads
- ✅ Verificação de email hash
- ✅ Logs de auditoria completos
- ✅ Secure Headers (Helmet.js, CSP, HSTS)
- ✅ Autenticação admin com sessões

### 📧 Sistema de E-mails
- ✅ Confirmação de compra
- ✅ Link de download
- ✅ Configuração SendGrid ou SMTP
- ✅ Templates HTML profissionais
- ✅ Fallback graceful (não quebra se não configurado)

### 📊 Automação Completa
1. **Cliente realiza pagamento** → Stripe Checkout (opcional)
2. **Sistema valida** → Webhook validado
3. **Salva no banco** → PostgreSQL
4. **Gera token** → HMAC 256-bit, expira em 30 dias
5. **Envia e-mail** → Confirmação + link
6. **Adiciona à newsletter** → Mailchimp (opcional)
7. **Registra atividade** → Logs completos

---

## 🔐 Segurança

### Arquitetura de Proteção

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  CSP │ XSS Filter │ CORS │ Input Sanitize │ HTTPS           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          BACKEND                             │
│  Helmet │ Rate Limit │ SQL Inject │ HMAC Tokens │ CSRF      │
│  XSS Sanitize │ NoSQL Sanitize │ Audit Logs │ Sessions       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE                                │
│  PostgreSQL │ Drizzle ORM │ Constraints │ Indexes            │
└─────────────────────────────────────────────────────────────┘
```

### Vulnerabilidades Mitigadas

| Vulnerabilidade | Mitigação |
|-----------------|-----------|
| SQL Injection | Drizzle ORM (queries parametrizadas) |
| NoSQL Injection | express-mongo-sanitize |
| XSS | Input sanitization + CSP |
| CSRF | Cookie secret + sessions |
| Brute Force | Rate limiting (3 login/hora) |
| Payment Bypass | Webhook validation + DB status check |
| Token Sharing | Email hash verification |
| Path Traversal | Path validation + restricted paths |

### Headers de Segurança

```http
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

---

## 🛠️ Stack Tecnológica

### Frontend
- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- Framer Motion

### Backend
- Node.js 20+ + Express
- TypeScript
- PostgreSQL + Drizzle ORM
- Stripe API (pagamentos)
- Nodemailer + SendGrid (e-mails)
- Mailchimp API (newsletter)
- Zod (validação)
- Winston (logging)
- Helmet (segurança)

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/rhzcria7-creator/dozeroaomilhao.git
cd dozeroaomilhao
```

### 2. Frontend

```bash
npm install
npm run dev
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite .env com suas credenciais
npm run dev
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# ===========================================
# SERVIDOR
# ===========================================
NODE_ENV=development
PORT=3000
TRUST_PROXY=true

# ===========================================
# DOMÍNIOS (CORS)
# ===========================================
ALLOWED_ORIGINS=https://seu-dominio.com,https://www.seu-dominio.com

# ===========================================
# SESSÃO
# ===========================================
COOKIE_SECRET=gerar-com-openssl-rand-hex-64

# ===========================================
# BANCO DE DADOS (PostgreSQL)
# ===========================================
DATABASE_URL=postgresql://usuario:senha@host:5432/database

# ===========================================
# STRIPE (Opcional - pode estar desabilitado)
# ===========================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# ===========================================
# E-MAIL (SendGrid ou SMTP)
# ===========================================
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG....
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_USER=user@seudominio.com
SMTP_PASS=senha
EMAIL_FROM=noreply@seudominio.com
EMAIL_FROM_NAME=Do Zero ao Milhão

# ===========================================
# DOWNLOAD SEGURO
# ===========================================
DOWNLOAD_SECRET=gerar-com-openssl-rand-hex-64
DOWNLOAD_URL=https://api.seu-dominio.com
DOWNLOAD_FILE_PATH=/caminho/para/ebook.pdf

# ===========================================
# NEWSLETTER (Opcional)
# ===========================================
MAILCHIMP_API_KEY=...
MAILCHIMP_LIST_ID=...

# ===========================================
# ADMIN (Opcional)
# ===========================================
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD_HASH=hash-gerado-com-hashPassword()
```

### Gerar secrets seguros

```bash
# Cookie secret
openssl rand -hex 64

# Download secret
openssl rand -hex 64

# Admin password (via Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📦 Deploy

### Frontend (Vercel)

```bash
npm install -g vercel
vercel --prod
```

**Configurações Vercel:**
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### Backend (Railway/Render/Fly.io)

```bash
cd backend
railway login
railway init
railway up
```

### Database (Supabase/Railway)

```sql
-- Execute database.sql no SQL Editor
```

### Stripe Webhook

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Adicione endpoint: `https://api.seu-dominio.com/webhook/stripe`
3. Eventos: `checkout.session.completed`, `charge.refunded`
4. Copie o signing secret para `STRIPE_WEBHOOK_SECRET`

---

## 📡 API Endpoints

### POST /checkout/session
Cria sessão de pagamento (requer email válido)

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

### GET /api/purchase/:sessionId
Consulta status de compra

### GET /api/download/:token
Download do eBook (com validação HMAC)

### POST /newsletter/subscribe
Adiciona à newsletter

```json
{
  "email": "cliente@email.com",
  "name": "João Silva"
}
```

### GET /health
Health check

---

## 👨‍💼 Sistema Admin

O painel administrativo fornece acesso a:

- **Estatísticas** - Vendas, receita, downloads
- **Compras** - Lista completa com paginação
- **Detalhes** - Cada compra com logs de atividade
- **Inscritos** - Newsletter subscribers
- **Downloads** - Estatísticas de acesso
- **Atividade** - Logs de auditoria

### Autenticação

```bash
# POST /admin/login
curl -X POST https://api.seu-dominio.com/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@seudominio.com","password":"suasenha"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Login realizado"
}
```

### Endpoints Admin

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /admin/login | Autenticar |
| POST | /admin/logout | Encerrar sessão |
| GET | /admin/stats | Estatísticas |
| GET | /admin/purchases | Lista de compras |
| GET | /admin/purchases/:id | Detalhes da compra |
| GET | /admin/subscribers | Lista de inscritos |
| GET | /admin/downloads | Estatísticas de downloads |
| GET | /admin/activity | Logs de atividade |
| POST | /admin/resend-download | Reenviar link |

---

## 📊 Monitoramento

### Logs

```bash
# Backend
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Health Check

```bash
curl https://api.seu-dominio.com/health
curl https://api.seu-dominio.com/admin/health
```

---

## 🎨 Customização

### Cores

Edite `tailwind.config.ts`:

```typescript
colors: {
  primary: "#F5C542",
  secondary: "#0A0A0A",
}
```

### Textos

Edite `src/App.tsx` - todos os textos estão inline.

### Preço

Configure no Stripe Dashboard.

---

## 🔧 Troubleshooting

### Erro "Email transporter not configured"

Configure as variáveis de e-mail no `.env`:
- `SENDGRID_API_KEY` ou
- `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS`

### Erro "Token inválido"

1. Verifique se o `DOWNLOAD_SECRET` está correto
2. Verifique se o arquivo existe em `DOWNLOAD_FILE_PATH`
3. Verifique se o token não expirou (30 dias)

### Erro "Database not configured"

Configure `DATABASE_URL` no `.env` com string PostgreSQL válida.

---

## 📝 Licença

MIT

---

**Construído com ❤️ para empreendedores que querem automatizar suas vendas.**