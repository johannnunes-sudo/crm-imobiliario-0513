import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Link } from "wouter";
import { ACTIVITY_TYPES, OPP_STAGES } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { computeMetrics, isProposal, isSale } from "../lib/metrics";
import { brl, brlShort, pct } from "../lib/format";
import { oppStageColor } from "../lib/tones";
import { GlobalFilters } from "../components/filters";
import { Bars, Donut, Legend, PALETTE } from "../components/charts";
import { Avatar, Button, Empty, KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader, Segmented, Table } from "../components/ui/kit";

type View = "imobiliarias" | "gerentes" | "produtos";

export default function Relatorios() {
  const c = useCrm();
  const [view, setView] = useState<View>("imobiliarias");
  const acts = c.period.activities;
  const opps = c.period.opportunities;

  const data = useMemo(() => {
    const done = acts.filter((a) => a.status === "Concluída");
    const byAgency = c.scoped.agencies
      .map((ag) => {
        const o = opps.filter((x) => x.agencyId === ag.id);
        const sales = o.filter(isSale);
        return {
          id: ag.id,
          name: ag.name,
          brokers: ag.brokers,
          interactions: done.filter((a) => a.agencyId === ag.id).length,
          proposals: o.filter(isProposal).length,
          sales: sales.length,
          vgv: sales.reduce((s, x) => s + x.value, 0),
        };
      })
      .sort((a, b) => b.vgv - a.vgv || b.proposals - a.proposals || b.interactions - a.interactions);

    const byManager = c.managers.map((m) => {
      const mv = computeMetrics(
        done.filter((a) => a.managerId === m.id),
        opps.filter((o) => o.managerId === m.id),
      );
      const sales = opps.filter((o) => o.managerId === m.id && isSale(o));
      return { m, interactions: done.filter((a) => a.managerId === m.id).length, proposals: mv.Propostas, sales: mv.Vendas, vgv: sales.reduce((s, o) => s + o.value, 0) };
    });

    const byProduct = c.products.map((p) => {
      const o = opps.filter((x) => x.productId === p.id);
      const sales = o.filter(isSale);
      return {
        p,
        visits: done.filter((a) => a.productId === p.id && a.type === "Visita à obra").reduce((s, a) => s + a.participants, 0),
        proposals: o.filter(isProposal).length,
        sales: sales.length,
        vgv: sales.reduce((s, x) => s + x.value, 0),
        discount: sales.length ? sales.reduce((s, x) => s + x.discount, 0) / sales.length : 0,
      };
    });

    const reasons = new Map<string, number>();
    for (const o of opps) if (o.stage === "Declinou") reasons.set(o.declineReason || "Não informado", (reasons.get(o.declineReason || "Não informado") ?? 0) + 1);
    const reasonList = [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));

    const typeMix = ACTIVITY_TYPES.map((t) => ({ label: t.replace("Atendimento", "Atend.").replace("imobiliária", "imob."), v: done.filter((a) => a.type === t).length }));
    const stageMix = OPP_STAGES.map((s) => ({ name: s, value: opps.filter((o) => o.stage === s).length, color: oppStageColor[s] }));

    const proposals = opps.filter(isProposal).length;
    const sales = opps.filter(isSale);
    return {
      byAgency,
      byManager,
      byProduct,
      reasonList,
      typeMix,
      stageMix,
      kpi: {
        interactions: done.length,
        conv: proposals ? sales.length / proposals : 0,
        vgv: sales.reduce((s, o) => s + o.value, 0),
        ticket: sales.length ? sales.reduce((s, o) => s + o.value, 0) / sales.length : 0,
      },
    };
  }, [c, acts, opps]);

  if (c.isLoading) return <PageSkeleton />;

  const exportCsv = () => {
    const rows: (string | number)[][] =
      view === "imobiliarias"
        ? [["Imobiliária", "Corretores", "Interações", "Propostas", "Vendas", "VGV"], ...data.byAgency.map((r) => [r.name, r.brokers, r.interactions, r.proposals, r.sales, r.vgv])]
        : view === "gerentes"
          ? [["Gerente", "Interações", "Propostas", "Vendas", "VGV"], ...data.byManager.map((r) => [r.m.name, r.interactions, r.proposals, r.sales, r.vgv])]
          : [["Empreendimento", "Visitantes", "Propostas", "Vendas", "VGV", "Desconto médio"], ...data.byProduct.map((r) => [r.p.name, r.visits, r.proposals, r.sales, r.vgv, r.discount])];
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${view}-${c.filters.label.replace(/[^\p{L}\d]+/gu, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalStage = data.stageMix.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Rankings, conversão e motivos de perda" actions={<GlobalFilters />} />

      <KpiStrip
        items={[
          { label: "Interações concluídas", value: data.kpi.interactions },
          { label: "Conversão proposta → venda", value: pct(data.kpi.conv), progress: data.kpi.conv },
          { label: "VGV vendido", value: brlShort(data.kpi.vgv) },
          { label: "Ticket médio", value: brlShort(data.kpi.ticket) },
        ]}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader title="Mix de atividades" subtitle="Concluídas no período, por tipo" />
          <div className="px-3 pb-4">
            <Bars data={data.typeMix} series={[{ key: "v", name: "Atividades", color: "#5FAE3A" }]} height={230} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Oportunidades por etapa" />
          <div className="px-5 pb-5">
            <Donut data={data.stageMix} height={170} center={<><div className="tnum font-display text-2xl font-semibold">{totalStage}</div><div className="text-[11.5px] text-muted-foreground">no período</div></>} />
            <div className="mt-3"><Legend items={data.stageMix} /></div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-5">
        <PanelHeader
          title="Ranking"
          subtitle="Ordenado por VGV vendido"
          right={
            <div className="flex items-center gap-2">
              <Segmented value={view} onChange={setView} options={[{ value: "imobiliarias", label: "Imobiliárias" }, { value: "gerentes", label: "Gerentes" }, { value: "produtos", label: "Empreendimentos" }]} />
              <Button size="sm" onClick={exportCsv}><Download className="size-3.5" /> CSV</Button>
            </div>
          }
        />
        {view === "imobiliarias" && (
          <Table head={["#", "Imobiliária", "Corretores", "Interações", "Propostas", "Vendas", "VGV"]}>
            {data.byAgency.map((r, i) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                <td className="tnum w-10 px-5 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-5 py-2.5 font-medium"><Link to={`/imobiliarias/${r.id}`} className="hover:underline">{r.name}</Link></td>
                <td className="tnum px-5 py-2.5">{r.brokers}</td>
                <td className="tnum px-5 py-2.5">{r.interactions}</td>
                <td className="tnum px-5 py-2.5">{r.proposals}</td>
                <td className="tnum px-5 py-2.5">{r.sales}</td>
                <td className="tnum px-5 py-2.5 font-medium">{brl(r.vgv)}</td>
              </tr>
            ))}
          </Table>
        )}
        {view === "gerentes" && (
          <Table head={["Gerente", "Interações", "Propostas", "Vendas", "VGV"]}>
            {[...data.byManager].sort((a, b) => b.vgv - a.vgv).map((r) => (
              <tr key={r.m.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-5 py-2.5"><span className="flex items-center gap-2 font-medium"><Avatar name={r.m.name} color={r.m.color} />{r.m.name}</span></td>
                <td className="tnum px-5 py-2.5">{r.interactions}</td>
                <td className="tnum px-5 py-2.5">{r.proposals}</td>
                <td className="tnum px-5 py-2.5">{r.sales}</td>
                <td className="tnum px-5 py-2.5 font-medium">{brl(r.vgv)}</td>
              </tr>
            ))}
          </Table>
        )}
        {view === "produtos" && (
          <Table head={["Empreendimento", "Visitantes na obra", "Propostas", "Vendas", "VGV", "Desconto médio"]}>
            {[...data.byProduct].sort((a, b) => b.vgv - a.vgv).map((r) => (
              <tr key={r.p.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-5 py-2.5 font-medium">{r.p.name}</td>
                <td className="tnum px-5 py-2.5">{r.visits}</td>
                <td className="tnum px-5 py-2.5">{r.proposals}</td>
                <td className="tnum px-5 py-2.5">{r.sales}</td>
                <td className="tnum px-5 py-2.5 font-medium">{brl(r.vgv)}</td>
                <td className="tnum px-5 py-2.5">{pct(r.discount / 100, 1)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel className="mt-5">
        <PanelHeader title="Motivos de declínio" subtitle="Oportunidades perdidas no período" />
        {data.reasonList.length === 0 ? (
          <Empty title="Nenhuma oportunidade declinada no período" />
        ) : (
          <div className="space-y-3.5 px-5 pb-5">
            {data.reasonList.map((r) => {
              const max = data.reasonList[0].value;
              return (
                <div key={r.name} className="grid grid-cols-[200px_1fr_40px] items-center gap-4 text-[13px]">
                  <span className="truncate">{r.name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-danger/70" style={{ width: `${(r.value / max) * 100}%` }} /></div>
                  <span className="tnum text-right font-medium">{r.value}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
