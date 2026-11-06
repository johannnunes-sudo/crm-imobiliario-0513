import { useEffect, useState } from "react";
import { LogOut, Plus, ShieldCheck } from "lucide-react";
import { METRICS, ROLES, ROLE_HINT, ROLE_LABEL, type Role } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { EXIT_STATUS_LABEL, EXIT_TONE, ExitDecisionDialog } from "../components/agency-exit";
import type { AgencyExit } from "../queries/crm";
import { useResetPassword, useExits, useCreateManager, useCreateUser, usePerms, useSetGoal, useUpdateManager, useUpdateUser, useUsers, useMe, type Manager, type UserRow } from "../queries/crm";
import { authClient, signOut } from "../lib/auth";
import { Avatar, Badge, Button, Field, Input, Modal, PageHeader, PageSkeleton, Panel, PanelHeader, Select, Tabs, useToast } from "../components/ui/kit";
import { cn } from "../lib/utils";

type Tab = "usuarios" | "saidas" | "metas" | "gerentes" | "conta";
const COLORS = ["#5FAE3A", "#1F3A2E", "#C98A1B", "#6B8F7E", "#3E7CB1", "#8A5A9E", "#C8473F"];

export default function Configuracoes() {
  const c = useCrm();
  const { isAdmin } = usePerms();
  const users = useUsers(isAdmin);
  const exitsQ = useExits();
  const [tab, setTab] = useState<Tab>(isAdmin ? "usuarios" : "conta");
  if (c.isLoading) return <PageSkeleton />;
  const pending = (users.data ?? []).filter((u) => u.role === "pendente").length;
  const pendingExits = (exitsQ.data ?? []).filter((x) => x.status === "pendente").length;
  const options = isAdmin
    ? [
        { value: "usuarios" as Tab, label: "Usuários e acessos", count: users.data?.length },
        { value: "saidas" as Tab, label: "Saídas da carteira", count: pendingExits || undefined },
        { value: "metas" as Tab, label: "Metas" },
        { value: "gerentes" as Tab, label: "Equipe", count: c.managers.length },
        { value: "conta" as Tab, label: "Minha conta" },
      ]
    : [{ value: "conta" as Tab, label: "Minha conta" }];
  return (
    <>
      <PageHeader title="Configurações" subtitle={isAdmin ? "Usuários, metas, equipe comercial e conta" : "Sua conta"} />
      <div className="mb-5 flex items-center gap-3">
        <Tabs value={tab} onChange={setTab} options={options} />
        {isAdmin && pending > 0 && <Badge tone="amber" dot>{pending} aguardando liberação</Badge>}
        {isAdmin && pendingExits > 0 && <Badge tone="amber" dot>{pendingExits} saída{pendingExits > 1 ? "s" : ""} para decidir</Badge>}
      </div>
      {tab === "usuarios" && isAdmin && <UsersEditor />}
      {tab === "saidas" && isAdmin && <ExitsPanel rows={exitsQ.data ?? []} />}
      {tab === "metas" && isAdmin && <GoalsEditor />}
      {tab === "gerentes" && isAdmin && <ManagersEditor />}
      {tab === "conta" && <Account />}
    </>
  );
}

const ROLE_TONE: Record<Role, "brand" | "forest" | "amber" | "neutral"> = { admin: "forest", gerente: "brand", aprovador: "amber", pendente: "neutral" };

