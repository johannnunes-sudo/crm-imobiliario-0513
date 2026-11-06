import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, GripVertical } from "lucide-react";
import { OPP_STAGES } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { useUpdateOpportunity, type Opportunity } from "../queries/crm";
import { brl, brlShort, fmtDate, isoDate, MONTHS, pct } from "../lib/format";
import { inRange, isProposal, monthlySeries, monthRange } from "../lib/metrics";
import { Bars, Legend } from "../components/charts";
import { oppStageColor, oppStageTone, tempTone } from "../lib/tones";
import { GlobalFilters } from "../components/filters";
import { BROKER_REQUIRED_OPP_STAGES } from "../../shared/constants";
import { DeclineDialog, OpportunityDialog, SaleDialog } from "../components/forms";
import { Avatar, Badge, Button, Input, KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader, Progress, Segmented, Select, Table, Tabs, useToast } from "../components/ui/kit";
import { cn } from "../lib/utils";

export default function Pipeline() {
  const c = useCrm();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [q, setQ] = useState("");
  const [product, setProduct] = useState<number | "">("");
  const [temp, setTemp] = useState("");
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [selling, setSelling] = useState<Opportunity | null>(null);
  const [declining, setDeclining] = useState<Opportunity | null>(null);
  const [mode, setMode] = useState<"vgv" | "un">("vgv");
  const [tab, setTab] = useState<"negociacoes" | "analise">("negociacoes");
  const update = useUpdateOpportunity();
  const toast = useToast();

  const list = useMemo(
    () =>
      c.scoped.opportunities.filter(
        (o) =>
          (!q || o.client.toLowerCase().includes(q.toLowerCase()) || c.agencyName(o.agencyId).toLowerCase().includes(q.toLowerCase()) || (o.brokerName ?? "").toLowerCase().includes(q.toLowerCase())) &&
          (!product || o.productId === product) &&
          (!temp || o.temperature === temp),
      ),
    [c, q, product, temp],
  );

  const charts = useMemo(() => {
    const isOpen = (o: Opportunity) => o.stage !== "Venda" && o.stage !== "Declinou";
    const sum = (l: Opportunity[]) => l.reduce((s, o) => s + o.value, 0);
    // Status por empreendimento ignora o filtro de empreendimento (para permitir trocar a seleção)
    const base = c.scoped.opportunities.filter(
      (o) =>
        (!q || o.client.toLowerCase().includes(q.toLowerCase()) || c.agencyName(o.agencyId).toLowerCase().includes(q.toLowerCase())) &&
        (!temp || o.temperature === temp),
    );
    const byProduct = c.products
      .map((p) => {
        const os = base.filter((o) => o.productId === p.id);
        return { p, ativo: os.filter(isOpen).length, venda: os.filter((o) => o.stage === "Venda").length, declinou: os.filter((o) => o.stage === "Declinou").length, vgv: sum(os.filter(isOpen)) };
      })
      .filter((r) => r.ativo + r.venda + r.declinou > 0);
    const maxP = Math.max(1, ...byProduct.map((r) => r.ativo + r.venda + r.declinou));
    const evo = monthlySeries(6, () => 0).map((m) => {
      const r = monthRange(m.key);
      const os = list.filter((o) => inRange(o.date, r));
      const row: Record<string, string | number> = { label: MONTHS[m.month] };
      for (const st of OPP_STAGES) {
        const l = os.filter((o) => o.stage === st);
        row[st] = mode === "vgv" ? sum(l) : l.length;
      }
      return row;
    });
    return { byProduct, maxP, evo };
  }, [c, list, q, temp, mode]);

  if (c.isLoading) return <PageSkeleton />;

  const open_ = list.filter((o) => o.stage !== "Venda" && o.stage !== "Declinou");
  const month = isoDate(new Date()).slice(0, 7);
  const soldMonth = list.filter((o) => o.stage === "Venda" && o.date.slice(0, 7) === month);
  const kpis = [
    { label: "Negociações em aberto", value: open_.length, hint: `${open_.filter((o) => o.temperature === "Quente").length} quentes` },
    { label: "VGV em aberto no funil", value: brlShort(open_.reduce((s, o) => s + o.value, 0)) },
    { label: "Aguardando assinatura", value: list.filter((o) => o.stage === "Aguardando assinatura").length, hint: "aprovação e contrato" },
    { label: "Vendas no mês", value: soldMonth.length, hint: brlShort(soldMonth.reduce((s, o) => s + o.value, 0)) },
  ];

  // Análise: conversão e motivos
  const proposals = list.filter(isProposal);
  const sales = list.filter((o) => o.stage === "Venda");
  const declined = list.filter((o) => o.stage === "Declinou");
  const avgDiscount = sales.length ? sales.reduce((s, o) => s + (o.discount ?? 0), 0) / sales.length : 0;
  const reasons = [...declined.reduce((m, o) => m.set(o.declineReason || "Não informado", (m.get(o.declineReason || "Não informado") ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 6);


  const openEdit = (o: Opportunity | null) => {
    setEditing(o);
    setOpen(true);
  };

  const drop = (stage: string) => {
    const o = list.find((x) => x.id === dragId);
    setOver(null);
    setDragId(null);
    if (!o || o.stage === stage) return;
    // Virar venda exige o valor de contrato
    // Proposta/assinatura exigem corretor: abre o cadastro para completar
    if (BROKER_REQUIRED_OPP_STAGES.has(stage) && stage !== "Venda" && !o.brokerName?.trim()) {
      toast("Informe o corretor para mover para " + stage);
      return openEdit({ ...o, stage });
    }
    if (stage === "Venda") return setSelling(o);
    // Declinar exige o motivo de não compra
    if (stage === "Declinou") return setDeclining(o);
    const leavingSale = o.stage === "Venda";
    update.mutate({
      id: o.id,
      stage,
      temperature: stage === "Declinou" ? "Frio" : o.temperature,
      ...(leavingSale ? { value: o.proposalValue ?? o.value, contractValue: null } : {}),
    });
    toast(`${o.client} → ${stage}`);
  };

  return (
    <>
      <PageHeader
        title="Pipeline comercial"
        subtitle="Oportunidades, propostas e vendas · arraste os cards entre as etapas"
        actions={
          <>
            <GlobalFilters showPeriod={false} />
            <Button variant="primary" onClick={() => openEdit(null)}>
              <Plus className="size-4" /> Nova oportunidade
            </Button>
          </>
        }
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "negociacoes", label: "Negociações", count: open_.length },
            { value: "analise", label: "Análise do pipeline" },
          ]}
        />
      </div>

      {tab === "negociacoes" && <KpiStrip items={kpis} />}

      {tab === "analise" && (
      <>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Status por empreendimento"
            subtitle="Clique em um empreendimento para abrir as negociações dele"
            right={
              product ? (
                <button type="button" onClick={() => setProduct("")} className="text-[12.5px] font-medium text-brand-strong hover:underline">
                  Limpar filtro
                </button>
              ) : undefined
            }
          />
          <div className="space-y-1 px-3 pb-3">
            {charts.byProduct.map((r) => {
              const tot = r.ativo + r.venda + r.declinou;
              return (
                <button
                  type="button"
                  key={r.p.id}
                  aria-label={`Filtrar por ${r.p.name}`}
                  aria-pressed={product === r.p.id}
                  onClick={() => { setProduct(r.p.id); setTab("negociacoes"); toast(`Negociações filtradas: ${r.p.name}`); }}
                  className={cn("w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50", product === r.p.id && "bg-brand-soft")}
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="font-medium">{r.p.name}</span>
                    <span className="tnum text-muted-foreground">
                      {tot} · {brlShort(r.vgv)} ativo
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-sm bg-muted" style={{ width: `${Math.max(8, (tot / charts.maxP) * 100)}%` }}>
                    <div style={{ width: `${(r.ativo / tot) * 100}%`, background: "#1F3A2E" }} title={`Ativo: ${r.ativo}`} />
                    <div style={{ width: `${(r.venda / tot) * 100}%`, background: "#5FAE3A" }} title={`Venda: ${r.venda}`} />
                    <div style={{ width: `${(r.declinou / tot) * 100}%`, background: "#C8473F" }} title={`Declinou: ${r.declinou}`} />
                  </div>
                </button>
              );
            })}
            <div className="px-2 pt-2">
              <Legend items={[{ name: "Ativo", color: "#1F3A2E" }, { name: "Venda", color: "#5FAE3A" }, { name: "Declinou", color: "#C8473F" }]} />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Evolução do pipeline"
            subtitle="Negócios criados por mês, pela etapa atual · últimos 6 meses"
            right={<Segmented value={mode} onChange={setMode} options={[{ value: "vgv", label: "VGV" }, { value: "un", label: "Unidades" }]} />}
          />
          <div className="px-3 pb-2">
            <Bars stacked data={charts.evo} series={OPP_STAGES.map((st) => ({ key: st, name: st, color: oppStageColor[st] }))} height={260} format={mode === "vgv" ? brlShort : undefined} />
          </div>
          <div className="px-5 pb-4">
            <Legend items={OPP_STAGES.map((st) => ({ name: st, color: oppStageColor[st] }))} />
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Conversão por etapa" subtitle="Negociações com os filtros atuais" />
          <div className="space-y-4 px-5 pb-5">
            {[
              { l: "Negociação → Proposta", v: list.length ? proposals.length / list.length : 0, d: `${proposals.length} de ${list.length}` },
              { l: "Proposta → Venda", v: proposals.length ? sales.length / proposals.length : 0, d: `${sales.length} de ${proposals.length}` },
              { l: "Declínio sobre propostas", v: proposals.length ? declined.length / proposals.length : 0, d: `${declined.length} de ${proposals.length}`, bad: true },
            ].map((r) => (
              <div key={r.l}>
                <div className="mb-1.5 flex items-baseline justify-between text-[13px]"><span>{r.l}</span><span className="tnum"><b>{pct(r.v)}</b> <span className="text-[12px] text-muted-foreground">{r.d}</span></span></div>
                <Progress value={r.v} tone={r.bad ? "danger" : "brand"} className="h-2" />
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-border pt-3 text-[13px]">
              <span>Desconto médio nas vendas (sobre tabela)</span>
              <b className="tnum">{avgDiscount.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b>
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Motivos de não compra" subtitle="Negociações declinadas" right={<Badge tone="danger">{declined.length}</Badge>} />
          <div className="space-y-3 px-5 pb-5">
            {reasons.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhuma negociação declinada.</p> : reasons.map(([r, n]) => (
              <div key={r}>
                <div className="mb-1 flex justify-between text-[13px]"><span>{r}</span><span className="tnum text-muted-foreground">{n}</span></div>
                <Progress value={n / reasons[0][1]} tone="danger" className="h-2" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      </>
      )}

      {tab === "negociacoes" && (
      <>
      <div className="mt-5 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, imobiliária ou corretor" className="h-8.5 w-64 pl-8" />
        </div>
        <Select className="h-8.5 w-auto" value={product} onChange={(e) => setProduct(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Todos os empreendimentos</option>
          {c.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select className="h-8.5 w-auto" value={temp} onChange={(e) => setTemp(e.target.value)}>
          <option value="">Todas as temperaturas</option>
          <option>Quente</option>
          <option>Morno</option>
          <option>Frio</option>
        </Select>
        <div className="ml-auto">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "kanban", label: <><LayoutGrid className="size-3.5" /> Kanban</> },
              { value: "lista", label: <><List className="size-3.5" /> Lista</> },
            ]}
          />
        </div>
      </div>

      {view === "kanban" ? (
        <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {OPP_STAGES.map((stage) => {
            const items = list.filter((o) => o.stage === stage);
            const total = items.reduce((s, o) => s + o.value, 0);
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
                onDragLeave={() => setOver((s) => (s === stage ? null : s))}
                onDrop={() => drop(stage)}
                className={cn("flex w-[272px] shrink-0 flex-col rounded-lg border border-transparent bg-[#efefea] p-2 transition-colors", over === stage && "border-brand/50 bg-brand-soft")}
              >
                <div className="flex items-center justify-between px-1.5 pt-1 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: oppStageColor[stage] }} />
                    <span className="text-[13px] font-medium">{stage}</span>
                    <span className="tnum text-[12px] text-subtle">{items.length}</span>
                  </div>
                  <span className="tnum text-[12px] text-muted-foreground">{brlShort(total)}</span>
                </div>
                <div className="flex min-h-24 flex-col gap-2">
                  {items.map((o) => {
                    const m = c.manager(o.managerId);
                    return (
                      <button
                        type="button"
                        key={o.id}
                        draggable
                        onDragStart={() => setDragId(o.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => openEdit(o)}
                        className={cn(
                          "block w-full text-left group cursor-pointer rounded-md border border-border bg-card p-3 transition-shadow hover:border-border-strong hover:shadow-[0_2px_8px_-2px_rgba(20,40,30,0.1)]",
                          dragId === o.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-medium">{o.client}</div>
                            <div className="truncate text-[12px] text-muted-foreground">{c.agencyName(o.agencyId)}{o.brokerName ? ` · ${o.brokerName}` : ""}</div>
                          </div>
                          <GripVertical className="size-3.5 shrink-0 text-subtle opacity-0 group-hover:opacity-100" />
                        </div>
                        <div className="mt-2.5 text-[12px] text-muted-foreground">
                          {c.productName(o.productId)}
                          {o.unit && <span className="text-subtle"> · un. {o.unit}</span>}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="tnum font-display text-[14px] font-medium">{brlShort(o.value)}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge tone={tempTone[o.temperature]} dot>{o.temperature}</Badge>
                            {m && <Avatar name={m.name} color={m.color} size={20} />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {items.length === 0 && <div className="rounded-md border border-dashed border-border-strong/70 py-6 text-center text-[12px] text-subtle">Solte aqui</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Panel>
          <Table head={["Cliente", "Imobiliária", "Corretor", "Empreendimento", "Unidade", "Etapa", "Tabela", "Proposta", "Contrato", "Data"]}>
            {list.map((o) => (
              <tr key={o.id} className="cursor-pointer" onClick={() => openEdit(o)}>
                <td className="font-medium">{o.client}</td>
                <td className="text-muted-foreground">{c.agencyName(o.agencyId)}</td>
                <td className="text-muted-foreground">{o.brokerName || "—"}</td>
                <td className="text-muted-foreground">{c.productName(o.productId)}</td>
                <td className="tnum">{o.unit || "—"}</td>
                <td><Badge tone={oppStageTone[o.stage]} dot>{o.stage}</Badge></td>
                <td className="tnum text-muted-foreground">{o.tableValue ? brl(o.tableValue) : "—"}</td>
                <td className="tnum">{brl(o.proposalValue ?? o.value)}</td>
                <td className="tnum font-medium">{o.contractValue ? brl(o.contractValue) : "—"}</td>
                <td className="tnum text-muted-foreground">{fmtDate(o.date)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      </>
      )}
      <p className="mt-3 text-[12px] text-subtle">Vendas só são confirmadas após aprovação comercial e validação financeira. Proposta não bloqueia estoque automaticamente.</p>

      <OpportunityDialog open={open} onClose={() => setOpen(false)} initial={editing} />
      <SaleDialog open={!!selling} onClose={() => setSelling(null)} opps={selling ? [selling] : []} />
      <DeclineDialog opp={declining} onClose={() => setDeclining(null)} />
    </>
  );
}
