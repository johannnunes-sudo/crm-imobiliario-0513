import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Plus, ShieldCheck } from "lucide-react";
import { METRICS, ROLES, ROLE_HINT, ROLE_LABEL, type Metric, type Role } from "../../shared/constants";
import { goalForMonth } from "../../shared/goals";
import { computeMetrics } from "../lib/metrics";
import { MONTHS_FULL } from "../lib/format";
import { useCrm } from "../hooks/use-crm";
import { EXIT_STATUS_LABEL, EXIT_TONE, ExitDecisionDialog } from "../components/agency-exit";
import type { AgencyExit } from "../queries/crm";
import { useCopyGoals, useGoalChanges, useResetPassword, useExits, useCreateManager, useCreateUser, usePerms, useSetGoal, useUpdateManager, useUpdateUser, useUsers, useMe, type Manager, type UserRow } from "../queries/crm";
import { authClient, signOut } from "../lib/auth";
import { Avatar, Badge, Button, Field, Input, Modal, PageHeader, PageSkeleton, Panel, PanelHeader, Select, Table, Tabs, useToast } from "../components/ui/kit";
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
  const [cursor, setCursor] = useState(() => new Date());
  const setGoal = useSetGoal();
  const copy = useCopyGoals();
  const changes = useGoalChanges();
  const toast = useToast();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const month = ym(cursor);
  const prevMonth = ym(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const label = (m: string) => `${MONTHS_FULL[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const resolved = (m: Metric) => goalForMonth(c.goals, m, scope, month);
  const inherited = METRICS.some((m) => resolved(m).from !== month);
  const scopeName = scope ? c.managers.find((x) => x.id === scope)?.name : "Equipe";

  // histórico: últimos 6 meses até o mês escolhido, meta × realizado do escopo
  const hist = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, k) => ym(new Date(cursor.getFullYear(), cursor.getMonth() - 5 + k, 1)));
    return months.map((m) => {
      const acts = c.activities.filter((a) => a.status === "Concluída" && a.date.slice(0, 7) === m && (!scope || a.managerId === scope));
      const opps = c.opportunities.filter((o) => o.date.slice(0, 7) === m && (!scope || o.managerId === scope));
      return { m, values: computeMetrics(acts, opps) };
    });
  }, [c.activities, c.opportunities, cursor, scope]);

  return (
    <div className="space-y-5">
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
          <PanelHeader
            title={`Metas de ${label(month)} · ${scopeName}`}
            subtitle="Cada mês tem sua meta. Mês sem meta lançada usa a última definida. Os painéis medem cada mês contra a meta dele."
            right={
              <div className="flex items-center gap-1">
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-md p-1.5 hover:bg-muted" aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
                <span className="w-[120px] text-center text-[13px] font-medium">{label(month)}</span>
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-md p-1.5 hover:bg-muted" aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
              </div>
            }
          />
          {inherited && (
            <div className="mx-5 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-soft px-3 py-2 text-[12.5px] text-[#7a5410]">
              <span>Algumas metas deste mês estão herdadas de meses anteriores (marcadas abaixo). Edite um valor para fixá-lo neste mês.</span>
              <Button size="sm" loading={copy.isPending} onClick={async () => { const r = await copy.mutateAsync({ from: prevMonth, to: month }); toast(r.copied ? `${r.copied} metas copiadas de ${label(prevMonth)}` : "Este mês já tem todas as metas lançadas"); }}>
                Copiar de {label(prevMonth)}
              </Button>
            </div>
          )}
          <div className="grid gap-x-6 px-5 pb-5 sm:grid-cols-2">
            {METRICS.map((m) => {
              const r = resolved(m);
              return (
                <GoalRow
                  key={`${scope}-${month}-${m}`}
                  label={m}
                  note={r.from === month ? undefined : r.from ? `herdada de ${label(r.from)}` : r.from === null ? "meta base" : "sem meta"}
                  value={r.target}
                  onSave={async (target) => {
                    await setGoal.mutateAsync({ month, managerId: scope, metric: m, target });
                    toast(`Meta de ${m.toLowerCase()} em ${label(month)} salva`);
                  }}
                />
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title={`Histórico · ${scopeName}`} subtitle="Meta e realizado dos últimos 6 meses (até o mês escolhido) · realizado / meta" />
        <Table head={["Indicador", ...hist.map((h) => label(h.m).replace(/ \d{4}$/, ""))]}>
          {METRICS.map((m) => (
            <tr key={m}>
              <td className="whitespace-nowrap">{m}</td>
              {hist.map((h) => {
                const g = goalForMonth(c.goals, m, scope, h.m).target;
                const v = h.values[m];
                const r = g ? v / g : 0;
                return (
                  <td key={h.m} className="tnum whitespace-nowrap">
                    <span className={cn("font-medium", !g || h.m > ym(new Date()) ? "text-muted-foreground" : r >= 1 ? "text-brand-strong" : r >= 0.7 ? "text-[#a06c10]" : "text-danger")}>{v}</span>
                    <span className="text-[12px] text-muted-foreground"> / {g || "—"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel>
        <PanelHeader title="Alterações de metas" subtitle="Quem mudou, quando e de quanto para quanto" />
        {(changes.data ?? []).length === 0 ? <p className="px-5 pb-5 text-[13px] text-muted-foreground">Nenhuma alteração registrada ainda.</p> : (
          <Table head={["Quando", "Mês", "Escopo", "Indicador", "De", "Para", "Por"]}>
            {(changes.data ?? []).slice(0, 25).map((x) => (
              <tr key={x.id}>
                <td className="tnum whitespace-nowrap text-muted-foreground">{new Date(x.changedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="whitespace-nowrap">{label(x.month)}</td>
                <td>{x.managerId ? c.managers.find((m) => m.id === x.managerId)?.name : "Equipe"}</td>
                <td>{x.metric}</td>
                <td className="tnum text-muted-foreground">{x.oldTarget ?? "—"}</td>
                <td className="tnum font-medium">{x.newTarget}</td>
                <td className="text-muted-foreground">{x.changedBy}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function GoalRow({ label, value, note, onSave }: { label: string; value: number; note?: string; onSave: (v: number) => Promise<void> }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.max(0, Math.round(Number(v) || 0));
    if (n !== value) void onSave(n);
  };
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3">
      <span className="text-[13.5px]">{label}{note && <span className="ml-2 rounded-full bg-amber-soft px-2 py-0.5 text-[11px] text-[#7a5410]">{note}</span>}</span>
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