function ExitsPanel({ rows }: { rows: AgencyExit[] }) {
  const c = useCrm();
  const [sel, setSel] = useState<AgencyExit | null>(null);
  const pend = rows.filter((r) => r.status === "pendente");
  const done = rows.filter((r) => r.status !== "pendente");
  const ag = (id: number) => c.agencies.find((a) => a.id === id)?.name ?? "—";
  const mg = (id: number | null) => c.managers.find((m) => m.id === id)?.name ?? "Roleta";
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="Solicitações pendentes" subtitle="A imobiliária continua na carteira e nos indicadores da gerente até a decisão" right={<Badge tone={pend.length ? "amber" : "brand"}>{pend.length}</Badge>} />
        {pend.length === 0 ? <p className="px-5 pb-5 text-[13px] text-muted-foreground">Nenhuma solicitação aguardando decisão.</p> : (
          <div className="divide-y divide-border border-t border-border">
            {pend.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">{ag(r.agencyId)} <span className="font-normal text-muted-foreground">· carteira de {mg(r.managerId)}</span></div>
                  <div className="text-[12.5px] text-muted-foreground">{r.reason}{r.note ? ` — ${r.note}` : ""} · pedido por {r.requestedBy} em {new Date(r.createdAt).toLocaleDateString("pt-BR")}</div>
                </div>
                <Button size="sm" variant="primary" onClick={() => setSel(r)}>Decidir</Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel>
        <PanelHeader title="Histórico" subtitle="Inativações, transferências, recusas e reativações" />
        {done.length === 0 ? <p className="px-5 pb-5 text-[13px] text-muted-foreground">Sem registros.</p> : (
          <div className="divide-y divide-border border-t border-border">
            {done.slice(0, 30).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-[12.5px]">
                <Badge tone={EXIT_TONE[r.status]} dot>{EXIT_STATUS_LABEL[r.status]}</Badge>
                <span className="font-medium">{ag(r.agencyId)}</span>
                <span className="text-muted-foreground">{r.reason ?? ""}{r.status === "transferida" ? ` → ${mg(r.toManagerId)}` : ""}{r.decisionNote ? ` · ${r.decisionNote}` : ""}</span>
                <span className="ml-auto text-subtle">{r.decidedBy} · {new Date(r.decidedAt ?? r.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <ExitDecisionDialog exit={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function UsersEditor() {
  const c = useCrm();
  const users = useUsers();
  const me = useMe();
  const update = useUpdateUser();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const rows = users.data ?? [];
  const mgrName = (id: number | null) => c.managers.find((m) => m.id === id)?.name;

  const change = async (u: UserRow, patch: { role?: Role; managerId?: number | null; active?: boolean }) => {
    try {
      await update.mutateAsync({ userId: u.id, ...patch });
      toast(`Acesso de ${u.name} atualizado`);
    } catch (e) {
      toast((e as Error).message || "Não foi possível salvar");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <Panel>
        <PanelHeader
          title="Usuários e níveis de acesso"
          subtitle="Cada gerente vê só a própria carteira. Administradores e aprovação de vendas veem tudo."
          right={<Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus className="size-3.5" /> Novo usuário</Button>}
        />
        <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_auto] gap-3 border-t border-border px-5 py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-subtle md:grid">
          <span>Usuário</span><span>Perfil</span><span>Carteira</span><span className="w-[84px]" />
        </div>
        <div className="divide-y divide-border border-t border-border">
          {rows.map((u) => {
            const self = u.id === me.data?.id;
            return (
              <div key={u.id} className={cn("grid items-center gap-3 px-5 py-3 md:grid-cols-[1.4fr_1.2fr_1fr_auto]", !u.active && "opacity-55")}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={u.name} color={u.managerId ? c.manager(u.managerId)?.color : "#1F3A2E"} size={30} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{u.name}{self && <span className="ml-1.5 text-[11.5px] font-normal text-subtle">(você)</span>}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{u.email}</div>
                  </div>
                </div>
                <Select value={u.role} disabled={self} onChange={(e) => void change(u, { role: e.target.value as Role })} className="h-8 text-[13px]">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
                {u.role === "gerente" ? (
                  <Select value={u.managerId ?? ""} onChange={(e) => void change(u, { managerId: e.target.value ? Number(e.target.value) : null })} className="h-8 text-[13px]">
                    <option value="">Criar carteira com o nome</option>
                    {c.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                ) : (
                  <span className="text-[12.5px] text-muted-foreground">{u.role === "pendente" ? "—" : "Todas as carteiras"}</span>
                )}
                <div className="flex justify-end gap-1">
                  {!self && <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>Senha</Button>}
                  {!self && <Button size="sm" variant="ghost" onClick={() => void change(u, { active: !u.active })}>{u.active ? "Desativar" : "Reativar"}</Button>}
                </div>
                {u.role === "gerente" && u.managerId && (
                  <div className="text-[11.5px] text-subtle md:col-span-4 md:-mt-1 md:pl-[42px]">
                    Carteira de {mgrName(u.managerId)} · {c.agencies.filter((a) => a.managerId === u.managerId).length} imobiliárias
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel className="h-fit">
        <PanelHeader title="O que cada perfil faz" />
        <div className="space-y-3.5 px-5 pb-5">
          {ROLES.map((r) => (
            <div key={r}>
              <Badge tone={ROLE_TONE[r]} dot>{ROLE_LABEL[r]}</Badge>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{ROLE_HINT[r]}</p>
            </div>
          ))}
          <p className="flex gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-brand" />
            Imobiliárias não podem ser cadastradas em duplicidade: o sistema avisa em qual carteira ela já está.
          </p>
        </div>
      </Panel>
      <NewUserModal open={adding} onClose={() => setAdding(false)} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const reset = useResetPassword();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (user) { setPw(""); setErr(""); } }, [user]);
  const save = async () => {
    if (!user) return;
    try {
      await reset.mutateAsync({ userId: user.id, password: pw });
      toast(`Nova senha definida para ${user.name}`);
      onClose();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Redefinir senha"
      subtitle={user ? `${user.name} · ${user.email} — as sessões abertas dessa pessoa serão encerradas. Passe a senha provisória por um canal seguro e peça para trocar em Minha conta.` : ""}
      width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} loading={reset.isPending} disabled={pw.length < 8}>Definir senha</Button></>}
    >
      <Field label="Nova senha provisória" hint="Mínimo de 8 caracteres"><Input value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      {err && <p className="mt-3 text-[12.5px] text-danger">{err}</p>}
    </Modal>
  );
}

function NewUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCrm();
  const create = useCreateUser();
  const toast = useToast();
  const empty = { name: "", email: "", password: "", role: "gerente" as Role, managerId: "" };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setF(empty); setErr(""); } }, [open]);
  const valid = f.name.trim() && /.+@.+\..+/.test(f.email) && f.password.length >= 8;
  const save = async () => {
    setErr("");
    try {
      await create.mutateAsync({ name: f.name, email: f.email, password: f.password, role: f.role, managerId: f.managerId ? Number(f.managerId) : null });
      toast(`Usuário ${f.name} criado`);
      onClose();
    } catch (e) {
      setErr((e as Error).message || "Não foi possível criar o usuário");
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo usuário"
      subtitle="A pessoa entra com este e-mail e a senha provisória, e pode trocá-la em Minha conta."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} loading={create.isPending} disabled={!valid}>Criar usuário</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="E-mail corporativo"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Perfil" hint={ROLE_HINT[f.role]}>
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {ROLES.filter((r) => r !== "pendente").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        {f.role === "gerente" ? (
          <Field label="Carteira" hint="Sem escolher, cria uma carteira nova com o nome do usuário">
            <Select value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })}>
              <option value="">Nova carteira</option>
              {c.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
        ) : <div />}
        <Field label="Senha provisória" hint="Mínimo de 8 caracteres"><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 text-[12.5px] text-danger">{err}</p>}
    </Modal>
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
