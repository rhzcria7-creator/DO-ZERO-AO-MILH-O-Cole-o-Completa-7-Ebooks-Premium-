import { useEffect, useRef, useState, ReactNode } from "react";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { PRODUCT, CHAPTERS, CHECKOUT_URL } from "./constants/product";

// ============================================================
// Split Text (blur + rise)
// ============================================================
function SplitText({ text, className = "", delay = 0, stagger = 80 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  // split por PALAVRA (não caractere) — evita que letras pareçam faltando durante a animação
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block mr-[0.22em] align-baseline">
          {word.split("").map((ch, ci) => (
            <span
              key={ci}
              className="split-char inline-block"
              style={{ animationDelay: `${delay + wi * stagger + ci * 15}ms` }}
            >
              {ch}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

// ============================================================
// CountUp
// ============================================================
function CountUp({ end, duration = 1800, prefix = "", suffix = "", decimals = 0 }: { end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Number((eased * end).toFixed(decimals)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.25 });
    io.observe(node);
    return () => io.disconnect();
  }, [end, duration, decimals]);
  return (
    <span ref={ref} className="count-wrap">{prefix}{val}{suffix}</span>
  );
}

// ============================================================
// Click spark (pixel blast)
// ============================================================
function ClickSpark({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; dy: number; color: string }[]>([]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const colors = ["#F5C542", "#F8D570", "#D9A82B", "#ffffff", "#F5C542"];
    const onClick = (e: MouseEvent) => {
      const t = e.currentTarget as HTMLElement;
      const rect = t.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const batch = Array.from({ length: 10 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 10;
        const dist = 40 + Math.random() * 40;
        return {
          id: Date.now() + i, x, y,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          color: colors[i % colors.length],
        };
      });
      setSparks((s) => [...s, ...batch]);
      setTimeout(() => setSparks((s) => s.filter((sp) => !batch.find((b) => b.id === sp.id))), 1000);
    };
    el.addEventListener("click", onClick as any);
    return () => el.removeEventListener("click", onClick as any);
  }, []);
  return (
    <div ref={ref} className="relative">
      {children}
      {sparks.map((s) => (
        <span key={s.id} className="pixel-spark" style={{ left: s.x, top: s.y, background: s.color, ["--dx" as any]: `${s.dx}px`, ["--dy" as any]: `${s.dy}px` }} />
      ))}
    </div>
  );
}

// ============================================================
// Spotlight Card
// ============================================================
function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card ${className}`}>
      <div className="spotlight-inner" />
      <div className="relative">{children}</div>
    </div>
  );
}

// ============================================================
// LOGO LOOP (infinite marquee no estilo react-bits)
// ============================================================
function LogoLoop({
  items,
  speed = "normal",
  direction = "left",
  className = "",
}: {
  items: { icon?: ReactNode; label: string }[];
  speed?: "slow" | "normal" | "fast";
  direction?: "left" | "right";
  className?: string;
}) {
  const speedClass =
    speed === "slow" ? "marquee-track-slow" : speed === "fast" ? "marquee-track" : "marquee-track";
  const dirClass = direction === "right" ? "marquee-track-reverse" : speedClass;
  const doubled = [...items, ...items];
  return (
    <div className={`logo-loop overflow-hidden ${className}`}>
      <div className={`flex gap-4 w-max ${dirClass}`}>
        {doubled.map((it, i) => (
          <div key={i} className="logo-loop-item">
            {it.icon && <span className="text-gold-400">{it.icon}</span>}
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CAROUSEL (auto-play com snap suave)
// ============================================================
function Carousel<T>({
  items,
  renderItem,
  autoPlay = true,
  interval = 5500,
  perView = 1,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  autoPlay?: boolean;
  interval?: number;
  perView?: 1 | 2 | 3;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = items.length;

  useEffect(() => {
    if (!autoPlay || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), interval);
    return () => clearInterval(id);
  }, [autoPlay, paused, interval, total]);

  const offset = -(index * (100 / perView));

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="carousel-container overflow-hidden">
        <div
          ref={trackRef}
          className="carousel-track"
          style={{ transform: `translateX(${offset}%)` }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="carousel-slide"
              style={{ width: `calc((100% - ${(perView - 1) * 1.5}rem) / ${perView})` }}
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
      {/* Dots */}
      <div className="mt-10 flex items-center justify-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            aria-label={`Ir para slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`carousel-dot ${i === index ? "active" : ""}`}
          />
        ))}
      </div>
      {/* Arrows */}
      <button
        aria-label="Anterior"
        onClick={() => setIndex((i) => (i - 1 + total) % total)}
        className="absolute left-2 top-1/2 -translate-y-1/2 -translate-x-2 lg:translate-x-0 lg:-left-4 w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:border-gold-400/60 hover:text-gold-400 transition-all"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button
        aria-label="Próximo"
        onClick={() => setIndex((i) => (i + 1) % total)}
        className="absolute right-2 top-1/2 -translate-y-1/2 translate-x-2 lg:translate-x-0 lg:-right-4 w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:border-gold-400/60 hover:text-gold-400 transition-all"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  );
}

