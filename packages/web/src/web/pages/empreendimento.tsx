import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { useCrm } from "../hooks/use-crm";
import { brokerKey, prettyName } from "../lib/brokers";
import { monthlySeries } from "../lib/metrics";
import { brl, brlShort, fmtDate, MONTHS } from "../lib/format";
import { AreaTrend, Bars } from "../components/charts";
import { Badge, Button, Empty, KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader, Progress, Table } from "../components/ui/kit";

/** Histórico de vendas de um empreendimento (colunas da aba 07 Vendas do kickoff) */
export default function Empreendimento() {
  const { id } = useParams<{ id: string }>();
  const c = useCrm();
  const pid = Number(id);
  const p = c.products.find((x) => x.id === pid);

  const d = useMemo(() => {
    const opps = c.scoped.opportunities.filter((o) => o.productId === pid);
    const sales = opps.filter((o) => o.stage === "Venda").sort((a, b) => b.date.localeCompare(a.date));
    const open = opps.filter((o) => o.stage !== "Venda" && o.stage !== "Declinou");
    const val = (o: (typeof sales)[number]) => o.contractValue ?? o.value;
    const vgv = sales.reduce((s, o) => s + val(o), 0);
    const withDisc = sales.filter((o) => o.tableValue);
    const disc = withDisc.length ? withDisc.reduce((s, o) => s + (1 - val(o) / (o.tableValue as number)), 0) / withDisc.length : 0;
    const monthly = monthlySeries(12, (f, t) => sales.filter((o) => o.date >= f && o.date <= t).length);
    let acc = sales.filter((o) => o.date < monthly[0].key + "-01").reduce((s, o) => s + val(o), 0);
    const cumulative = monthlySeries(12, (f, t) => (acc += sales.filter((o) => o.date >= f && o.date <= t).reduce((s, o) => s + val(o), 0)));
    const rank = (keyOf: (o: (typeof sales)[number]) => string | null, label: (k: string, o: (typeof sales)[number]) => string) => {
      const m = new Map<string, { name: string; n: number; vgv: number }>();
      for (const o of sales) {
        const k = keyOf(o);
        if (!k) continue;
        const r = m.get(k) ?? { name: label(k, o), n: 0, vgv: 0 };
        // prefere a grafia com maiúsculas entre as variações do mesmo nome
        if (r.name === r.name.toLowerCase()) r.name = label(k, o);
        r.n++;
        r.vgv += val(o);
        m.set(k, r);
      }
      return [...m.values()].sort((a, b) => b.vgv - a.vgv).slice(0, 6);
    };
    return {
      sales, open, vgv, disc, val,
      monthly: monthly.map((m) => ({ label: MONTHS[m.month], vendas: m.value })),
      cumulative: cumulative.map((m) => ({ label: MONTHS[m.month], vgv: m.value })),
      byAgency: rank((o) => (o.agencyId ? String(o.agencyId) : null), (_k, o) => c.agencyName(o.agencyId)),
      byBroker: rank((o) => (o.brokerName?.trim() ? brokerKey(o.brokerName) : null), (_k, o) => prettyName(o.brokerName!.trim())),
    };
  }, [c, pid]);

  if (c.isLoading) return <PageSkeleton />;
  if (!p) return <Empty title="Empreendimento não encontrado" />;

  const exportCsv = () => {
    const head = ["Empreendimento", "Código unidade", "Data venda", "Valor tabela", "Valor venda", "Desconto %", "Imobiliária", "Corretor", "Gerente", "Cliente", "Status venda"];
    const rows = d.sales.map((o) => [
      p.name, o.unit ?? "", fmtDate(o.date), o.tableValue ?? "", d.val(o),
      o.tableValue ? ((1 - d.val(o) / o.tableValue) * 100).toFixed(1) : "",
      c.agencyName(o.agencyId), o.brokerName ?? "", c.manager(o.managerId)?.name ?? "", o.client, o.stage,
    ]);
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `vendas-${p.name.replace(/[^\p{L}\d]+/gu, "-")}.csv`;
    a.click();
  };

  const maxA = Math.max(1, ...d.byAgency.map((r) => r.vgv));
  const maxB = Math.max(1, ...d.byBroker.map((r) => r.vgv));
  const sold = d.sales.length;

  return (
    <>
      <Link to="/empreendimentos" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Empreendimentos
      </Link>
      <PageHeader
        title={p.name}
        subtitle={`Histórico de vendas · ${p.neighborhood || "—"}${p.delivery ? ` · entrega ${p.delivery}` : ""}`}
        actions={<Button onClick={exportCsv} disabled={!sold}><Download className="size-3.5" /> Exportar CSV</Button>}
      />
      <KpiStrip
        items={[
          { label: "Unidades vendidas no CRM", value: <>{sold}{p.totalUnits ? <span className="text-[14px] font-normal text-muted-foreground"> / {p.totalUnits}</span> : null}</>, hint: p.totalUnits ? `${Math.round((sold / p.totalUnits) * 100)}% do total` : "total de unidades não informado", progress: p.totalUnits ? sold / p.totalUnits : undefined },
          { label: "VGV vendido", value: brlShort(d.vgv) },
          { label: "Ticket médio", value: sold ? brlShort(d.vgv / sold) : "—" },
          { label: "Desconto médio sobre tabela", value: sold ? `${(d.disc * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—", hint: `${d.open.length} negociações em aberto` },
        ]}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Vendas por mês" subtitle="Unidades · últimos 12 meses" />
          <div className="px-3 pb-3"><Bars data={d.monthly} series={[{ key: "vendas", name: "Vendas", color: "#5FAE3A" }]} height={220} /></div>
        </Panel>
        <Panel>
          <PanelHeader title="VGV vendido acumulado" subtitle="Últimos 12 meses" />
          <div className="px-3 pb-3"><AreaTrend data={d.cumulative} series={[{ key: "vgv", name: "VGV acumulado", color: "#1F3A2E" }]} height={220} format={brlShort} /></div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {[{ t: "Imobiliárias que mais venderam", rows: d.byAgency, max: maxA }, { t: "Corretores que mais venderam", rows: d.byBroker, max: maxB }].map((g) => (
          <Panel key={g.t}>
            <PanelHeader title={g.t} subtitle="Por VGV vendido neste empreendimento" />
            <div className="space-y-3 px-5 pb-5">
              {g.rows.length === 0 ? <p className="text-[13px] text-muted-foreground">Sem vendas registradas.</p> : g.rows.map((r) => (
                <div key={r.name}>
                  <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{r.name}</span><span className="tnum text-muted-foreground">{r.n} venda{r.n > 1 ? "s" : ""} · {brlShort(r.vgv)}</span></div>
                  <Progress value={r.vgv / g.max} className="h-2" />
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-5">
        <PanelHeader title="Vendas registradas" subtitle="Mais recentes primeiro" right={<Badge tone="brand">{sold}</Badge>} />
        {sold === 0 ? <Empty title="Nenhuma venda registrada neste empreendimento" /> : (
          <Table head={["Data", "Unidade", "Cliente", "Imobiliária", "Corretor", "Gerente", "Tabela", "Venda", "Desconto"]}>
            {d.sales.map((o) => (
              <tr key={o.id}>
                <td className="tnum whitespace-nowrap text-muted-foreground">{fmtDate(o.date)}</td>
                <td className="tnum font-medium">{o.unit || "—"}</td>
                <td>{o.client}</td>
                <td className="text-muted-foreground">{c.agencyName(o.agencyId)}</td>
                <td className="text-muted-foreground">{o.brokerName || "—"}</td>
                <td className="text-muted-foreground">{c.manager(o.managerId)?.name.split(" ")[0] ?? "—"}</td>
                <td className="tnum text-muted-foreground">{o.tableValue ? brl(o.tableValue) : "—"}</td>
                <td className="tnum font-medium">{brl(d.val(o))}</td>
                <td className="tnum">{o.tableValue ? `${((1 - d.val(o) / o.tableValue) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
