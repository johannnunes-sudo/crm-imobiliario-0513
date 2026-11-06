import { useEffect, useState } from "react";
import { LogOut, Plus } from "lucide-react";
import { METRICS } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { useCreateManager, useSetGoal, useUpdateManager, type Manager } from "../queries/crm";
import { authClient, signOut } from "../lib/auth";
import { Avatar, Badge, Button, Field, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Tabs, useToast } from "../components/ui/kit";
import { cn } from "../lib/utils";

type Tab = "metas" | "gerentes" | "conta";
const COLORS = ["#5FAE3A", "#1F3A2E", "#C98A1B", "#6B8F7E", "#3E7CB1", "#8A5A9E", "#C8473F"];

export default function Configuracoes() {
  const c = useCrm();
  const [tab, setTab] = useState<Tab>("metas");
  if (c.isLoading) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Configurações" subtitle="Metas, equipe comercial e conta" />
      <div className="mb-5">
        <Tabs value={tab} onChange={setTab} options={[{ value: "metas", label: "Metas" }, { value: "gerentes", label: "Equipe", count: c.managers.length }, { value: "conta", label: "Minha conta" }]} />
      </div>
      {tab === "metas" && <GoalsEditor />}
      {tab === "gerentes" && <ManagersEditor />}
      {tab === "conta" && <Account />}
    </>
  );
}

function GoalsEditor() {
  const c = useCrm();
  const [scope, setScope] = useState<number | null>(null);
  const setGoal = useSetGoal();
  const toast = useToast();
  const current = (m: string) => c.goals.find((g) => g.metric === m && (g.managerId ?? null) === scope)?.target ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <Panel className="h-fit p-2">
        {[{ id: null as number | null, name: "Equipe (consolidado)", color: "#1F3A2E" }, ...c.managers].map((m) => (
          <button
            key={m.id ?? "team"}
            onClick={() => setScope(m.id)}
            className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors", scope === m.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
          >
            <Avatar name={m.id ? m.name : "Equipe Porto"} color={m.color} size={24} />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </Panel>
      <Panel>
        <PanelHeader title="Metas mensais" subtitle="Valores por mês. Em trimestres e acumulados, a meta é multiplicada pelo número de meses. Atividades planejadas não contam até serem concluídas." />
        <div className="grid gap-x-6 px-5 pb-5 sm:grid-cols-2">
          {METRICS.map((m) => (
            <GoalRow
              key={`${scope}-${m}`}
              label={m}
              value={current(m)}
              onSave={async (target) => {
                await setGoal.mutateAsync({ managerId: scope, metric: m, target });
                toast(`Meta de ${m.toLowerCase()} salva`);
              }}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function GoalRow({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => Promise<void> }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.max(0, Math.round(Number(v) || 0));
    if (n !== value) void onSave(n);
  };
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3">
      <span className="text-[13.5px]">{label}</span>
      <Input className="tnum h-8 w-24 text-right" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
    </div>
  );
}

function ManagersEditor() {
  const c = useCrm();
  const [edit, setEdit] = useState<Partial<Manager> | null>(null);
  const create = useCreateManager();
  const update = useUpdateManager();
  const toast = useToast();

  const save = async () => {
    if (!edit?.name?.trim()) return;
    const body = { name: edit.name.trim(), email: edit.email || null, color: edit.color ?? COLORS[0] };
    if (edit.id) await update.mutateAsync({ id: edit.id, ...body });
    else await create.mutateAsync(body);
    toast(edit.id ? "Gerente atualizado" : "Gerente adicionado");
    setEdit(null);
  };

  return (
    <Panel>
      <PanelHeader title="Gerentes comerciais" subtitle="Responsáveis pelas carteiras de imobiliárias" right={<Button size="sm" variant="primary" onClick={() => setEdit({ color: COLORS[c.managers.length % COLORS.length] })}><Plus className="size-3.5" /> Adicionar</Button>} />
      <div className="divide-y divide-border border-t border-border">
        {c.managers.map((m) => {
          const ags = c.agencies.filter((a) => a.managerId === m.id);
          return (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={m.name} color={m.color} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">{m.name}</div>
                <div className="text-[12.5px] text-muted-foreground">{m.email || "sem e-mail"} · {ags.length} imobiliárias</div>
              </div>
              {!m.active && <Badge>Inativo</Badge>}
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: m.id, active: !m.active })}>{m.active ? "Desativar" : "Reativar"}</Button>
              <Button size="sm" onClick={() => setEdit(m)}>Editar</Button>
            </div>
          );
        })}
      </div>

      {edit && (
        <div className="border-t border-border bg-muted/40 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Nome"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Cor">
              <div className="flex h-8.5 items-center gap-1.5">
                {COLORS.map((col) => (
                  <button key={col} onClick={() => setEdit({ ...edit, color: col })} className={cn("size-6 rounded-full ring-offset-2 transition", edit.color === col && "ring-2 ring-foreground/40")} style={{ background: col }} aria-label={col} />
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save} loading={create.isPending || update.isPending} disabled={!edit.name?.trim()}>Salvar</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Account() {
  const { data: session } = authClient.useSession();
  const toast = useToast();
  const [name, setName] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(session?.user.name ?? ""), [session?.user.name]);

  const saveName = async () => {
    setBusy(true);
    await authClient.updateUser({ name });
    setBusy(false);
    toast("Perfil atualizado");
  };
  const changePw = async () => {
    setErr("");
    if (next.length < 8) return setErr("A nova senha precisa ter ao menos 8 caracteres.");
    setBusy(true);
    const r = await authClient.changePassword({ currentPassword: cur, newPassword: next });
    setBusy(false);
    if (r.error) return setErr("Senha atual incorreta.");
    setCur("");
    setNext("");
    toast("Senha alterada");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Perfil" />
        <div className="space-y-4 px-5 pb-5">
          <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="E-mail"><Input value={session?.user.email ?? ""} disabled /></Field>
          <div className="flex justify-between">
            <Button variant="danger" onClick={() => void signOut()}><LogOut className="size-3.5" /> Sair</Button>
            <Button variant="primary" onClick={saveName} loading={busy} disabled={!name.trim()}>Salvar perfil</Button>
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Alterar senha" />
        <div className="space-y-4 px-5 pb-5">
          <Field label="Senha atual"><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          {err && <p className="text-[12.5px] text-danger">{err}</p>}
          <div className="flex justify-end"><Button variant="primary" onClick={changePw} loading={busy} disabled={!cur || !next}>Alterar senha</Button></div>
        </div>
      </Panel>
    </div>
  );
}
