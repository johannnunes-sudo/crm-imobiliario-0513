import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, List, Plus, Search, Users2 } from "lucide-react";
import { AGENCY_STAGES, type AgencyStage } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { daysSince, health, isProposal, isSale } from "../lib/metrics";
import { agencyStageColor, healthTone } from "../lib/tones";
import { GlobalFilters } from "../components/filters";
import { AgencyDialog } from "../components/forms";
import { useStageAdvance } from "../components/stage-advance";
import { Avatar, Badge, Button, Input, KpiStrip, PageHeader, PageSkeleton, Panel, Segmented, Select, Table } from "../components/ui/kit";
import { cn } from "../lib/utils";

export default function Carteira() {
  const c = useCrm();
  const [, nav] = useLocation();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [q, setQ] = useState("");
  const [att, setAtt] = useState("Todas");
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const advance = useStageAdvance();

  const rows = useMemo(
    () =>
      c.scoped.agencies
        .map((a) => {
          const opps = c.opportunities.filter((o) => o.agencyId === a.id);
          return {
            a,
            days: daysSince(a, c.lastMap),
            interactions: c.activities.filter((x) => x.agencyId === a.id && x.status === "Concluída").length,
            proposals: opps.filter(isProposal).length,
            sales: opps.filter(isSale).length,
          };
        })
        .filter(
          (r) =>
            (!q || r.a.name.toLowerCase().includes(q.toLowerCase())) &&
            (att === "Todas" || (att === "30+ dias" && r.days >= 30) || (att === "60+ dias" && r.days >= 60)),
        ),
    [c, q, att],
  );

  if (c.isLoading) return <PageSkeleton />;

  const all = c.scoped.agencies.map((a) => daysSince(a, c.lastMap));
  const drop = (stage: AgencyStage) => {
    const r = rows.find((x) => x.a.id === dragId);
    setOver(null);
    setDragId(null);
    if (r) advance.request(r.a, stage);
  };

  return (
    <>
      <PageHeader
        title="Carteira de imobiliárias"
        subtitle="Etapas seguem os indicadores de performance · arraste para avançar e contabilizar"
        actions={
          <>
            <GlobalFilters showPeriod={false} />
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Nova imobiliária
            </Button>
          </>
        }
      />
      <KpiStrip
        items={[
          { label: "Na carteira", value: c.scoped.agencies.length, hint: `${c.scoped.agencies.reduce((s, a) => s + a.brokers, 0)} corretores estimados` },
          { label: "30 a 59 dias sem interação", value: all.filter((d) => d >= 30 && d < 60).length },
          { label: "60+ dias sem interação", value: all.filter((d) => d >= 60).length },
          { label: "Com vendas", value: c.scoped.agencies.filter((a) => c.opportunities.some((o) => o.agencyId === a.id && isSale(o))).length },
        ]}
      />

      <div className="mt-5 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imobiliária" className="h-8.5 w-64 pl-8" />
        </div>
        <Select className="h-8.5 w-auto" value={att} onChange={(e) => setAtt(e.target.value)}>
          <option>Todas</option>
          <option>30+ dias</option>
          <option>60+ dias</option>
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
          {AGENCY_STAGES.map((stage, si) => {
            const items = rows.filter((r) => r.a.stage === stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
                onDragLeave={() => setOver((s) => (s === stage ? null : s))}
                onDrop={() => drop(stage)}
                className={cn("flex w-[248px] shrink-0 flex-col rounded-lg border border-transparent bg-[#efefea] p-2 transition-colors", over === stage && "border-brand/50 bg-brand-soft")}
              >
                <div className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
                  <span className="tnum text-[11px] text-subtle">{si + 1}</span>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: agencyStageColor[stage] }} />
                  <span className="truncate text-[13px] font-medium">{stage}</span>
                  <span className="tnum ml-auto text-[12px] text-subtle">{items.length}</span>
                </div>
                <div className="flex min-h-24 flex-col gap-2">
                  {items.map((r) => {
                    const m = c.manager(r.a.managerId);
                    const h = health(r.days);
                    return (
                      <button
                        type="button"
                        key={r.a.id}
                        draggable
                        onDragStart={() => setDragId(r.a.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => nav(`/imobiliarias/${r.a.id}`)}
                        className={cn(
                          "block w-full text-left cursor-pointer rounded-md border border-border bg-card p-3 transition-shadow hover:border-border-strong hover:shadow-[0_2px_8px_-2px_rgba(20,40,30,0.1)]",
                          dragId === r.a.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-medium">{r.a.name}</div>
                            <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                              <Users2 className="size-3" /> {r.a.brokers} corretores · {r.a.city}
                            </div>
                          </div>
                          {m && <Avatar name={m.name} color={m.color} size={20} />}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="tnum text-[12px] text-muted-foreground">
                            {r.interactions} int. · {r.proposals} prop. · {r.sales} vendas
                          </span>
                          <Badge tone={healthTone[h]} className="tnum">{r.days >= 999 ? "—" : `${r.days}d`}</Badge>
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
          <Table head={["Imobiliária", "Gerente", "Etapa", "Sem interação", "Interações", "Propostas", "Vendas"]}>
            {rows.map((r) => {
              const m = c.manager(r.a.managerId);
              return (
                <tr key={r.a.id}>
                  <td>
                    <Link to={`/imobiliarias/${r.a.id}`} className="font-medium hover:text-brand-strong">{r.a.name}</Link>
                    <div className="text-[12px] text-muted-foreground">{r.a.city}</div>
                  </td>
                  <td>{m && <div className="flex items-center gap-2"><Avatar name={m.name} color={m.color} size={20} /><span className="text-muted-foreground">{m.name}</span></div>}</td>
                  <td><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: agencyStageColor[r.a.stage] }} />{r.a.stage}</span></td>
                  <td><Badge tone={healthTone[health(r.days)]} className="tnum">{r.days >= 999 ? "Nunca" : `${r.days} dias`}</Badge></td>
                  <td className="tnum">{r.interactions}</td>
                  <td className="tnum">{r.proposals}</td>
                  <td className="tnum">{r.sales}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}
      <AgencyDialog open={open} onClose={() => setOpen(false)} />
      {advance.element}
    </>
  );
}
