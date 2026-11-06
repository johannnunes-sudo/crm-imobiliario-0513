import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, CalendarPlus, Mail, MapPin, Pencil, Phone, Plus, BadgeCheck, Users2 } from "lucide-react";
import { ACTIVITY_TYPES, AGENCY_STAGES } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { useUpdateAgency } from "../queries/crm";
import { daysSince, health, inRange, isProposal, isSale, monthlySeries } from "../lib/metrics";
import { brl, brlShort, fmtDate, MONTHS, pct } from "../lib/format";
import { agencyStageColor, healthTone, oppStageTone } from "../lib/tones";
import { GlobalFilters } from "../components/filters";
import { AreaTrend } from "../components/charts";
import { ActivityDialog, AgencyDialog, OpportunityDialog } from "../components/forms";
import { useStageAdvance } from "../components/stage-advance";
import { Avatar, Badge, Button, Empty, KpiStrip, PageSkeleton, Panel, PanelHeader, Progress, Segmented, Select, Table, Tabs } from "../components/ui/kit";

type Tab = "performance" | "historico" | "oportunidades" | "cadastro";

export default function Ficha() {
  const { id } = useParams<{ id: string }>();
  const c = useCrm();
  const [tab, setTab] = useState<Tab>("performance");
  const [metric, setMetric] = useState<"Interações" | "Propostas" | "Vendas">("Interações");
  const [dlg, setDlg] = useState<null | "act" | "plan" | "edit" | "opp">(null);
  const update = useUpdateAgency();
  const advance = useStageAdvance();

  const a = c.agencies.find((x) => x.id === Number(id));

  const d = useMemo(() => {
    if (!a) return null;
    const acts = c.activities.filter((x) => x.agencyId === a.id);
    const opps = c.opportunities.filter((x) => x.agencyId === a.id);
    const pActs = acts.filter((x) => x.status === "Concluída" && inRange(x.date, c.filters.range));
    const pOpps = opps.filter((x) => inRange(x.date, c.filters.range));
    const n = Math.max(1, c.agencies.length);
    const avg = {
      interactions: c.activities.filter((x) => x.status === "Concluída" && inRange(x.date, c.filters.range)).length / n,
      proposals: c.opportunities.filter((x) => isProposal(x) && inRange(x.date, c.filters.range)).length / n,
      sales: c.opportunities.filter((x) => isSale(x) && inRange(x.date, c.filters.range)).length / n,
    };
    const series = monthlySeries(6, (f, t) => {
      const r: [string, string] = [f, t];
      if (metric === "Interações") return acts.filter((x) => x.status === "Concluída" && inRange(x.date, r)).length;
      if (metric === "Propostas") return opps.filter((x) => isProposal(x) && inRange(x.date, r)).length;
      return opps.filter((x) => isSale(x) && inRange(x.date, r)).length;
    }).map((m) => ({ label: MONTHS[m.month], v: m.value }));
    const comp = ACTIVITY_TYPES.map((t) => ({ t, v: pActs.filter((x) => x.type === t).length }));
    return { acts, opps, pActs, pOpps, avg, series, comp, days: daysSince(a, c.lastMap) };
  }, [a, c, metric]);

  if (c.isLoading) return <PageSkeleton />;
  if (!a || !d) return <Empty title="Imobiliária não encontrada"><Link to="/carteira" className="text-brand-strong">Voltar para a carteira</Link></Empty>;

  const m = c.manager(a.managerId);
  const props = d.pOpps.filter(isProposal).length;
  const sales = d.pOpps.filter(isSale).length;
  const compMax = Math.max(1, ...d.comp.map((x) => x.v));
  const h = health(d.days);

  return (
    <>
      <Link to="/carteira" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Carteira
      </Link>

      {/* Cabeçalho da ficha */}
      <Panel className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-5 px-6 pt-5 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand-soft font-display text-[17px] font-semibold text-brand-strong">
              {a.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold leading-tight">{a.name}</h1>
                {!a.active && <Badge>Inativa</Badge>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                {m && <span className="inline-flex items-center gap-1.5"><Avatar name={m.name} color={m.color} size={18} />{m.name}</span>}
                <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{a.city}</span>
                <span className="inline-flex items-center gap-1"><Users2 className="size-3.5" />{a.brokers} corretores</span>
                <Badge tone={healthTone[h]} dot>{d.days >= 999 ? "Sem interações" : `Última interação há ${d.days} dias`}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDlg("edit")}><Pencil className="size-3.5" /> Editar</Button>
            <Button onClick={() => setDlg("plan")}><CalendarPlus className="size-3.5" /> Agendar</Button>
            <Button onClick={() => setDlg("opp")}><Plus className="size-3.5" /> Oportunidade</Button>
            <Button variant="primary" onClick={() => setDlg("act")}><Plus className="size-4" /> Registrar atividade</Button>
          </div>
        </div>
        {/* Etapas do relacionamento */}
        <div className="grid grid-cols-4 border-t border-border lg:grid-cols-8">
          {AGENCY_STAGES.map((s, i) => {
            const idx = AGENCY_STAGES.indexOf(a.stage as (typeof AGENCY_STAGES)[number]);
            const done = i <= idx;
            return (
              <button
                key={s}
                type="button"
                onClick={() => advance.request(a, s)}
                className="group relative border-border px-3 py-3 text-left transition-colors hover:bg-muted/60 [&:not(:last-child)]:border-r"
              >
                <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: done ? agencyStageColor[s] : "transparent" }} />
                <div className="text-[11px] uppercase tracking-[0.05em] text-subtle">Etapa {i + 1}</div>
                <div className={done ? "text-[12.5px] leading-tight font-medium" : "text-[12.5px] leading-tight text-muted-foreground"}>{s}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "performance", label: "Performance" },
            { value: "historico", label: "Histórico", count: d.acts.length },
            { value: "oportunidades", label: "Oportunidades", count: d.opps.length },
            { value: "cadastro", label: "Cadastro" },
          ]}
        />
        {tab === "performance" && <GlobalFilters showManager={false} />}
      </div>

      {tab === "performance" && (
        <div className="space-y-5">
          <KpiStrip
            items={[
              { label: "Interações concluídas", value: d.pActs.length, hint: `Média da carteira: ${d.avg.interactions.toFixed(1)}` },
              { label: "Propostas", value: props, hint: `Média da carteira: ${d.avg.proposals.toFixed(1)}` },
              { label: "Vendas", value: sales, hint: `Média da carteira: ${d.avg.sales.toFixed(1)}` },
              { label: "Conversão", value: props ? pct(sales / props) : "—", hint: "Vendas / propostas" },
            ]}
          />
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <Panel>
              <PanelHeader
                title={`Evolução · ${metric.toLowerCase()}`}
                subtitle="Últimos 6 meses"
                right={<Segmented value={metric} onChange={setMetric} options={[{ value: "Interações", label: "Interações" }, { value: "Propostas", label: "Propostas" }, { value: "Vendas", label: "Vendas" }]} />}
              />
              <div className="px-3 pb-4">
                <AreaTrend data={d.series} series={[{ key: "v", name: metric, color: "#5FAE3A" }]} height={230} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Composição das interações" subtitle="No período selecionado" />
              <div className="space-y-3.5 px-5 pb-5">
                {d.comp.map((x) => (
                  <div key={x.t}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span>{x.t}</span>
                      <span className="tnum font-medium">{x.v}</span>
                    </div>
                    <Progress value={x.v / compMax} tone="forest" />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === "historico" && (
        <Panel>
          {d.acts.length === 0 ? (
            <Empty title="Sem atividades registradas" />
          ) : (
            <Table head={["Data", "Atividade", "Situação", "Empreendimento", "Resultado", "Gerente"]}>
              {d.acts.map((x) => (
                <tr key={x.id}>
                  <td className="tnum whitespace-nowrap text-muted-foreground">{fmtDate(x.date)}</td>
                  <td className="font-medium">{x.type}</td>
                  <td><Badge tone={x.status === "Concluída" ? "brand" : x.status === "Planejada" ? "amber" : "neutral"} dot>{x.status}</Badge></td>
                  <td className="text-muted-foreground">{c.productName(x.productId)}</td>
                  <td className="max-w-[320px] truncate text-muted-foreground">{x.notes}{x.participants > 1 ? ` · ${x.participants} participantes` : ""}</td>
                  <td className="text-muted-foreground">{c.manager(x.managerId)?.name.split(" ")[0]}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "oportunidades" && (
        <Panel>
          {d.opps.length === 0 ? (
            <Empty title="Nenhuma oportunidade vinculada"><Button className="mt-3" onClick={() => setDlg("opp")}>Criar oportunidade</Button></Empty>
          ) : (
            <Table head={["Cliente", "Empreendimento", "Unidade", "Etapa", "Tabela", "Proposta", "Contrato", "Data"]}>
              {d.opps.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="font-medium">{o.client}</div>
                    {o.brokerName && <div className="text-[12px] text-muted-foreground">{o.brokerName}</div>}
                  </td>
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
          )}
          <div className="border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
            VGV vendido: <span className="tnum font-medium text-foreground">{brlShort(d.opps.filter(isSale).reduce((s, o) => s + o.value, 0))}</span>
          </div>
        </Panel>
      )}

      {tab === "cadastro" && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <PanelHeader title="Dados cadastrais" right={<Button size="sm" onClick={() => setDlg("edit")}><Pencil className="size-3" /> Editar</Button>} />
            <dl className="grid grid-cols-1 gap-x-8 px-5 pb-5 sm:grid-cols-2">
              {[
                ["Contato principal", a.contactName],
                ["Gerente responsável", m?.name],
                ["Cidade", a.city],
                ["CRECI", a.creci],
                ["Corretores estimados", a.brokers],
                ["Etapa", a.stage],
              ].map(([k, v]) => (
                <div key={k as string} className="border-t border-border py-3">
                  <dt className="text-[12px] text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 text-[13.5px]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel>
            <PanelHeader title="Contato" />
            <div className="space-y-1 px-2 pb-3">
              {a.phone && <a href={`tel:${a.phone}`} className="flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] hover:bg-muted"><Phone className="size-4 text-subtle" />{a.phone}</a>}
              {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] hover:bg-muted"><Mail className="size-4 text-subtle" />{a.email}</a>}
              {a.creci && <div className="flex items-center gap-3 px-3 py-2 text-[13.5px]"><BadgeCheck className="size-4 text-subtle" />CRECI {a.creci}</div>}
            </div>
            <div className="border-t border-border px-5 py-4">
              <div className="mb-1.5 text-[12px] text-muted-foreground">Observações</div>
              <p className="text-[13px] text-foreground">{a.notes || "Nenhuma observação."}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">Ativa no mapa</span>
                <Select className="h-8 w-28" value={a.active ? "1" : "0"} onChange={(e) => update.mutate({ id: a.id, active: e.target.value === "1" })}>
                  <option value="1">Ativa</option>
                  <option value="0">Inativa</option>
                </Select>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <ActivityDialog open={dlg === "act"} onClose={() => setDlg(null)} preset={{ agencyId: a.id, managerId: a.managerId }} />
      {advance.element}
      <ActivityDialog open={dlg === "plan"} onClose={() => setDlg(null)} preset={{ agencyId: a.id, managerId: a.managerId, status: "Planejada" }} />
      <AgencyDialog open={dlg === "edit"} onClose={() => setDlg(null)} initial={a} />
      <OpportunityDialog open={dlg === "opp"} onClose={() => setDlg(null)} initial={null} preset={{ agencyId: a.id, managerId: a.managerId }} />
      {advance.element}
    </>
  );
}
