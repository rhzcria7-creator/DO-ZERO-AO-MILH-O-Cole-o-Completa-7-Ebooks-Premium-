import { useEffect, useState, useRef } from "react";
import { PRODUCT } from "../constants/product";
import { auth, loginWithGoogle, logout } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";

interface VerificationResult {
  verified: boolean;
  downloadToken?: string;
  error?: string;
}

type Status = "loading" | "verifying" | "success" | "error";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export default function SuccessPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const downloadStartedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (status === "success") {
      setPurchaseDate(new Date().toLocaleDateString("pt-BR"));
    }
  }, [status]);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;

    const verifyPayment = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");

      if (!sessionId) {
        if (mounted) {
          setStatus("error");
          setErrorMessage("Link de confirmação inválido.");
        }
        return;
      }

      if (!user) {
        if (mounted) {
          setStatus("error");
          setErrorMessage("Faça login para verificar sua compra.");
        }
        return;
      }

      if (mounted) {
        setStatus("verifying");
      }

      const tryVerify = async (): Promise<VerificationResult> => {
        try {
          // Get Firebase ID token for server-side verification
          const idToken = await user.getIdToken();
          
          const response = await fetch(`${API_BASE}/api/purchase/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({ sessionId })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("Verification failed:", error);
          return { verified: false, error: "Falha ao verificar pagamento" };
        }
      };

      const attemptVerification = async () => {
        const result = await tryVerify();

        if (result.verified) {
          if (mounted) {
            setStatus("success");
          }
          return;
        }

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          if (mounted) {
            setTimeout(attemptVerification, RETRY_DELAY);
          }
        } else {
          if (mounted) {
            setStatus("error");
            setErrorMessage(
              "Pagamento não confirmado ou não encontrado. O processamento pode levar alguns minutos."
            );
          }
        }
      };

      // We wait for auth checking before running the verification 
      // so that `user` is populated if already logged in.
      if (!authChecking) {
        await attemptVerification();
      }
    };

    if (!authChecking) {
       verifyPayment();
    }

    return () => {
      mounted = false;
    };
  }, [user, authChecking]);

  const handleResendEmail = async () => {
    if (!user || user.isAnonymous) return;
    setIsResending(true);
    setEmailStatus("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/api/resend-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao reenviar");
      }
      setEmailStatus("E-mail reenviado com sucesso! Verifique sua caixa de entrada e spam.");
    } catch (err: any) {
       console.error(err);
       setEmailStatus(err.message || "Erro ao reenviar o e-mail.");
    } finally {
       setIsResending(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!user || user.isAnonymous) {
      alert("Por favor, faça login para baixar.");
      return;
    }

    if (downloadStartedRef.current || isDownloading) {
      return;
    }

    downloadStartedRef.current = true;
    setIsDownloading(true);

    try {
      // Request secure download token from backend
      // Backend validates purchase status server-side
      const idToken = await user.getIdToken();
      const response = await fetch(`${API_BASE}/api/download/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "E-book não disponível para download. Verifique se sua compra foi confirmada.");
      }

      if (data.downloadToken) {
        // Redirect to secure download endpoint with token
        window.location.href = `${API_BASE}/api/download/${data.downloadToken}`;
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Não foi possível realizar o download.");
    } finally {
      setTimeout(() => {
        downloadStartedRef.current = false;
        setIsDownloading(false);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 radial-bg">
      <div className="noise" />
      <div className="relative max-w-2xl text-center w-full">
        {status === "loading" && (
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto border-4 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
            <p className="mt-6 text-white/60">Preparando...</p>
          </div>
        )}

        {status === "verifying" && (
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto border-4 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
            <p className="mt-6 text-white/60">Confirmando seu pagamento...</p>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-400/10 border-2 border-gold-400 mb-8 glow-pulse">
              <svg
                className="w-10 h-10 text-gold-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <span className="text-xs tracking-[0.3em] uppercase text-gold-400">
              Acesso liberado
            </span>
            <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl font-light leading-[1.05]">
              Pagamento{" "}
              <span className="text-gold-gradient italic">confirmado.</span>
            </h1>

            <p className="mt-6 text-lg text-white/70 max-w-lg mx-auto leading-relaxed">
              Bem-vindo à jornada. Seu{" "}
              <span className="text-white">{PRODUCT.fullName}</span> já está
              pronto para download.
            </p>

            <div className="mt-10 rounded-3xl border border-gold-400/30 bg-gradient-to-b from-gold-400/[0.08] to-transparent backdrop-blur p-7 lg:p-9 shimmer-border text-left">
              <div className="flex items-center gap-5">
                <div className="shrink-0 w-16 h-22 rounded-lg overflow-hidden border border-gold-400/40 bg-black">
                  <img
                    src="/ebook-cover.png"
                    alt="Ebook Do Zero ao Milhão"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-widest uppercase text-gold-400/80">
                    Ebook Premium · {PRODUCT.pages} páginas
                  </div>
                  <h2 className="mt-1 font-display text-xl">
                    {PRODUCT.name}
                  </h2>
                  <div className="text-xs text-mist">
                    {PRODUCT.subtitle}
                  </div>
                </div>
              </div>

              {/* Section to handle login & download */}
              {authChecking ? (
                <div className="mt-6 flex justify-center">
                  <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !user ? (
                <div className="mt-6 p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                  <p className="text-sm text-mist mb-4">Para baixar seu e-book, você precisa confirmar sua identidade.</p>
                  <button 
                    onClick={loginWithGoogle}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Fazer login com Google
                  </button>
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-mist mb-4 pb-4 border-b border-white/10">
                    <div className="space-y-1">
                       <p className="font-medium text-white">Status da Compra: <span className="text-emerald-400">Aprovada</span></p>
                       <p>Data: {purchaseDate}</p>
                       <p>Cliente: {user.email}</p>
                    </div>
                    <button onClick={logout} className="hover:text-white underline self-start mt-1">Sair</button>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gold-400 text-black font-semibold hover:bg-gold-300 transition-colors glow-pulse disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Iniciando download...
                      </>
                    ) : (
                      <>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <path d="M7 10l5 5 5-5" />
                          <path d="M12 15V3" />
                        </svg>
                        Baixar Ebook ({PRODUCT.pages} páginas · PDF)
                      </>
                    )}
                  </button>

                  <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-sm text-mist mb-3">
                      📧 Uma cópia do Ebook também foi enviada para o seu e-mail cadastrado.
                    </p>
                    <button 
                      onClick={handleResendEmail}
                      disabled={isResending}
                      className="text-xs text-gold-400 hover:text-gold-300 underline disabled:opacity-50"
                    >
                      {isResending ? "Reenviando..." : "Reenviar acesso para o e-mail"}
                    </button>
                    {emailStatus && (
                      <p className="mt-2 text-xs text-white/80">{emailStatus}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* TUTORIAL DE DOWNLOAD (SEMPRE ABERTO E SIMPLES) */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left">
              <h3 className="text-sm font-medium text-gold-400 mb-4 tracking-widest uppercase">
                Como Baixar o Ebook
              </h3>
              <ul className="space-y-4 text-sm text-white/80">
                <li className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gold-400/20 text-gold-400 text-xs shrink-0 mt-0.5">1</span>
                  <span><strong>Faça login em sua conta</strong> usando seu e-mail e botão acima.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gold-400/20 text-gold-400 text-xs shrink-0 mt-0.5">2</span>
                  <span>Acesse sua área de cliente (esta página de sucesso).</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gold-400/20 text-gold-400 text-xs shrink-0 mt-0.5">3</span>
                  <span>Clique no botão <strong>"Baixar Ebook"</strong> (amarelo) para requisitar seu PDF seguro.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gold-400/20 text-gold-400 text-xs shrink-0 mt-0.5">4</span>
                  <span>Aguarde o download iniciar automaticamente.</span>
                </li>
              </ul>

              <div className="mt-6 pt-5 border-t border-white/10 text-xs text-mist">
                <p className="font-semibold text-white/80 mb-2">CASO O DOWNLOAD NÃO COMECE:</p>
                <ul className="space-y-1 pl-2">
                  <li>• Atualize a página e tente novamente.</li>
                  <li>• Clique novamente no botão de baixar.</li>
                  <li>• Verifique se há algum bloqueador de pop-ups no navegador.</li>
                  <li>• Tente acessar por outro navegador ou dispositivo.</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <a
                href="/"
                className="btn-ghost !text-sm inline-flex"
              >
                Voltar ao início
              </a>
              <p className="text-xs text-white/50">
                Não recebeu o e-mail? Verifique sua caixa de spam ou{" "}
                <a
                  href="mailto:rhz.cria.7@gmail.com"
                  className="text-gold-400 hover:underline"
                >
                  entre em contato
                </a>
                .
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 mb-8">
              <svg
                className="w-10 h-10 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="font-display text-5xl font-light mb-4">
              Pagamento{" "}
              <span className="text-red-500 italic">não confirmado</span>
            </h1>

            <p className="text-lg text-white/70 mb-6 max-w-lg mx-auto">
              {errorMessage}
            </p>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left max-w-lg mx-auto mb-8">
              <h3 className="text-sm font-medium text-white/80 mb-3">
                O que você pode fazer:
              </h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li>• Aguarde alguns minutos e atualize esta página</li>
                <li>• Verifique se o pagamento foi processado no Stripe</li>
                <li>• Procure o e-mail de confirmação na sua caixa de entrada</li>
                <li>• Verifique sua pasta de spam ou lixo eletrônico</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold-400 text-black font-semibold hover:bg-gold-300 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                </svg>
                Tentar novamente
              </button>
              <a
                href="/checkout"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-gold-400/30 text-gold-400 font-semibold hover:bg-gold-400/10 transition-colors"
              >
                Voltar ao checkout
              </a>
            </div>

            <p className="mt-8 text-xs text-white/40">
              Precisa de ajuda?{" "}
              <a
                href="mailto:rhz.cria.7@gmail.com"
                className="text-gold-400 hover:underline"
              >
                Entre em contato
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
