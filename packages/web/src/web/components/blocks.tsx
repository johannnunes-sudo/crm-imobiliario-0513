// Blocos de dashboard reutilizados entre páginas
import { Link } from "wouter";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { METRICS, type Metric } from "../../shared/constants";
import { computeMetrics, daysSince, goalFor, health, type Period } from "../lib/metrics";
import { fmtDateShort } from "../lib/format";
import { healthTone } from "../lib/tones";
import type { Activity, Agency, Goal, Manager } from "../queries/crm";
import { Avatar, Badge, Empty, Panel, PanelHeader, Progress } from "./ui/kit";
import { cn } from "../lib/utils";

export function GoalsPanel({ values, goals, managerId, period, title = "Indicadores x metas", subtitle }: { values: Record<Metric, number>; goals: Goal[]; managerId: number | null; period: Period | number; title?: string; subtitle?: string }) {
  const rows = METRICS.map((m) => {
    const target = goalFor(goals, m, managerId, period);
    return { m, v: values[m], target, ratio: target ? values[m] / target : 0 };
  });
  const avg = rows.reduce((s, r) => s + Math.min(1, r.ratio), 0) / rows.length;
  return (
    <Panel>
      <PanelHeader
        title={title}
        subtitle={subtitle ?? `Os oito indicadores comerciais · metas ${managerId ? "individuais" : "da equipe"} proporcionais ao período`}
        right={<Badge tone={avg >= 0.85 ? "brand" : avg >= 0.65 ? "amber" : "danger"}>{Math.round(avg * 100)}% de atingimento médio</Badge>}
      />
      <div className="grid gap-x-8 px-5 pb-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.m} className="border-t border-border py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-foreground">{r.m}</span>
              <span className="tnum text-[12.5px] text-muted-foreground">
                <span className="font-medium text-foreground">{r.v}</span> / {r.target}
                <span className={cn("ml-2 inline-block w-9 text-right font-medium", r.ratio >= 1 ? "text-brand-strong" : r.ratio >= 0.7 ? "text-forest" : "text-amber")}>
                  {Math.round(r.ratio * 100)}%
                </span>
              </span>
            </div>
            <Progress value={r.ratio} tone={r.ratio >= 1 ? "brand" : r.ratio >= 0.7 ? "forest" : "amber"} className="mt-2" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function AttentionPanel({ agencies, lastMap, managers, limit = 6 }: { agencies: Agency[]; lastMap: Map<number, string>; managers: Manager[]; limit?: number }) {
  const list = agencies
    .filter((a) => a.active)
    .map((a) => ({ a, days: daysSince(a, lastMap) }))
    .filter((x) => x.days >= 30)
    .sort((x, y) => y.days - x.days);
  return (
    <Panel>
      <PanelHeader
        title="Precisam de atenção"
        subtitle="Imobiliárias há 30+ dias sem interação concluída"
        right={<Badge tone={list.length ? "amber" : "brand"}>{list.length}</Badge>}
      />
      {list.length === 0 ? (
        <Empty title="Carteira em dia">Todas as imobiliárias tiveram interação nos últimos 30 dias.</Empty>
      ) : (
        <div className="px-2 pb-2">
          {list.slice(0, limit).map(({ a, days }) => {
            const m = managers.find((x) => x.id === a.managerId);
            const h = health(days);
            return (
              <Link key={a.id} to={`/imobiliarias/${a.id}`} className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/70">
                <AlertTriangle className={cn("size-4 shrink-0", h === "critical" ? "text-danger" : "text-amber")} strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{a.name}</div>
                  <div className="text-[12px] text-muted-foreground">{a.stage}</div>
                </div>
                {m && <Avatar name={m.name} color={m.color} size={22} />}
                <Badge tone={healthTone[h]} className="tnum">{days >= 999 ? "Nunca" : `${days} dias`}</Badge>
                <ArrowUpRight className="size-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function ActivityFeed({ activities, agencyName, managers, limit = 8, title = "Atividades recentes" }: { activities: Activity[]; agencyName: (id: number | null) => string; managers: Manager[]; limit?: number; title?: string }) {
  const list = activities.filter((a) => a.status === "Concluída").slice(0, limit);
  return (
    <Panel>
      <PanelHeader title={title} right={<Link to="/agenda" className="text-[12.5px] font-medium text-brand-strong hover:underline">Ver agenda</Link>} />
      {list.length === 0 ? (
        <Empty title="Nenhuma atividade no período" />
      ) : (
        <ol className="relative px-5 pb-4">
          {list.map((a, i) => {
            const m = managers.find((x) => x.id === a.managerId);
            return (
              <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < list.length - 1 && <span className="absolute top-5 left-[5px] h-full w-px bg-border" />}
                <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card bg-brand ring-1 ring-border" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px]">
                    <span className="font-medium">{a.type}</span>
                    <span className="text-muted-foreground"> · {agencyName(a.agencyId)}</span>
                  </div>
                  {a.notes && <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{a.notes}</div>}
                </div>
                <div className="shrink-0 text-right text-[12px] text-subtle">
                  <div className="tnum">{fmtDateShort(a.date)}</div>
                  {m && <div>{m.name.split(" ")[0]}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

export function useMetricsHelpers() {
  return { computeMetrics };
}
