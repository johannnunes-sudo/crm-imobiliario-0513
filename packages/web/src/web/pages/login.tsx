import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { ArrowRight, Loader2 } from "lucide-react";
import { authClient } from "../lib/auth";
import { Field, Input } from "../components/ui/kit";

export default function LoginPage() {
  const { data: session } = authClient.useSession();
  const [, nav] = useLocation();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res =
      mode === "in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
    setLoading(false);
    if (res.error) {
      setError(
        res.error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-mail ou senha incorretos."
          : res.error.code === "USER_ALREADY_EXISTS" || res.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Já existe uma conta com este e-mail."
            : res.error.message ?? "Não foi possível entrar.",
      );
      return;
    }
    nav("/");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel da marca */}
      <div className="relative hidden bg-forest lg:flex lg:items-center lg:justify-center">
        <div className="flex items-center gap-5 text-white">
          <img src="/images/logo-white.png" alt="" className="size-16" />
          <span className="font-display text-[34px] font-semibold tracking-[0.02em]">PORTO FLORÊNCIO</span>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-[360px]">
          <img src="/images/logo.png" alt="" className="mb-8 size-10 lg:hidden" />
          <h2 className="text-[24px] font-semibold">{mode === "in" ? "Entrar" : "Criar conta"}</h2>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {mode === "in" ? "Acesse com seu e-mail corporativo." : "Cadastre um novo usuário da equipe comercial."}
          </p>
          <div className="mt-8 space-y-4">
            {mode === "up" && (
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-10" />
              </Field>
            )}
            <Field label="E-mail">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
            </Field>
            <Field label="Senha">
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
            </Field>
          </div>
          {error && <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest text-[14px] font-medium text-white transition-colors hover:bg-[#173026] disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <>{mode === "in" ? "Entrar" : "Criar conta"} <ArrowRight className="size-4" /></>}
          </button>
          <div className="mt-6 text-center text-[13px] text-muted-foreground">
            {mode === "in" ? "Novo na equipe?" : "Já tem conta?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); }} className="font-medium text-brand-strong hover:underline">
              {mode === "in" ? "Criar conta" : "Entrar"}
            </button>
          </div>
          {mode === "in" && (
            <p className="mt-8 text-[12px] text-muted-foreground">Esqueceu a senha? Peça a um administrador para redefinir.</p>
          )}
        </form>
      </div>
    </div>
  );
}
