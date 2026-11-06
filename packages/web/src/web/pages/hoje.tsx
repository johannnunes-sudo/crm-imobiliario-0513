import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertTriangle, Check, ChevronRight, Clock, Plus } from "lucide-react";
import { useCrm } from "../hooks/use-crm";
import { useMe, usePerms, useUpdateActivity, type Activity } from "../queries/crm";
import { daysSince, goalFor } from "../lib/metrics";
import { isoDate, MONTHS_FULL } from "../lib/format";
import { LEAD_DOT, leadKind } from "../lib/lead";
import { NextStepDialog } from "../components/next-step";
import { Avatar, Button, PageSkeleton, Panel, Progress, useToast } from "../components/ui/kit";
import { cn } from "../lib/utils";

const VISIT = "Visita à imobiliária";
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function workdays(d: Date) {
  let n = 0;
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  while (x.getMonth() === d.getMonth()) {
    if (x.getDay() % 6 !== 0) n++;
    x.setDate(x.getDate() + 1);
  }
  return n;
}

/** Tela "Hoje": o dia da gerente — meta de visitas do dia, agenda com check e alertas da carteira */
export default function Hoje() {
  const c = useCrm();
  const me = useMe();
  const perms = usePerms();
  const update = useUpdateActivity();
  const toast = useToast();
  const [, nav] = useLocation();
  const [doneAct, setDoneAct] = useState<Activity | null>(null);
  const [showDone, setShowDone] = useState(false);
  const now = new Date();
  const today = isoDate(now);
  const month = today.slice(0, 7);

  const d = useMemo(() => {
    const acts = c.scoped.activities;
    const todays = acts.filter((a) => a.date === today && a.status !== "Cancelada").sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    const visitsToday = todays.filter((a) => a.type === VISIT && a.status === "Concluída").length;
    const visitsMonth = acts.filter((a) => a.type === VISIT && a.status === "Concluída" && a.date.slice(0, 7) === month).length;
    const scopeId = perms.isManager ? (me.data?.managerId ?? null) : c.filters.managerId;
    const teamDivisor = perms.isManager ? Math.max(1, c.managers.length) : 1;
    const monthGoal = goalFor(c.goals, "Visitas a imobiliárias", scopeId, 1) || Math.round(goalFor(c.goals, "Visitas a imobiliárias", null, 1) / teamDivisor);
    const dayGoal = monthGoal ? Math.ceil(monthGoal / workdays(now)) : 0;
    const overdue = acts.filter((a) => a.status === "Planejada" && a.date < today).length;
    const tomorrow = acts.filter((a) => a.status === "Planejada" && a.date > today).sort((a, b) => a.date.localeCompare(b.date));
    const active = c.scoped.agencies.filter((a) => a.active);
    const risk = active.map((a) => ({ a, days: daysSince(a, c.lastMap) })).filter((r) => r.days >= 45).sort((x, y) => y.days - x.days);
    const touched = new Set(acts.filter((a) => a.status === "Concluída" && a.date.slice(0, 7) === month).map((a) => a.agencyId));
    return { todays, visitsToday, visitsMonth, monthGoal, dayGoal, overdue, next: tomorrow.slice(0, 3), risk, covered: active.filter((a) => touched.has(a.id)).length, portfolio: active.length };
  }, [c, today, month, perms.isManager, me.data?.managerId]); // eslint-disable-line

  if (c.isLoading) return <PageSkeleton />;

  const first = (me.data?.name ?? "").split(" ")[0];
  const hour = now.getHours();
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const check = (a: Activity) => {
    update.mutate({ id: a.id, status: "Concluída" });
    toast("Concluída · contabilizada nos indicadores");
    setDoneAct(a);
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold">{hello}{first ? `, ${first}` : ""}</h1>
        <p className="text-[13px] text-muted-foreground">{WEEK[now.getDay()]}, {now.getDate()} de {MONTHS_FULL[now.getMonth()].toLowerCase()}</p>
      </div>

      <Panel className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[12.5px] text-muted-foreground">Visitas a imobiliárias hoje</div>
            <div className="mt-0.5 text-[34px] font-semibold leading-none">{d.visitsToday}<span className="text-[18px] font-normal text-muted-foreground"> / {d.dayGoal || "—"}</span></div>
          </div>
          {d.dayGoal > 0 && d.visitsToday >= d.dayGoal && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-forest">Meta do dia batida</span>}
        </div>
        <Progress value={d.dayGoal ? d.visitsToday / d.dayGoal : 0} className="mt-3 h-2.5" />
        <div className="mt-3 flex justify-between text-[12.5px] text-muted-foreground">
          <span>No mês: <b className="text-foreground">{d.visitsMonth}{d.monthGoal ? `/${d.monthGoal}` : ""}</b></span>
          <span>Carteira trabalhada: <b className="text-foreground">{d.portfolio ? Math.round((d.covered / d.portfolio) * 100) : 0}%</b></span>
        </div>
      </Panel>

      <Panel className="mt-4">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-[15px] font-medium">Agenda de hoje</h2>
          <Link to="/agenda" className="text-[12.5px] font-medium text-brand-strong">Ver agenda</Link>
        </div>
        {d.todays.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted-foreground">Nada agendado para hoje. Use o botão Registrar para lançar o que fizer.</p>
        ) : (
          <div className="divide-y divide-border">
            {d.todays.filter((a) => showDone || a.status !== "Concluída").map((a) => {
              const done = a.status === "Concluída";
              const m = c.manager(a.managerId);
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("size-2 shrink-0 rounded-full", LEAD_DOT[leadKind(a)])} title="Cor = antecedência do agendamento" />
                  <button type="button" onClick={() => a.agencyId && nav(`/imobiliarias/${a.agencyId}`)} className="min-w-0 flex-1 text-left">
                    <div className={cn("truncate text-[14px] font-medium", done && "text-muted-foreground line-through decoration-1")}>
                      {a.time && <span className="tnum mr-1.5 text-muted-foreground">{a.time}</span>}{c.agencyName(a.agencyId)}
                    </div>
                    <div className="truncate text-[12.5px] text-muted-foreground">{a.type}{a.notes ? ` · ${a.notes}` : ""}</div>
                  </button>
                  {perms.seesAll && m && <Avatar name={m.name} color={m.color} size={22} />}
                  {done ? (
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-white" aria-label="Concluída"><Check className="size-5" strokeWidth={3} /></span>
                  ) : (
                    <button type="button" onClick={() => check(a)} aria-label={`Concluir ${a.type}`} className="flex size-9 items-center justify-center rounded-lg border-2 border-border-strong text-transparent hover:border-brand hover:text-brand">
                      <Check className="size-5" strokeWidth={3} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {d.todays.some((a) => a.status === "Concluída") && (
          <button type="button" onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-[13px] text-brand-strong">
            <Check className="size-4" strokeWidth={3} /> {d.todays.filter((a) => a.status === "Concluída").length} concluídas hoje · {showDone ? "esconder" : "mostrar"}
          </button>
        )}
        {d.overdue > 0 && (
          <Link to="/agenda" className="flex items-center gap-2 border-t border-border px-4 py-3 text-[13px] text-danger">
            <Clock className="size-4" /> {d.overdue} planejada{d.overdue > 1 ? "s" : ""} vencida{d.overdue > 1 ? "s" : ""} sem check <ChevronRight className="ml-auto size-4" />
          </Link>
        )}
      </Panel>

      {d.risk.length > 0 && (
        <Panel className="mt-4 border-[#f3d2cc] bg-[#fdf3f1]">
          <div className="flex items-center gap-2 px-4 pt-4 pb-1 text-[14px] font-medium text-danger"><AlertTriangle className="size-4" /> {d.risk.length} imobiliária{d.risk.length > 1 ? "s" : ""} perto da regra dos 60 dias</div>
          <div className="px-2 pb-2">
            {d.risk.slice(0, 5).map((r) => (
              <Link key={r.a.id} to={`/imobiliarias/${r.a.id}`} className="flex items-center justify-between rounded-md px-2 py-2 text-[13px] hover:bg-white/60">
                <span className="truncate">{r.a.name}</span>
                <span className={cn("tnum shrink-0 text-[12.5px]", r.days >= 60 ? "font-semibold text-danger" : "text-[#a06c10]")}>{r.days >= 999 ? "sem interação" : `${r.days} dias`}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {d.next.length > 0 && (
        <Panel className="mt-4">
          <div className="px-4 pt-4 pb-1 text-[14px] font-medium">Próximos compromissos</div>
          <div className="px-2 pb-2">
            {d.next.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-2 py-2 text-[13px]">
                <span className="truncate">{c.agencyName(a.agencyId)} <span className="text-muted-foreground">· {a.type}</span></span>
                <span className="tnum shrink-0 text-[12.5px] text-muted-foreground">{a.date.slice(8, 10)}/{a.date.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Button variant="primary" className="mt-5 hidden h-11 w-full lg:flex" onClick={() => nav("/registro")}><Plus className="size-4" /> Registrar atividade</Button>

      <NextStepDialog done={doneAct} agencyName={doneAct?.agencyId ? c.agencyName(doneAct.agencyId) : undefined} onClose={() => setDoneAct(null)} />
    </div>
  );
}