// ============================================================
// LOGO (SVG fiel ao design) — LETRA "1" + BARRAS + SETA
// (Refatorado — geometria limpa, única referência, sem duplicadas)
// ============================================================
function Logo({ size = "md", withText = true, glow = false }: { size?: "sm" | "md" | "lg" | "xl"; withText?: boolean; glow?: boolean }) {
  const sizes = {
    sm: { w: 28, h: 28, text: "text-[10px]" },
    md: { w: 36, h: 36, text: "text-xs" },
    lg: { w: 160, h: 160, text: "text-2xl" },
    xl: { w: 280, h: 280, text: "text-3xl md:text-5xl" },
  };
  const s = sizes[size];
  return (
    <div className="flex flex-col items-center relative select-none">
      {glow && <div className="absolute -z-10 w-[140%] h-[140%] rounded-full bg-gold-400/25 logo-glow blur-[100px]" aria-hidden="true" />}
      <img
        src="/logo-icon.png"
        width={s.w}
        height={s.h}
        alt="Do Zero ao Milhão"
        className={`logo-float ${size === "xl" || size === "lg" ? "drop-shadow-[0_20px_50px_rgba(245,197,66,0.25)]" : ""}`}
        style={{ width: s.w, height: s.h }}
      />
      {withText && (
        <div className={`mt-5 font-bold tracking-[0.25em] text-center ${s.text} whitespace-nowrap`}>
          <span className="text-gold-400">DO ZERO</span>
          <span className="text-white"> AO </span>
          <span className="text-gold-400">MILHÃO</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LOGO LARGE (para hero e brand showcase)
// ============================================================
function LogoLarge() {
  return (
    <div className="flex flex-col items-center relative">
      <div className="absolute -z-10 w-[500px] h-[500px] rounded-full bg-gold-400/20 logo-glow blur-[120px]" aria-hidden="true" />
      <Logo size="xl" withText={false} />
      <div className="mt-8 font-bold tracking-[0.3em] text-center text-2xl md:text-4xl whitespace-nowrap">
        <span className="text-gold-gradient">DO ZERO</span>
        <span className="text-white"> AO </span>
        <span className="text-gold-gradient">MILHÃO</span>
      </div>
    </div>
  );
}

// ============================================================
// CAPÍTULOS (importados de constants/product.ts)
// O ebook único de 40 páginas é composto por 7 capítulos estratégicos.
// ============================================================

// ============================================================
// NAV (staggered / flowing menu)
// ============================================================
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    { href: "#problema", label: "O Problema" },
    { href: "#dentro", label: "Os Capítulos" },
    { href: "#oferta", label: "Oferta" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-black/75 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
      <nav className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <Logo size="sm" withText={false} />
          <span className="text-sm font-medium tracking-tight hidden sm:inline">Do Zero ao Milhão</span>
        </a>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          {links.map((l, i) => (
            <a key={i} href={l.href} className="menu-link hover:text-white transition">{l.label}</a>
          ))}
        </div>
        <ClickSpark>
          <a href={CHECKOUT_URL} className="btn-primary !py-2 !px-5 !text-sm">
            Quero o Ebook
          </a>
        </ClickSpark>
      </nav>
    </header>
  );
}

// ============================================================
// HERO
// ============================================================
function Hero() {
  return (
    <section id="top" className="relative min-h-screen radial-bg overflow-hidden pt-32 pb-24">
      <div className="noise" />
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "80px 80px", maskImage: "radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)" }} />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <div className="hero-anim-1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-400/30 bg-gold-400/5 text-gold-400 text-xs font-medium tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
            Edição 2026 · Ebook Premium · 40 Páginas
          </div>
          <h1 className="hero-anim-2 mt-6 font-display text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.08] tracking-tight">
            <span className="block">
              <SplitText text="Você não precisa" className="block" delay={100} />
            </span>
            <span className="block">
              <span className="hero-gold-phrase">nascer rico</span>
            </span>
            <span className="block">
              <SplitText text="para construir" className="block" delay={850} />
            </span>
            <span className="italic font-normal">
              <SplitText text="riqueza." className="block" delay={1250} />
            </span>
          </h1>
          <p className="hero-anim-3 mt-8 text-lg lg:text-xl text-mist max-w-xl leading-relaxed">
            Um manual completo de <span className="text-white font-medium">40 páginas</span> de puro conteúdo estratégico sobre os princípios, hábitos e sistemas que transformam pessoas comuns em construtores de patrimônio.
            Investimento único de <span className="text-gold-400 font-medium">R$ {PRODUCT.price.current}</span> — acesso imediato.
          </p>
          <div className="hero-anim-4 mt-10 flex flex-col sm:flex-row gap-4">
            <ClickSpark>
              <a href={CHECKOUT_URL} className="btn-primary glow-pulse inline-flex">
                Quero o Guia Definitivo
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </a>
            </ClickSpark>
            <a href="#dentro" className="btn-ghost">Ver os 7 Capítulos</a>
          </div>
          <div className="hero-anim-4 mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 7.6H22l-6.2 4.5 2.4 7.5L12 17l-6.2 4.6 2.4-7.5L2 9.6h7.4z"/></svg>
              4.9 · Avaliação média
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <div className="hidden sm:block">Acesso imediato · PDF</div>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <div className="hidden sm:flex items-center gap-2"><span className="text-gold-400 font-medium">40 páginas</span> · estratégia pura</div>
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[520px] h-[520px] rounded-full bg-gold-400/15 blur-[140px] logo-glow" />
          </div>
          <div className="hero-anim-book relative">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-gold-400/30 via-transparent to-gold-400/10 blur-2xl" aria-hidden="true" />
              <img
                src="/ebook-cover.png"
                alt="Ebook Do Zero ao Milhão"
                width={420}
                height={609}
                loading="eager"
                fetchPriority="high"
                className="relative w-[280px] sm:w-[340px] lg:w-[420px] h-auto rounded-2xl shadow-[0_40px_100px_-20px_rgba(245,197,66,0.35)] border border-gold-400/20 logo-float"
              />
              <div className="absolute -bottom-4 -right-4 bg-gold-400 text-black text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full shadow-2xl">
                40 Páginas · Premium
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-widest flex flex-col items-center gap-2">
        <span>ROLE PARA DESCOBRIR</span>
        <div className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent" />
      </div>
    </section>
  );
}

// ============================================================
// TRUST BAR (CountUp + Marquee)
// ============================================================
function TrustBar() {
  const stats = [
    { v: 3200, suffix: "+", l: "Leitores transformando" },
    { v: 4.9, decimals: 1, suffix: "", l: "Avaliação média" },
    { v: 40, suffix: "", l: "Páginas de estratégia" },
    { v: 7, suffix: "", l: "Capítulos · Sistema Completo" },
  ];
  return (
    <section className="bg-black border-y border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <div key={i} className={`reveal reveal-delay-${i + 1} text-center`}>
            <div className="font-display text-3xl md:text-4xl text-gold-gradient">
              <CountUp end={s.v} suffix={s.suffix} decimals={(s as any).decimals ?? 0} />
            </div>
            <div className="mt-2 text-xs uppercase tracking-widest text-white/50">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 py-6 space-y-3">
        <LogoLoop
          speed="normal"
          direction="left"
          items={[
            { label: "O Mapa da Riqueza", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 00-8 8c0 4 4 6 4 10h8c0-4 4-6 4-10a8 8 0 00-8-8z"/></svg> },
            { label: "Mentalidade Milionária", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4 8 4v14"/></svg> },
            { label: "Controle Financeiro", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg> },
            { label: "Aumento de Renda", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg> },
            { label: "Negócios e Vendas", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
            { label: "Investimentos Inteligentes", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg> },
            { label: "Sistema de Execução · 90 Dias", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/></svg> },
          ]}
        />
        <LogoLoop
          speed="slow"
          direction="right"
          items={[
            { label: "PDF · Acesso Imediato", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> },
            { label: "Garantia de 7 Dias", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg> },
            { label: "Pix · Cartão · Boleto", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg> },
            { label: "Compra 100% Segura", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
            { label: "Atualizações Vitalícias", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg> },
            { label: "Bônus: Plano de 90 Dias", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
            { label: "+3.200 Leitores Ativos", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg> },
          ]}
        />
      </div>
    </section>
  );
}

// ============================================================
// TESTIMONIALS CAROUSEL
// ============================================================
function Testimonials() {
  const testimonials = [
    {
      name: "Rafael Andrade",
      role: "Empreendedor · São Paulo",
      stars: 5,
      text: "Comecei a ler sem grandes expectativas. Em uma semana já tinha mudado minha relação com dinheiro. 40 páginas que valem por um curso inteiro. Vale cada centavo.",
      initial: "R",
    },
    {
      name: "Juliana Mendes",
      role: "Designer · Rio de Janeiro",
      stars: 5,
      text: "Conteúdo direto, sem enrolação. Em vez de mais um curso com horas de vídeo, li o ebook em duas noites e apliquei na semana seguinte. O melhor investimento que fiz em educação financeira.",
      initial: "J",
    },
    {
      name: "Marcos Oliveira",
      role: "Engenheiro · Belo Horizonte",
      stars: 5,
      text: "O capítulo de Investimentos Inteligentes mudou minha forma de pensar sobre risco e retorno. Pela primeira vez entendi de verdade. Já recomendei para 5 amigos.",
      initial: "M",
    },
    {
      name: "Carolina Souza",
      role: "Médica · Curitiba",
      stars: 5,
      text: "Sou cética com promessas de gurus. Aqui é diferente: nada de fórmula mágica, só método claro e aplicável. O Plano de 90 Dias sozinho já vale o ebook inteiro.",
      initial: "C",
    },
    {
      name: "Bruno Carvalho",
      role: "Analista · Porto Alegre",
      stars: 5,
      text: "Comprei pelo preço, fiquei pelo conteúdo. Cada capítulo se conecta com o próximo de forma lógica. Não tem enrolação — 40 páginas, sete temas, um sistema inteiro.",
      initial: "B",
    },
    {
      name: "Larissa Pereira",
      role: "Professora · Salvador",
      stars: 5,
      text: "Ler na ordem dos capítulos foi a melhor escolha. Sem a base de Mentalidade, eu teria pulado direto para investimentos e fracassado. Recomendo seguir o livro do início ao fim.",
      initial: "L",
    },
  ];

  return (
    <section className="relative py-28 lg:py-40 bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-gold-400/5 blur-[160px]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl mx-auto text-center reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">★ · Quem já leu</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            Histórias de quem <span className="italic text-gold-gradient">deu o primeiro passo.</span>
          </h2>
        </div>

        <div className="mt-16 reveal reveal-delay-1 max-w-6xl mx-auto">
          <Carousel
            items={testimonials}
            perView={1}
            interval={6000}
            renderItem={(t) => (
              <div className="mx-1">
                <Spotlight className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur p-10 lg:p-14 min-h-[280px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-6">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <svg key={i} className="w-4 h-4 text-gold-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 7.6H22l-6.2 4.5 2.4 7.5L12 17l-6.2 4.6 2.4-7.5L2 9.6h7.4z"/></svg>
                      ))}
                    </div>
                    <p className="font-display text-2xl lg:text-3xl font-light leading-relaxed text-white/90 italic">"{t.text}"</p>
                  </div>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-black font-semibold text-lg">
                      {t.initial}
                    </div>
                    <div>
                      <div className="font-medium tracking-tight">{t.name}</div>
                      <div className="text-xs text-mist tracking-wider uppercase mt-0.5">{t.role}</div>
                    </div>
                  </div>
                </Spotlight>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// PROBLEM
// ============================================================
function Problem() {
  const items = [
    { t: "Falta de direção financeira", d: "Você trabalha, economiza, mas parece que o dinheiro nunca se transforma em patrimônio real.", icon: <path d="M12 2v20M2 12h20" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" /> },
    { t: "Falta de estratégia", d: "Decisões impulsivas, investimentos sem método e resultados inconsistentes.", icon: <path d="M4 4l16 16M20 4L4 20" strokeWidth="1.5" strokeLinecap="round" /> },
    { t: "Conhecimento raso", d: "Conteúdo fragmentado em vídeos rasos que nunca se conectam em um sistema completo.", icon: <><circle cx="12" cy="12" r="9" strokeWidth="1.5" fill="none" /><path d="M8 12h8" strokeWidth="1.5" strokeLinecap="round" /></> },
    { t: "Excesso de ruído", d: "Gurus prometendo riqueza rápida com promessas irreais que não funcionam no mundo real.", icon: <path d="M3 12h3l3-8 4 16 3-8h5" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> },
  ];
  return (
    <section id="problema" className="relative bg-black py-28 lg:py-40">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">01 · O Diagnóstico</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            A distância entre onde você está e <span className="italic text-gold-gradient">onde quer chegar</span> não é sorte.
          </h2>
          <p className="mt-6 text-lg text-mist leading-relaxed">
            É método. É clareza. É sistema. E a maioria das pessoas simplesmente nunca teve acesso a um.
          </p>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((it, i) => (
            <Spotlight key={i} className={`reveal reveal-delay-${i + 1} rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur card-hover`}>
              <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-gold-400 mb-6">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">{it.icon}</svg>
              </div>
              <h3 className="font-medium text-lg tracking-tight">{it.t}</h3>
              <p className="mt-3 text-sm text-mist leading-relaxed">{it.d}</p>
            </Spotlight>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CHANGE
// ============================================================
function Change() {
  return (
    <section className="relative py-28 lg:py-40 bg-ink-900 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gold-400/10 blur-[140px]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">02 · A Virada</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            O que muda quando você <span className="italic text-gold-gradient">tem um método.</span>
          </h2>
        </div>
        <div className="mt-16 grid md:grid-cols-2 gap-6 lg:gap-8">
          <div className="reveal reveal-delay-1 relative p-10 rounded-3xl border border-white/10 bg-black/40">
            <div className="text-xs tracking-[0.3em] uppercase text-white/40 mb-6">Antes</div>
            <ul className="space-y-5">
              {["Confusão sobre por onde começar", "Improvisação nas decisões financeiras", "Sensação de estar correndo em círculos", "Dependência de um salário fixo"].map((t) => (
                <li key={t} className="flex items-start gap-4">
                  <span className="mt-1 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-white/40"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span>
                  <span className="text-white/70">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal reveal-delay-2 relative p-10 rounded-3xl border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.08] to-transparent shimmer-border">
            <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-6">Depois</div>
            <ul className="space-y-5">
              {["Clareza sobre cada próximo passo", "Planejamento estruturado e realista", "Execução consistente e mensurável", "Construção progressiva de patrimônio"].map((t) => (
                <li key={t} className="flex items-start gap-4">
                  <span className="mt-1 w-5 h-5 rounded-full bg-gold-400 flex items-center justify-center text-black"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.8 2.8L8 3.5"/></svg></span>
                  <span className="text-white">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CHAPTERS / EBOOKS (Spotlight)
// ============================================================
function Chapters() {
  return (
    <section id="dentro" className="relative py-28 lg:py-40 bg-black">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 reveal">
          <div className="max-w-2xl">
            <span className="text-xs tracking-[0.3em] uppercase text-gold-400">03 · Dentro do Ebook</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
              Sete capítulos. <br /><span className="italic text-gold-gradient">Um sistema completo.</span>
            </h2>
          </div>
          <p className="lg:max-w-sm text-mist leading-relaxed">
            40 páginas de puro conteúdo estratégico, divididas em sete capítulos sequenciais que se conectam do primeiro pensamento à primeira execução. Leia do início ao fim — ou volte a qualquer um como referência.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CHAPTERS.map((c, i) => (
            <Spotlight
              key={i}
              className={`reveal reveal-delay-${(i % 3) + 1} rounded-2xl border p-8 backdrop-blur card-hover ${c.highlight ? "border-gold-400/40 bg-gradient-to-br from-gold-400/[0.07] to-black shimmer-border" : "border-white/10 bg-white/[0.02]"}`}
            >
              <div className="flex items-start justify-between mb-6">
                <span className={`font-display text-5xl ${c.highlight ? "text-gold-400/60" : "text-white/10 group-hover:text-gold-400/40"} transition-colors`}>{c.n}</span>
                {c.highlight ? (
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-black bg-gold-400 px-2.5 py-1 rounded-full">Comece aqui</span>
                ) : (
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-gold-400 border border-gold-400/40 px-2 py-1 rounded-full">Capítulo</span>
                )}
              </div>
              <h3 className="text-xl font-medium tracking-tight">{c.t}</h3>
              <div className="mt-1 text-[11px] tracking-widest uppercase text-gold-400/70">{c.sub}</div>
              <p className="mt-3 text-sm text-mist leading-relaxed flex-1">{c.d}</p>
            </Spotlight>
          ))}

          {/* CTA Card — Produto Único */}
          <Spotlight className="reveal reveal-delay-1 rounded-2xl p-8 border border-gold-400/40 bg-gradient-to-br from-gold-400/10 to-black glow-gold flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <svg className="w-7 h-7 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.3 2.3 7.3L12 16.7 5.7 21l2.3-7.3-6-4.3h7.6z"/></svg>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-black bg-gold-400 px-2.5 py-1 rounded-full">PRODUTO ÚNICO · 40 PÁGINAS</span>
            </div>
            <h3 className="font-display text-2xl font-light tracking-tight">O Guia Definitivo</h3>
            <p className="mt-3 text-sm text-mist leading-relaxed flex-1">
              Um manual completo de 40 páginas — todos os 7 capítulos integrados em um único PDF premium. Acesso imediato após o Pix.
            </p>
            <div className="mt-6 pt-5 border-t border-white/10 flex items-end justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs text-white/40 line-through">R$ {PRODUCT.price.original}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-mist">R$</span>
                  <span className="font-display text-3xl text-gold-gradient">{PRODUCT.price.current}</span>
                </div>
              </div>
              <ClickSpark>
                <a href={CHECKOUT_URL} className="btn-primary !px-5 !py-2.5 !text-sm">Comprar</a>
              </ClickSpark>
            </div>
          </Spotlight>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// BENEFITS
// ============================================================
function Benefits() {
  const benefits = [
    { t: "Os 5 Pilares da Riqueza", d: "O mapa completo que sustenta todo grande patrimônio." },
    { t: "Hábitos que multiplicam", d: "Mentalidade milionária aplicada ao seu dia a dia." },
    { t: "Método dos Baldes", d: "Sistema visual para controlar cada real que entra e sai." },
    { t: "Primeiro R$ 1.000 extra", d: "O caminho mais curto para sua renda complementar." },
    { t: "A Oferta Irresistível", d: "Anatomia de uma venda que se sustenta sozinha." },
    { t: "Plano de 90 Dias", d: "Da teoria ao resultado mensurável em três meses." },
  ];
  return (
    <section className="relative py-28 lg:py-40 bg-ink-900">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">04 · O Que Você Ganha</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            Mais que informação. <br /><span className="italic text-gold-gradient">Uma nova forma de pensar.</span>
          </h2>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <Spotlight key={i} className={`reveal reveal-delay-${(i % 3) + 1} rounded-2xl border border-white/5 bg-black/40 p-6 card-hover`}>
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>
                </div>
                <div>
                  <h3 className="font-medium tracking-tight">{b.t}</h3>
                  <p className="mt-1.5 text-sm text-mist">{b.d}</p>
                </div>
              </div>
            </Spotlight>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// BRAND SHOWCASE
// ============================================================
function BrandShowcase() {
  return (
    <section className="relative py-28 lg:py-40 bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-gold-400/5 blur-[160px]" />
      </div>
      <div className="relative max-w-5xl mx-auto px-6 lg:px-10 text-center">
        <div className="reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">05 · A Marca</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            Um símbolo. <br /><span className="italic text-gold-gradient">Um compromisso com o topo.</span>
          </h2>
          <p className="mt-6 text-mist max-w-2xl mx-auto leading-relaxed">
            Cada detalhe foi pensado para representar crescimento, precisão e ambição — os mesmos valores que constroem patrimônio real.
          </p>
        </div>
        <div className="reveal reveal-delay-1 mt-20 relative inline-block">
          <div className="absolute inset-0 -z-10 flex items-center justify-center">
            <div className="w-[400px] h-[400px] rounded-full bg-gold-400/10 blur-[120px]" />
          </div>
          <Logo size="lg" withText={true} />
        </div>
        <div className="mt-20 grid sm:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5 reveal reveal-delay-2">
          {[
            { k: "Mentalidade", v: "A seta aponta para cima. Sempre." },
            { k: "Precisão", v: "Cada capítulo é um passo calculado." },
            { k: "Legado", v: "Construa algo que dure gerações." },
          ].map((x) => (
            <div key={x.k} className="bg-black p-8">
              <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-2">{x.k}</div>
              <div className="text-sm text-white/80">{x.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// AUDIENCE
// ============================================================
function Audience() {
  const targets = [
    { t: "Iniciantes", d: "Que querem começar certo desde o primeiro passo." },
    { t: "Empreendedores", d: "Que buscam estruturar suas finanças com seriedade." },
    { t: "Profissionais", d: "Em transição para o próximo nível de autonomia financeira." },
    { t: "Curiosos da educação financeira", d: "Cansados de conteúdo raso e promessas vazias." },
  ];
  return (
    <section className="relative py-28 lg:py-40 bg-ink-900">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="reveal">
            <span className="text-xs tracking-[0.3em] uppercase text-gold-400">06 · Para Quem É</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
              Feito para quem quer <span className="italic text-gold-gradient">levar a sério.</span>
            </h2>
            <p className="mt-6 text-lg text-mist leading-relaxed max-w-lg">
              Se você está disposto a aprender com profundidade — não apenas consumir — estes ebooks foram escritos para você.
            </p>
          </div>
          <div className="space-y-3">
            {targets.map((t, i) => (
              <Spotlight key={i} className={`reveal reveal-delay-${i + 1} flex items-start gap-4 p-5 rounded-2xl border border-white/5 bg-black/40 card-hover`}>
                <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-gold-400 flex items-center justify-center text-black">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.8 2.8L10 3.5"/></svg>
                </div>
                <div>
                  <h3 className="font-medium tracking-tight">{t.t}</h3>
                  <p className="mt-1 text-sm text-mist">{t.d}</p>
                </div>
              </Spotlight>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ
// ============================================================
function FaqItem({ q, a, open, onClick }: { q: string; a: string; open: boolean; onClick: () => void }) {
  return (
    <div className="acc-item">
      <button onClick={onClick} className="w-full flex items-center justify-between gap-6 py-6 text-left group">
        <span className="font-medium text-lg lg:text-xl tracking-tight group-hover:text-gold-400 transition-colors">{q}</span>
        <span className={`acc-chevron shrink-0 w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-gold-400 ${open ? "open" : ""}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
        </span>
      </button>
      <div className={`acc-content ${open ? "open" : ""}`}>
        <div><p className="pb-6 text-mist leading-relaxed max-w-3xl">{a}</p></div>
      </div>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const items = [
    { q: "O que exatamente eu recebo na compra?", a: `Você recebe o ebook completo "${PRODUCT.name} — ${PRODUCT.subtitle}", em PDF, com 40 páginas de conteúdo estratégico distribuído em 7 capítulos sequenciais. O acesso é imediato após a confirmação do Pix.` },
    { q: "Por que apenas 40 páginas? Esse é o ebook inteiro?", a: "Sim. 40 páginas de puro conteúdo, sem enrolação. Cortamos preenchimento, repetição e teoria solta — só o que move o ponteiro. É um manual completo, não um resumo." },
    { q: "Como funciona o pagamento via Pix?", a: `Ao clicar em comprar, você é levado ao checkout seguro. Lá, escaneia o QR Code ou copia o código Pix e paga pelo app do seu banco. O pagamento de R$ ${PRODUCT.price.current} é processado pelo Mercado Pago e seu acesso é liberado em poucos minutos.` },
    { q: "Posso parcelar?", a: `A oferta promocional de R$ ${PRODUCT.price.current} é exclusiva para Pix à vista. No cartão, ${PRODUCT.price.installments.toLowerCase()}.` },
    { q: "Existe garantia?", a: `Sim. Você tem ${PRODUCT.guaranteeDays} dias de garantia incondicional. Se o conteúdo não fizer sentido para você, devolvemos 100% do valor investido, sem perguntas.` },
    { q: "Preciso de conhecimento prévio em finanças?", a: "Não. O ebook foi escrito para ser acessível mesmo a quem nunca estudou finanças, sem abrir mão da profundidade. Cada conceito é explicado do zero." },
    { q: "Como recebo o material após o pagamento?", a: "Assim que o Pix é confirmado pelo Mercado Pago, você recebe o link de download por e-mail e também tem acesso imediato pela página de confirmação. O link fica válido por 30 dias." },
  ];
  return (
    <section id="faq" className="relative py-28 lg:py-40 bg-black">
      <div className="max-w-4xl mx-auto px-6 lg:px-10">
        <div className="text-center reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">07 · Perguntas Frequentes</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">Tire suas <span className="italic">dúvidas.</span></h2>
        </div>
        <div className="mt-14 reveal reveal-delay-1">
          {items.map((it, i) => <FaqItem key={i} q={it.q} a={it.a} open={open === i} onClick={() => setOpen(open === i ? null : i)} />)}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// OFFER
// ============================================================
function Offer() {
  return (
    <section id="oferta" className="relative py-28 lg:py-40 overflow-hidden" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,197,66,0.10), transparent 60%), #000" }}>
      <div className="noise" />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-10">
        <div className="text-center reveal">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">08 · A Oferta</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            Um único investimento. <br /><span className="italic text-gold-gradient">Uma virada de chave.</span>
          </h2>
          <p className="mt-6 text-mist max-w-xl mx-auto">
            O Guia Definitivo em PDF — 40 páginas, 7 capítulos, um sistema completo. Pague uma vez, leia para sempre, aplique nos próximos 90 dias.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-[0.9fr,1.1fr] gap-6 items-stretch max-w-5xl mx-auto">
          {/* Mockup */}
          <div className="reveal reveal-delay-1 rounded-[28px] border border-white/10 bg-gradient-to-br from-gold-400/[0.06] via-black to-black p-10 lg:p-12 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gold-400/15 blur-[100px]" />
            </div>
            <div className="relative">
              <img
                src="/ebook-cover.png"
                alt="Ebook Do Zero ao Milhão"
                width={300}
                height={435}
                loading="lazy"
                className="w-[220px] sm:w-[260px] lg:w-[300px] h-auto rounded-xl shadow-[0_40px_80px_-20px_rgba(245,197,66,0.4)] border border-gold-400/30 logo-float"
              />
              <div className="absolute -top-3 -right-3 bg-gold-400 text-black text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full shadow-2xl">
                40 Páginas
              </div>
            </div>
          </div>

          {/* Oferta */}
          <Spotlight className="reveal reveal-delay-2 rounded-[28px] border border-gold-400/40 bg-gradient-to-b from-gold-400/[0.08] to-transparent backdrop-blur-xl p-10 lg:p-12 shimmer-border glow-pulse">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-[0.3em] uppercase text-gold-400">Ebook Premium · Edição 2026</div>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-black bg-gold-400 px-2.5 py-1 rounded-full">−{PRODUCT.price.discountPct}%</span>
            </div>
            <h3 className="mt-3 font-display text-3xl font-light tracking-tight">{PRODUCT.name} — {PRODUCT.subtitle}</h3>
            <p className="mt-2 text-sm text-mist">O manual completo de 40 páginas. Pagamento único via Pix.</p>
            <div className="mt-6 flex flex-col">
              <span className="text-sm text-white/40 line-through">R$ {PRODUCT.price.original}</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-sm text-mist">por</span>
                <span className="font-display text-5xl lg:text-6xl text-gold-gradient">R$ {PRODUCT.price.current}</span>
              </div>
            </div>
            <span className="text-xs text-mist mt-1">à vista no Pix · {PRODUCT.price.installments.toLowerCase()}</span>
            <div className="hairline my-7" />
            <div className="space-y-3 flex-1">
              {[
                "Ebook completo em PDF · 40 páginas",
                "7 capítulos estratégicos integrados",
                "Acesso e download imediatos após o Pix",
                "Leitura em qualquer dispositivo (mobile, tablet, desktop)",
                "Atualizações gratuitas vitalícias",
                `Garantia incondicional de ${PRODUCT.guaranteeDays} dias`,
              ].map((it, i) => (
                <div key={i} className="flex items-start gap-3 list-item-anim" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gold-400 flex items-center justify-center text-black"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.2 2.2L8 3.5"/></svg></span>
                  <span className="text-white/90 text-sm">{it}</span>
                </div>
              ))}
            </div>
            <ClickSpark>
              <a href={CHECKOUT_URL} className="btn-primary mt-8 w-full !py-4 text-lg inline-flex justify-center">
                Quero o Guia Definitivo
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </a>
            </ClickSpark>
          </Spotlight>
        </div>

        <div className="reveal reveal-delay-2 mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-mist">
          <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Compra 100% segura</span>
          <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>Garantia de 7 dias</span>
          <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.3 2.3 7.3L12 16.7 5.7 21l2.3-7.3-6-4.3h7.6z"/></svg>Pagamento processado pelo Mercado Pago</span>
        </div>

        <p className="reveal reveal-delay-2 mt-10 text-center text-xs text-mist max-w-2xl mx-auto leading-relaxed">
          Este é um material educacional. Resultados dependem exclusivamente da sua aplicação. Não há promessas de enriquecimento rápido nem garantias de rentabilidade — apenas método, clareza e um sistema real de construção de patrimônio.
        </p>
      </div>
    </section>
  );
}

// ============================================================
// FINAL CTA
// ============================================================
function FinalCta() {
  return (
    <section className="relative py-32 lg:py-48 bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full bg-gold-400/10 blur-[160px]" />
      </div>
      <div className="noise" />
      <div className="relative max-w-4xl mx-auto px-6 lg:px-10 text-center reveal">
        <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[0.95]">
          Comece hoje. <br /><span className="italic text-gold-gradient">Construa amanhã.</span>
        </h2>
        <p className="mt-8 text-lg lg:text-xl text-mist max-w-xl mx-auto leading-relaxed">
          O melhor momento para plantar uma árvore foi há vinte anos. O segundo melhor é agora.
        </p>
        <ClickSpark>
          <a href={CHECKOUT_URL} className="btn-primary glow-pulse mt-12 !px-12 !py-5 text-lg inline-flex">
            Começar Minha Jornada Agora
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </a>
        </ClickSpark>
        <p className="mt-6 text-xs text-white/40 tracking-widest uppercase">Ebook Premium · 40 páginas · R$ {PRODUCT.price.current} no Pix</p>
      </div>
    </section>
  );
}

// ============================================================
// FOOTER
// ============================================================
function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" withText={false} />
          <span className="text-sm font-medium tracking-tight">Do Zero ao Milhão</span>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/50">
          <a href="#" className="menu-link hover:text-white transition">Termos</a>
          <a href="#" className="menu-link hover:text-white transition">Privacidade</a>
          <a href="#" className="menu-link hover:text-white transition">Contato</a>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} · Todos os direitos reservados.</p>
      </div>
      <p className="max-w-7xl mx-auto px-6 lg:px-10 pb-10 text-[11px] text-white/30 leading-relaxed">
        Aviso legal: Este produto é educacional e não constitui recomendação de investimento. Rentabilidades passadas não são garantia de resultados futuros. Toda decisão financeira é de inteira responsabilidade do leitor.
      </p>
    </footer>
  );
}

// ============================================================
// APP
// ============================================================
import SuccessPage from "./pages/SuccessPage";
import CheckoutPage from "./pages/CheckoutPage";

export default function App() {
  useScrollReveal();

  const path =
    (window as any).__FORCED_PATH__ || window.location.pathname;

  // Roteamento simples
  if (path === "/checkout") {
    return <CheckoutPage />;
  }
  if (path === "/sucesso" || window.location.search.includes("session_id")) {
    return <SuccessPage />;
  }

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <Hero />
        <TrustBar />
        <Problem />
        <Change />
        <Chapters />
        <Benefits />
        <BrandShowcase />
        <Audience />
        <Testimonials />
        <Faq />
        <Offer />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
