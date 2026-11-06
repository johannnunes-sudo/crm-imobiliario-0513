import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AGENCY_STAGES } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { computeMetrics, inRange, isProposal, isSale, monthlySeries } from "../lib/metrics";
import { brlShort, MONTHS } from "../lib/format";
import { agencyStageColor } from "../lib/tones";
import { GlobalFilters } from "../components/filters";
import { AreaTrend } from "../components/charts";
import { AttentionPanel, GoalsPanel } from "../components/blocks";
import { Avatar, KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader } from "../components/ui/kit";
import { cn } from "../lib/utils";

export default function Gestor() {
  const c = useCrm();
  const [local, setLocal] = useState<number | null>(null);
  const mid = local ?? c.filters.managerId ?? c.managers[0]?.id ?? null;

  const d = useMemo(() => {
    if (!mid) return null;
    const ags = c.agencies.filter((a) => a.managerId === mid);
    const acts = c.activities.filter((a) => a.managerId === mid);
    const opps = c.opportunities.filter((o) => o.managerId === mid);
    const pActs = acts.filter((a) => inRange(a.date, c.filters.range));
    const pOpps = opps.filter((o) => inRange(o.date, c.filters.range));
    const values = computeMetrics(pActs, pOpps);
    const series = monthlySeries(6, (f, t) => acts.filter((a) => a.status === "Concluída" && inRange(a.date, [f, t])).length).map((m) => ({
      label: MONTHS[m.month],
      v: m.value,
    }));
    return {
      ags,
      values,
      series,
      interactions: pActs.filter((a) => a.status === "Concluída").length,
      proposals: pOpps.filter(isProposal).length,
      sales: pOpps.filter(isSale).length,
      vgv: pOpps.filter(isSale).reduce((s, o) => s + o.value, 0),
    };
  }, [c, mid]);

  if (c.isLoading || !d) return <PageSkeleton />;
  const maxStage = Math.max(1, ...AGENCY_STAGES.map((s) => d.ags.filter((a) => a.stage === s).length));

  return (
    <>
      <PageHeader title="Gestor comercial" subtitle="Performance individual e atingimento de metas" actions={<GlobalFilters showManager={false} />} />

      <div className="mb-5 flex flex-wrap gap-2">
        {c.managers.map((m) => (
          <button
            key={m.id}
            onClick={() => setLocal(m.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border py-1.5 pr-4 pl-1.5 text-[13.5px] transition-colors",
              m.id === mid ? "border-forest bg-card font-medium shadow-[0_0_0_1px_var(--forest)]" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Avatar name={m.name} color={m.color} size={28} />
            {m.name}
          </button>
        ))}
      </div>

      <KpiStrip
        items={[
          { label: "Imobiliárias na carteira", value: d.ags.length, hint: `${d.ags.reduce((s, a) => s + a.brokers, 0)} corretores` },
          { label: "Interações realizadas", value: d.interactions, hint: "Atividades concluídas no período" },
          { label: "Propostas · vendas", value: `${d.proposals} · ${d.sales}` },
          { label: "VGV vendido", value: brlShort(d.vgv) },
        ]}
      />

      <div className="mt-5">
        <GoalsPanel values={d.values} goals={c.goals} managerId={mid} period={c.filters.period} title="Realizado x metas individuais" subtitle="Metas mensais configuráveis em Configurações" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <PanelHeader title="Evolução de interações" subtitle="Últimos 6 meses" />
          <div className="px-3 pb-4">
            <AreaTrend data={d.series} series={[{ key: "v", name: "Interações", color: "#1F3A2E" }]} height={220} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Carteira por etapa" subtitle="Etapas = indicadores de performance" right={<Link to="/carteira" className="text-[12.5px] font-medium text-brand-strong hover:underline">Abrir kanban</Link>} />
          <div className="space-y-3 px-5 pb-5">
            {AGENCY_STAGES.map((s) => {
              const n = d.ags.filter((a) => a.stage === s).length;
              return (
                <div key={s}>
                  <div className="mb-1.5 flex justify-between text-[13px]"><span>{s}</span><span className="tnum font-medium">{n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(n / maxStage) * 100}%`, background: agencyStageColor[s] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="mt-5">
        <AttentionPanel agencies={d.ags} lastMap={c.lastMap} managers={c.managers} />
      </div>
    </>
  );
}
