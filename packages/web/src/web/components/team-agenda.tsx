import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { METRICS } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { usePerms, type Activity } from "../queries/crm";
import { computeMetrics, goalFor } from "../lib/metrics";
import { fmtDate, isoDate, MONTHS_FULL, parseISO } from "../lib/format";
import { Avatar, Badge, Button, Empty, KpiStrip, Panel, PanelHeader, Progress, Segmented, Table, type Tone } from "./ui/kit";
import { cn } from "../lib/utils";
import { leadKind } from "../lib/lead";

const VISIT = "Visita à imobiliária";
const pctTxt = (v: number) => `${Math.round(v * 100)}%`;
const toneFor = (r: number): Tone => (r >= 0.85 ? "brand" : r >= 0.6 ? "amber" : "danger");
const toneText: Record<Tone, string> = { brand: "text-brand-strong", amber: "text-[#a06c10]", danger: "text-danger", neutral: "text-muted-foreground", forest: "text-forest" };

/** Dias úteis (seg–sex) do mês do cursor */
function workdaysOf(cursor: Date) {
  const out: string[] = [];
  const d = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  while (d.getMonth() === cursor.getMonth()) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Painel comparativo da agenda: planejado × realizado por gerente, calendário de visitas,
 * mix de atividades vs. meta e atividades vencidas sem check.
 * Para o perfil gerente, os dados já chegam filtrados pelo servidor (vira "Meu desempenho").
 */
export function TeamAgenda({ onOpen }: { onOpen: (a: Activity) => void }) {
  const c = useCrm();
  const perms = usePerms();
  const [cursor, setCursor] = useState(() => new Date());
  const [metric, setMetric] = useState<"visitas" | "todas">("visitas");
  const [cell, setCell] = useState<{ m: number; d: string } | null>(null);
  const todayIso = isoDate(new Date());

  const d = useMemo(() => {
    const month = isoDate(cursor).slice(0, 7);
    const workdays = workdaysOf(cursor);
    const elapsed = workdays.filter((w) => w <= todayIso).length;
    const acts = c.scoped.activities.filter((a) => a.date.slice(0, 7) === month);
    const mgrs = c.managers.filter((m) => m.active && (!c.filters.managerId || m.id === c.filters.managerId));
    const teamVisitGoal = goalFor(c.goals, "Visitas a imobiliárias", null, 1);

    const rows = mgrs.map((m) => {
      const mine = acts.filter((a) => a.managerId === m.id);
      const done = mine.filter((a) => a.status === "Concluída");
      const overdue = mine.filter((a) => a.status === "Planejada" && a.date < todayIso);
      const canceled = mine.filter((a) => a.status === "Cancelada");
      const open = mine.filter((a) => a.status === "Planejada" && a.date >= todayIso);
      const due = done.length + overdue.length + canceled.length;
      const visits = done.filter((a) => a.type === VISIT).length;
      const goal = goalFor(c.goals, "Visitas a imobiliárias", m.id, 1) || Math.round(teamVisitGoal / Math.max(1, mgrs.length));
      const portfolio = c.agencies.filter((a) => a.managerId === m.id && a.active);
      const touched = new Set(done.map((a) => a.agencyId).filter(Boolean));
      const covered = portfolio.filter((a) => touched.has(a.id)).length;
      // ações (sem lembretes, sem canceladas) cadastradas com >= 3 dias úteis de antecedência
      const actions = mine.filter((a) => a.status !== "Cancelada" && leadKind(a) !== "lembrete");
      const plannedAhead = actions.filter((a) => leadKind(a) === "planejada").length;
      const perDay = new Map<string, Activity[]>();
      for (const a of done) (perDay.get(a.date) ?? perDay.set(a.date, []).get(a.date)!).push(a);
      return {
        m, done, overdue, canceled, open, visits, goal, perDay,
        planned: done.length + overdue.length + canceled.length + open.length,
        compliance: due ? done.length / due : 0,
        avgDay: elapsed ? visits / elapsed : 0,
        dailyGoal: goal ? goal / workdays.length : 0,
        portfolio: portfolio.length,
        covered,
        actions: actions.length,
        plannedAhead,
      };
    });

    const done = acts.filter((a) => a.status === "Concluída");
    const overdue = acts.filter((a) => a.status === "Planejada" && a.date < todayIso).sort((a, b) => a.date.localeCompare(b.date));
    const portfolio = rows.reduce((s, r) => s + r.portfolio, 0);
    const covered = rows.reduce((s, r) => s + r.covered, 0);
    const due = rows.reduce((s, r) => s + r.done.length + r.overdue.length + r.canceled.length, 0);
    const goalScope = c.filters.managerId ?? (mgrs.length === 1 && !perms.seesAll ? mgrs[0].id : null);
    const values = computeMetrics(done, []);
    const mix = METRICS.filter((x) => x !== "Propostas" && x !== "Vendas").map((x) => {
      const g = goalFor(c.goals, x, goalScope, 1) || (goalScope ? goalFor(c.goals, x, null, 1) : 0);
      return { x, v: values[x], g };
    });
    return { workdays, elapsed, rows, done, overdue, portfolio, covered, due, mix, acts };
  }, [c, cursor, todayIso, perms.seesAll]);

  /** fração do mês útil já percorrida (1 para meses passados) — usada para julgar o ritmo */
  const pace = d.workdays.length ? d.elapsed / d.workdays.length : 1;
  const paceRatio = (v: number, goal: number) => (goal && pace ? v / (goal * pace) : 0);
  const shift = (n: number) => { setCursor((x) => new Date(x.getFullYear(), x.getMonth() + n, 1)); setCell(null); };
  const visitsTeam = d.rows.reduce((s, r) => s + r.visits, 0);
  const goalTeam = d.rows.reduce((s, r) => s + r.goal, 0);
  const cellActs = cell ? d.rows.find((r) => r.m.id === cell.m)?.perDay.get(cell.d) ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
          <button onClick={() => shift(1)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
          <h3 className="text-[15px] font-medium">{MONTHS_FULL[cursor.getMonth()]} {cursor.getFullYear()}</h3>
          <Button size="sm" variant="ghost" onClick={() => { setCursor(new Date()); setCell(null); }}>Mês atual</Button>
        </div>
        <span className="text-[12.5px] text-muted-foreground">{d.elapsed} de {d.workdays.length} dias úteis · cumprimento = concluídas ÷ (concluídas + vencidas sem check + canceladas)</span>
      </div>

      <KpiStrip
        items={[
          { label: "Na agenda no mês", value: d.acts.length, hint: `${d.done.length} concluídas` },
          { label: "Cumprimento do plano", value: d.due ? pctTxt(d.done.length / d.due) : "—", hint: `${d.overdue.length} vencidas sem check`, progress: d.due ? d.done.length / d.due : 0 },
          { label: "Visitas a imobiliárias", value: <>{visitsTeam} <span className="text-[14px] font-normal text-muted-foreground">/ {goalTeam}</span></>, hint: goalTeam ? `${pctTxt(paceRatio(visitsTeam, goalTeam))} do ritmo esperado até hoje` : "sem meta definida", progress: goalTeam ? visitsTeam / goalTeam : 0 },
          { label: "Carteira com interação", value: d.portfolio ? pctTxt(d.covered / d.portfolio) : "—", hint: `${d.covered} de ${d.portfolio} imobiliárias no mês`, progress: d.portfolio ? d.covered / d.portfolio : 0 },
        ]}
      />

      <Panel>
        <PanelHeader title={perms.seesAll ? "Plano × realizado por gerente" : "Meu plano × realizado"} subtitle="Visitas a imobiliárias concluídas no mês contra a meta · média diária considera os dias úteis já passados" />
        <Table head={["Gerente", "Visitas × meta", "Carteira c/ interação", "Planejado c/ antecedência", "Na agenda", "Concluídas", "Vencidas", "Cumprimento", "Média/dia útil"]}>
          {d.rows.map((r) => {
            const vr = r.goal ? r.visits / r.goal : 0;
            const pr = paceRatio(r.visits, r.goal);
            return (
              <tr key={r.m.id}>
                <td><div className="flex items-center gap-2 whitespace-nowrap"><Avatar name={r.m.name} color={r.m.color} size={24} /><span className="font-medium">{r.m.name}</span></div></td>
                <td className="min-w-[230px]">
                  <div className="flex items-center gap-2"><Progress value={vr} tone={toneFor(pr)} className="h-2" /><span className="tnum w-[64px] text-right text-[12.5px]">{r.visits}/{r.goal || "—"}</span></div>
                  {r.goal > 0 && <div className={cn("mt-0.5 text-[11px]", toneText[toneFor(pr)])}>{pr >= 1 ? "no ritmo da meta" : `${pctTxt(pr)} do ritmo esperado`}</div>}
                </td>
                <td className="tnum"><span className={toneText[toneFor(r.portfolio ? r.covered / r.portfolio : 0)]}>{r.portfolio ? pctTxt(r.covered / r.portfolio) : "—"}</span> <span className="text-[12px] text-muted-foreground">{r.covered}/{r.portfolio}</span></td>
                <td className="tnum">{r.actions ? (<><span className={cn("font-medium", toneText[toneFor(r.plannedAhead / r.actions)])}>{pctTxt(r.plannedAhead / r.actions)}</span> <span className="text-[12px] text-muted-foreground">{r.plannedAhead}/{r.actions}</span></>) : "—"}</td>
                <td className="tnum">{r.planned}</td>
                <td className="tnum font-medium">{r.done.length}</td>
                <td className={cn("tnum", r.overdue.length && "text-danger")}>{r.overdue.length}</td>
                <td className={cn("tnum font-medium", toneText[toneFor(r.compliance)])}>{r.done.length + r.overdue.length + r.canceled.length ? pctTxt(r.compliance) : "—"}</td>
                <td className="tnum">{r.avgDay.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-[12px] text-muted-foreground">/ {r.dailyGoal ? r.dailyGoal.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</span></td>
              </tr>
            );
          })}
        </Table>
        {d.rows.length === 0 && <Empty title="Nenhum gerente ativo" />}
      </Panel>

      <Panel>
        <PanelHeader
          title="Calendário de realizadas"
          subtitle={`Cada quadrado é um dia útil · cor pela meta diária de visitas · clique para ver o que foi feito`}
          right={<Segmented value={metric} onChange={(v) => setMetric(v)} options={[{ value: "visitas", label: "Visitas" }, { value: "todas", label: "Todas as atividades" }]} />}
        />
        <div className="scrollbar-thin overflow-x-auto px-5 pb-4">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `130px repeat(${d.workdays.length}, minmax(26px, 1fr))` }}>
            <div />
            {d.workdays.map((w) => (
              <div key={w} className={cn("text-center text-[10.5px] text-subtle", w === todayIso && "font-semibold text-foreground")}>{parseISO(w).getDate()}</div>
            ))}
            {d.rows.map((r) => (
              <Row key={r.m.id} r={r} workdays={d.workdays} today={todayIso} metric={metric} sel={cell} onPick={(day) => setCell(cell?.m === r.m.id && cell.d === day ? null : { m: r.m.id, d: day })} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
            {metric === "visitas" ? (
              <>
                <Legend cls="bg-[#f3c9c4]" t="abaixo de 40% da meta diária" />
                <Legend cls="bg-[#f6e3b9]" t="40–69%" />
                <Legend cls="bg-[#cfe8c2]" t="70–99%" />
                <Legend cls="bg-[#9fd17f]" t="meta do dia batida" />
              </>
            ) : <Legend cls="bg-[#cfe8c2]" t="intensidade = nº de atividades concluídas" />}
            <Legend cls="bg-[#f2f2ee]" t="dia futuro" />
          </div>
        </div>
        {cell && (
          <div className="border-t border-border bg-muted/40 px-5 py-3">
            <div className="mb-2 text-[12.5px] font-medium">{c.manager(cell.m)?.name} · {fmtDate(cell.d)}</div>
            {cellActs.length === 0 ? <div className="text-[12.5px] text-muted-foreground">Nenhuma atividade concluída neste dia.</div> : (
              <div className="flex flex-wrap gap-2">
                {cellActs.map((a) => (
                  <button key={a.id} onClick={() => onOpen(a)} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-[12.5px] hover:border-border-strong">
                    <span className="font-medium">{a.type}</span> <span className="text-muted-foreground">· {c.agencyName(a.agencyId)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Mix da agenda vs. meta" subtitle="Atividades concluídas no mês · cor pelo ritmo esperado até hoje" />
          <Table head={["Indicador", "Realizado", "Meta", ""]}>
            {d.mix.map((r) => (
              <tr key={r.x}>
                <td>{r.x}</td>
                <td className="tnum font-medium">{r.v}</td>
                <td className="tnum text-muted-foreground">{r.g || "—"}</td>
                <td className="w-[38%]">{r.g ? <Progress value={r.v / r.g} tone={toneFor(paceRatio(r.v, r.g))} className="h-2" /> : null}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel>
          <PanelHeader title="Planejadas e não feitas" subtitle="Vencidas sem check · clique para concluir ou cancelar" right={<Badge tone={d.overdue.length ? "danger" : "brand"}>{d.overdue.length}</Badge>} />
          {d.overdue.length === 0 ? <Empty title="Nada vencido neste mês" /> : (
            <Table head={["Data", "Gerente", "Imobiliária", "Atividade"]}>
              {d.overdue.slice(0, 12).map((a) => (
                <tr key={a.id} className="cursor-pointer" onClick={() => onOpen(a)}>
                  <td className="tnum whitespace-nowrap text-danger">{fmtDate(a.date)}</td>
                  <td>{c.manager(a.managerId)?.name.split(" ")[0] ?? "—"}</td>
                  <td className="text-muted-foreground">{c.agencyName(a.agencyId)}</td>
                  <td>{a.type}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Legend({ cls, t }: { cls: string; t: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("inline-block h-2.5 w-3.5 rounded-[3px]", cls)} />{t}</span>;
}

type RowData = { m: { id: number; name: string; color: string }; perDay: Map<string, Activity[]>; dailyGoal: number };
function Row({ r, workdays, today, metric, sel, onPick }: { r: RowData; workdays: string[]; today: string; metric: "visitas" | "todas"; sel: { m: number; d: string } | null; onPick: (d: string) => void }) {
  const max = Math.max(1, ...workdays.map((w) => r.perDay.get(w)?.length ?? 0));
  return (
    <>
      <div className="flex items-center gap-2 pr-2"><Avatar name={r.m.name} color={r.m.color} size={22} /><span className="truncate text-[12.5px]">{r.m.name.split(" ")[0]}</span></div>
      {workdays.map((w) => {
        const all = r.perDay.get(w) ?? [];
        const n = metric === "visitas" ? all.filter((a) => a.type === VISIT).length : all.length;
        const future = w > today;
        let cls = "bg-[#f2f2ee] text-subtle";
        if (!future) {
          if (metric === "visitas") {
            const ratio = r.dailyGoal ? n / r.dailyGoal : n ? 1 : 0;
            cls = ratio >= 1 ? "bg-[#9fd17f] text-[#1f4a0e]" : ratio >= 0.7 ? "bg-[#cfe8c2] text-[#2f6a18]" : ratio >= 0.4 ? "bg-[#f6e3b9] text-[#7a5410]" : "bg-[#f3c9c4] text-[#8c2f28]";
          } else {
            const t = n / max;
            cls = n === 0 ? "bg-[#f3c9c4] text-[#8c2f28]" : t > 0.66 ? "bg-[#9fd17f] text-[#1f4a0e]" : t > 0.33 ? "bg-[#cfe8c2] text-[#2f6a18]" : "bg-[#e6f2df] text-[#2f6a18]";
          }
        }
        const on = sel?.m === r.m.id && sel.d === w;
        return (
          <button
            key={w}
            disabled={future}
            onClick={() => onPick(w)}
            title={`${fmtDate(w)} · ${n} ${metric === "visitas" ? "visita(s)" : "atividade(s)"}`}
            className={cn("tnum flex h-8 items-center justify-center rounded-[5px] text-[11.5px] font-semibold transition", cls, on && "ring-2 ring-forest ring-offset-1", !future && "hover:brightness-95")}
          >
            {future ? "·" : n}
          </button>
        );
      })}
    </>
  );
}
