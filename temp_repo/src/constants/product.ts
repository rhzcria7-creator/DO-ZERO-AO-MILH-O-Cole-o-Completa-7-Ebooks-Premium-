// ============================================================
// PRODUTO ÚNICO — DO ZERO AO MILHÃO
// Fonte única de verdade. Alterar aqui propaga para todo o site.
// ============================================================

export const PRODUCT = {
  name: "Do Zero ao Milhão",
  subtitle: "O Guia Definitivo para Construir Riqueza",
  shortName: "Ebook Premium: Do Zero ao Milhão",
  fullName: "Ebook Do Zero ao Milhão (40 Páginas)",
  pages: 40,
  format: "PDF",
  price: {
    current: "129,90",
    currentNumber: 129.9,
    original: "297,00",
    originalNumber: 297.0,
    discountPct: 56,
    currency: "BRL",
    installments: "ou 12x de R$ 12,89 no cartão",
  },
  guaranteeDays: 7,
} as const;

// ============================================================
// PIX — Dados de pagamento (Mercado Pago)
// ============================================================
export const PIX = {
  receiverName: "Rhian Augusto Reis Lopes",
  cpfMasked: "***.873.036-**",
  institution: "Mercado Pago",
  qrCodeImage: "/qr-code-pix-clean.png",
  // Código copia-e-cola PIX (BR Code EMV)
  copyPaste:
    "00020126580014br.gov.bcb.pix0136b1734aa3-6240-4d95-9194-33387d596f4a5204000053039865406129.905802BR5924Rhian Augusto Reis Lopes6009Sao Paulo62240520daqr3180513534991866630477BB",
} as const;

// ============================================================
// CAPÍTULOS — Os 7 capítulos do ebook único de 40 páginas
// ============================================================
export interface Chapter {
  n: string;
  t: string;
  sub: string;
  d: string;
  highlight?: boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    n: "01",
    t: "O Mapa da Riqueza",
    sub: "Os 5 Pilares",
    d: "A arquitetura completa que sustenta toda grande fortuna. Os cinco pilares que diferenciam quem constrói patrimônio real de quem apenas trabalha por dinheiro.",
    highlight: true,
  },
  {
    n: "02",
    t: "Mentalidade Milionária",
    sub: "Hábitos que multiplicam",
    d: "Os padrões mentais e rotinas diárias de quem pensa como dono. Não é motivação — é engenharia comportamental aplicada ao dinheiro.",
  },
  {
    n: "03",
    t: "Controle Financeiro",
    sub: "Método dos Baldes",
    d: "O sistema simples e visual para organizar receitas, gastos e poupança sem planilhas complicadas. Clareza absoluta sobre cada real que entra e sai.",
  },
  {
    n: "04",
    t: "Aumento de Renda",
    sub: "Primeiro R$ 1.000 extra",
    d: "O caminho mais curto, real e replicável para gerar sua primeira renda complementar — sem precisar pedir demissão nem investir capital.",
  },
  {
    n: "05",
    t: "Negócios e Vendas",
    sub: "A Oferta Irresistível",
    d: "A anatomia de uma oferta que vende sozinha. Como estruturar valor, preço e prova para transformar um produto em fluxo de caixa constante.",
  },
  {
    n: "06",
    t: "Investimentos Inteligentes",
    sub: "Juros Compostos na prática",
    d: "Do zero até a primeira carteira diversificada. Estratégia, risco e tempo — os três motores que fazem o dinheiro trabalhar enquanto você dorme.",
  },
  {
    n: "07",
    t: "Sistema de Execução",
    sub: "Plano de 90 Dias",
    d: "O cronograma definitivo para transformar tudo o que você leu em resultado mensurável nos próximos três meses. Sem teoria solta — só execução.",
  },
];

// ============================================================
// CTA — link único para checkout
// ============================================================
export const CHECKOUT_URL = "/checkout";
