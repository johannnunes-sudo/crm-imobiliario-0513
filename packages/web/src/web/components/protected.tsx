import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { Clock, Loader2, LogOut } from "lucide-react";
import { authClient, signOut } from "../lib/auth";
import { useMe } from "../queries/crm";

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-6">{children}</div>;
}

export function Protected({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const me = useMe();
  if (isPending || (data && me.isLoading))
    return (
      <Center>
        <Loader2 className="size-5 animate-spin text-brand" />
      </Center>
    );
  if (!data) return <Redirect to="/login" />;
  const blocked = me.data && (me.data.role === "pendente" || !me.data.active);
  if (blocked)
    return (
      <Center>
        <div className="max-w-sm rounded-xl border border-border bg-card p-7 text-center">
          <Clock className="mx-auto size-8 text-brand" />
          <h2 className="mt-3 text-[18px] font-semibold">{me.data!.active ? "Acesso aguardando liberação" : "Acesso desativado"}</h2>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            {me.data!.active
              ? "Sua conta foi criada. Um administrador precisa definir seu perfil antes de você acessar o CRM."
              : "Seu usuário foi desativado. Fale com um administrador."}
          </p>
          <p className="mt-1 text-[12.5px] text-subtle">{me.data!.email}</p>
          <button onClick={signOut} className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-muted">
            <LogOut className="size-3.5" /> Sair
          </button>
        </div>
      </Center>
    );
  return <>{children}</>;
}
