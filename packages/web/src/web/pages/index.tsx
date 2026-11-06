import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus } from "lucide-react";
import { METRICS, type Metric } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { computeMetrics, goalFor, inRange, isProposal, isSale, monthlySeries, monthsIn, daysSince } from "../lib/metrics";
import { brlShort, MONTHS, num, pct } from "../lib/format";
import { GlobalFilters } from "../components/filters";
import { Bars, Legend } from "../components/charts";
import { ActivityFeed, AttentionPanel } from "../components/blocks";
import { ActivityDialog } from "../components/forms";
import { Avatar, Button, Empty, KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader, Select, Table } from "../components/ui/kit";
import { cn } from "../lib/utils";

const delta = (a: number, b: number) => (b ? (a - b) / b : null);

/** Rótulos curtos para gráficos */
const SHORT: Record<Metric, string> = {
  Captações: "Captações",
  "Visitas a imobiliárias": "Visitas imob.",
  "Atendimentos a corretores": "Atend. corretores",
  Treinamentos: "Treinamentos",
  "Visitas à obra (pessoas)": "Visitas à obra",
  "Atendimentos a clientes": "Atend. clientes",
  Propostas: "Propostas",
  Vendas: "Vendas",
};

export default function Consolidado() {
  const c = useCrm();
  const [metricA, setA] = useState<Metric>("Propostas");
  const [metricB, setB] = useState<Metric>("Vendas");
  const [reg, setReg] = useState(false);

  const data = useMemo(() => {
    const opps = c.period.opportunities;
    const sales = opps.filter(isSale);
    const prevSales = c.prev.opportunities.filter(isSale);
    const vgv = sales.reduce((s, o) => s + o.value, 0);
    const prevVgv = prevSales.reduce((s, o) => s + o.value, 0);
    const props = opps.filter(isProposal).length;
    const values = computeMetrics(c.period.activities, opps);
    const active = c.scoped.agencies.filter((a) => daysSince(a, c.lastMap) < 30).length;

    const series = monthlySeries(6, () => 0).map((m) => {
      const r: [string, string] = [`${m.key}-01`, `${m.key}-31`];
      const v = computeMetrics(
        c.scoped.activities.filter((a) => inRange(a.date, r)),
        c.scoped.opportunities.filter((o) => inRange(o.date, r)),
      );
      return { label: MONTHS[m.month], a: v[metricA], b: v[metricB] };
    });

    const funnel = [
      { name: "Negociações", v: opps.length },
      { name: "Propostas", v: props },
      { name: "Aguardando assinatura", v: opps.filter((o) => o.stage === "Aguardando assinatura" || o.stage === "Venda").length },
      { name: "Vendas", v: sales.length },
    ];

    const byManager = c.managers.map((m) => {
      const acts = c.period.activities.filter((a) => a.managerId === m.id && a.status === "Concluída");
      const os = opps.filter((o) => o.managerId === m.id);
      return {
        m,
        interactions: acts.length,
        proposals: os.filter(isProposal).length,
        sales: os.filter(isSale).length,
        vgv: os.filter(isSale).reduce((s, o) => s + o.value, 0),
      };
    });

    const goalsFunnel = METRICS.map((m) => {
      const goal = goalFor(c.goals, m, c.filters.managerId, c.filters.period);
      return { m, v: values[m], goal, ratio: goal ? values[m] / goal : 0 };
    });
    const maxGoal = Math.max(1, ...goalsFunnel.map((f) => Math.max(f.v, f.goal)));

    const mgrs = c.filters.managerId ? c.managers.filter((m) => m.id === c.filters.managerId) : c.managers;
    const byMgrMetric = METRICS.map((metric) => {
      const row: Record<string, string | number> = { label: SHORT[metric] };
      for (const m of mgrs) {
        const v = computeMetrics(
          c.period.activities.filter((a) => a.managerId === m.id),
          opps.filter((o) => o.managerId === m.id),
        );
        row[`m${m.id}`] = v[metric];
      }
      return row;
    });

    const byProduct = c.products
      .map((p) => {
        const os = opps.filter((o) => o.productId === p.id);
        const s = os.filter(isSale);
        return { p, proposals: os.filter(isProposal).length, sales: s.length, vgv: s.reduce((t, o) => t + o.value, 0) };
      })
      .sort((a, b) => b.vgv - a.vgv || b.proposals - a.proposals);

    const agMap = new Map<number, { proposals: number; sales: number; vgv: number }>();
    for (const o of opps) {
      if (!o.agencyId) continue;
      const r = agMap.get(o.agencyId) ?? { proposals: 0, sales: 0, vgv: 0 };
      if (isProposal(o)) r.proposals++;
      if (isSale(o)) {
        r.sales++;
        r.vgv += o.value;
      }
      agMap.set(o.agencyId, r);
    }
    const ranking = [...agMap.entries()]
      .map(([id, r]) => ({ id, name: c.agencyName(id), ...r }))
      .filter((r) => r.proposals || r.sales)
      .sort((a, b) => b.sales - a.sales || b.proposals - a.proposals || b.vgv - a.vgv)
      .slice(0, 8);

    return { vgv, prevVgv, sales, prevSales, props, values, active, series, funnel, byManager, goalsFunnel, maxGoal, mgrs, byMgrMetric, byProduct, ranking };
  }, [c, metricA, metricB]);

  if (c.isLoading) return <PageSkeleton />;

  const conv = data.props ? data.sales.length / data.props : 0;
  const maxFunnel = Math.max(1, data.funnel[0].v);

  return (
    <>
      <PageHeader
        title="Consolidado"
        subtitle={`Visão geral da operação comercial · ${c.filters.period.toLowerCase()}`}
        actions={
          <>
            <GlobalFilters />
            <Button variant="primary" onClick={() => setReg(true)}>
              <Plus className="size-4" /> Registrar
            </Button>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: "VGV vendido", value: brlShort(data.vgv), delta: delta(data.vgv, data.prevVgv), hint: "vs. período anterior" },
          { label: "Vendas aprovadas", value: data.sales.length, delta: delta(data.sales.length, data.prevSales.length), hint: `Ticket médio ${brlShort(data.sales.length ? data.vgv / data.sales.length : 0)}` },
          { label: "Conversão proposta → venda", value: pct(conv, 1), hint: `${data.props} propostas no período` },
          { label: "Imobiliárias ativas", value: `${data.active}/${c.scoped.agencies.length}`, hint: "Com interação nos últimos 30 dias", progress: data.active / Math.max(1, c.scoped.agencies.length) },
        ]}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel>
          <PanelHeader
            title="Evolução mensal"
            subtitle="Últimos 6 meses · compare dois indicadores"
            right={
              <div className="flex gap-2">
                <Select className="h-7.5 w-auto text-[12.5px]" value={metricA} onChange={(e) => setA(e.target.value as Metric)}>
                  {METRICS.map((m) => <option key={m}>{m}</option>)}
                </Select>
                <Select className="h-7.5 w-auto text-[12.5px]" value={metricB} onChange={(e) => setB(e.target.value as Metric)}>
                  {METRICS.map((m) => <option key={m}>{m}</option>)}
                </Select>
              </div>
            }
          />
          <div className="px-3 pb-2">
            <Bars data={data.series} series={[{ key: "a", name: metricA, color: "#5FAE3A" }, { key: "b", name: metricB, color: "#1F3A2E" }]} height={250} />
          </div>
          <div className="px-5 pb-4">
            <Legend items={[{ name: metricA, color: "#5FAE3A" }, { name: metricB, color: "#1F3A2E" }]} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Funil comercial" subtitle="Da negociação ao fechamento" />
          <div className="space-y-4 px-5 pt-1 pb-5">
            {data.funnel.map((f, i) => (
              <div key={f.name}>
                <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                  <span>{f.name}</span>
                  <span className="tnum font-medium">
                    {f.v}
                    {i > 0 && data.funnel[i - 1].v > 0 && (
                      <span className="ml-2 text-[12px] font-normal text-subtle">{pct(f.v / data.funnel[i - 1].v)}</span>
                    )}
                  </span>
                </div>
                <div className="h-7 overflow-hidden rounded-[5px] bg-muted">
                  <div
                    className="h-full rounded-[5px] transition-[width] duration-700"
                    style={{ width: `${(f.v / maxFunnel) * 100}%`, background: ["#D9E9CD", "#A9D18E", "#5FAE3A", "#1F3A2E"][i] }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3 text-[12.5px] text-muted-foreground">
              <span>Conversão geral</span>
              <span className="tnum font-medium text-foreground">{pct(data.sales.length / maxFunnel, 1)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Funil consolidado · Meta × Realizado"
            subtitle={`Metas ${c.filters.managerId ? "individuais" : "da equipe"} proporcionais ao período (${monthsIn(c.filters.period)} ${monthsIn(c.filters.period) > 1 ? "meses" : "mês"})`}
          />
          <div className="space-y-3.5 px-5 pb-5">
            {data.goalsFunnel.map((f) => (
              <div key={f.m}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span>{f.m}</span>
                  <span className="tnum text-muted-foreground">
                    <span className="font-medium text-foreground">{num(f.v)}</span> / {num(f.goal)}
                    <span className={cn("ml-2 inline-block w-10 text-right font-medium", f.ratio >= 1 ? "text-brand-strong" : f.ratio >= 0.7 ? "text-forest" : "text-amber")}>{Math.round(f.ratio * 100)}%</span>
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="h-2 overflow-hidden rounded-sm bg-muted">
                    <div className="h-full rounded-sm bg-[#D3DDD6] transition-[width] duration-700" style={{ width: `${(f.goal / data.maxGoal) * 100}%` }} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-muted">
                    <div className="h-full rounded-sm bg-brand transition-[width] duration-700" style={{ width: `${(f.v / data.maxGoal) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <Legend items={[{ name: "Meta", color: "#D3DDD6" }, { name: "Realizado", color: "#5FAE3A" }]} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Desempenho por gestor" subtitle="Volumes realizados por indicador no período" right={<Link to="/gestor" className="text-[12.5px] font-medium text-brand-strong hover:underline">Detalhar</Link>} />
          <div className="px-2 pb-2">
            <Bars layout="vertical" data={data.byMgrMetric} series={data.mgrs.map((m) => ({ key: `m${m.id}`, name: m.name, color: m.color }))} height={440} />
          </div>
          <div className="px-5 pb-4">
            <Legend items={data.mgrs.map((m) => ({ name: m.name, color: m.color }))} />
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Resultados por empreendimento" subtitle="Propostas, vendas e VGV vendido no período" right={<Link to="/empreendimentos" className="text-[12.5px] font-medium text-brand-strong hover:underline">Ver todos</Link>} />
          <Table head={["Empreendimento", "Propostas", "Vendas", "VGV vendido"]}>
            {data.byProduct.map((r) => (
              <tr key={r.p.id}>
                <td>
                  <Link to="/empreendimentos" className="font-medium hover:text-brand-strong hover:underline">
                    {r.p.name}
                  </Link>
                </td>
                <td className="tnum">{r.proposals}</td>
                <td className="tnum">{r.sales}</td>
                <td className="tnum font-medium">{brlShort(r.vgv)}</td>
              </tr>
            ))}
            <tr className="bg-muted/40">
              <td className="font-medium">Total</td>
              <td className="tnum font-medium">{data.byProduct.reduce((s, r) => s + r.proposals, 0)}</td>
              <td className="tnum font-medium">{data.byProduct.reduce((s, r) => s + r.sales, 0)}</td>
              <td className="tnum font-medium">{brlShort(data.byProduct.reduce((s, r) => s + r.vgv, 0))}</td>
            </tr>
          </Table>
        </Panel>

        <Panel>
          <PanelHeader title="Ranking de imobiliárias" subtitle="Por vendas e propostas no período" right={<Link to="/carteira" className="text-[12.5px] font-medium text-brand-strong hover:underline">Carteira</Link>} />
          {data.ranking.length === 0 ? (
            <Empty title="Sem propostas no período">Nenhuma imobiliária gerou propostas ou vendas no recorte selecionado.</Empty>
          ) : (
            <Table head={["#", "Imobiliária", "Propostas", "Vendas", "VGV"]}>
              {data.ranking.map((r, i) => (
                <tr key={r.id}>
                  <td className="tnum w-8 text-subtle">{i + 1}</td>
                  <td>
                    <Link to={`/imobiliarias/${r.id}`} className="font-medium hover:text-brand-strong hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="tnum">{r.proposals}</td>
                  <td className="tnum">{r.sales}</td>
                  <td className="tnum">{brlShort(r.vgv)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Comparativo entre gerentes" subtitle="Somente realizados no período" right={<Link to="/gestor" className="text-[12.5px] font-medium text-brand-strong hover:underline">Detalhar</Link>} />
          <Table head={["Gerente", "Interações", "Propostas", "Vendas", "VGV"]}>
            {data.byManager.map((r) => (
              <tr key={r.m.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.m.name} color={r.m.color} size={24} />
                    <span className="font-medium">{r.m.name}</span>
                  </div>
                </td>
                <td className="tnum">{num(r.interactions)}</td>
                <td className="tnum">{r.proposals}</td>
                <td className="tnum">{r.sales}</td>
                <td className="tnum">{brlShort(r.vgv)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <AttentionPanel agencies={c.scoped.agencies} lastMap={c.lastMap} managers={c.managers} limit={5} />
      </div>

      <div className="mt-5">
        <ActivityFeed activities={c.scoped.activities} agencyName={c.agencyName} managers={c.managers} limit={6} />
      </div>

      <ActivityDialog open={reg} onClose={() => setReg(false)} />
    </>
  );
}
