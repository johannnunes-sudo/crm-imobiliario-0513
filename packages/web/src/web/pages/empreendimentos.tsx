import { useMemo, useState } from "react";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import { useCrm } from "../hooks/use-crm";
import { useCreateProduct, useUpdateProduct, usePerms, type Product } from "../queries/crm";
import { inRange, isProposal, isSale, monthlySeries } from "../lib/metrics";
import { brlShort, MONTHS, num, pct } from "../lib/format";
import { Bars, Legend } from "../components/charts";
import { Badge, Button, Field, Input, KpiStrip, Modal, PageHeader, PageSkeleton, Panel, PanelHeader, Progress, Select, useToast, type Tone } from "../components/ui/kit";

const STATUS = ["Lançamento", "Em obras", "Pronto"] as const;
const statusTone: Record<string, Tone> = { Lançamento: "brand", "Em obras": "amber", Pronto: "forest" };

export default function Empreendimentos() {
  const perms = usePerms();
  const c = useCrm();
  const [edit, setEdit] = useState<Partial<Product> | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    const from3 = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
    return c.products.map((p) => {
      const opps = c.opportunities.filter((o) => o.productId === p.id);
      const sales = opps.filter(isSale);
      const recent = sales.filter((o) => o.date >= from3).length;
      const speed = recent / 3;
      const stock = Math.max(0, p.totalUnits - p.soldUnits);
      return {
        p,
        stock,
        soldPct: p.totalUnits ? p.soldUnits / p.totalUnits : 0,
        vgvTotal: p.totalUnits * p.avgPrice,
        vgvStock: stock * p.avgPrice,
        vgvSold: sales.reduce((s, o) => s + o.value, 0),
        speed,
        monthsLeft: speed > 0 ? stock / speed : null,
        open: opps.filter((o) => !isSale(o) && o.stage !== "Declinou").length,
        proposals: opps.filter((o) => isProposal(o) && inRange(o.date, c.filters.range)).length,
        visits: c.activities.filter((a) => a.productId === p.id && a.type === "Visita à obra" && a.status === "Concluída").reduce((s, a) => s + a.participants, 0),
      };
    });
  }, [c]);

  const series = useMemo(
    () =>
      monthlySeries(6, () => 0).map((m) => {
        const row: Record<string, string | number> = { label: MONTHS[m.month] };
        for (const p of c.products) row[`p${p.id}`] = c.opportunities.filter((o) => o.productId === p.id && isSale(o) && o.date.startsWith(m.key)).length;
        return row;
      }),
    [c],
  );

  if (c.isLoading) return <PageSkeleton />;

  const total = rows.reduce((s, r) => s + r.p.totalUnits, 0);
  const sold = rows.reduce((s, r) => s + r.p.soldUnits, 0);
  const colors = ["#5FAE3A", "#1F3A2E", "#C98A1B", "#A9D18E", "#6B8F7E"];

  return (
    <>
      <PageHeader
        title="Empreendimentos"
        subtitle="Estoque, VGV e velocidade de vendas por produto"
        actions={
          perms.isAdmin && (
            <Button variant="primary" onClick={() => setEdit({ status: "Em obras", totalUnits: 0, soldUnits: 0, avgPrice: 0, avgArea: 0 })}>
              <Plus className="size-4" /> Novo empreendimento
            </Button>
          )
        }
      />

      <KpiStrip
        items={[
          { label: "Unidades totais", value: num(total), hint: `${c.products.length} empreendimentos` },
          { label: "Vendidas", value: num(sold), hint: pct(total ? sold / total : 0) + " do total", progress: total ? sold / total : 0 },
          { label: "Em estoque", value: num(total - sold) },
          { label: "VGV em estoque", value: brlShort(rows.reduce((s, r) => s + r.vgvStock, 0)) },
        ]}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {rows.map((r, i) => (
          <Panel key={r.p.id} className="rise flex flex-col" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-strong">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <div className="font-display text-[15.5px] font-semibold">{r.p.name}</div>
                  <div className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                    <MapPin className="size-3" /> {r.p.neighborhood || "—"} {r.p.delivery && <>· entrega {r.p.delivery}</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge tone={statusTone[r.p.status] ?? "neutral"}>{r.p.status}</Badge>
                {perms.isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setEdit(r.p)} aria-label="Editar">
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="px-5 pt-5">
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="text-muted-foreground">Vendidas</span>
                <span className="tnum">
                  <b className="font-semibold">{r.p.soldUnits}</b> / {r.p.totalUnits} · {pct(r.soldPct)}
                </span>
              </div>
              <Progress value={r.soldPct} />
            </div>

            <div className="mt-5 grid grid-cols-3 border-t border-border text-[12.5px]">
              {[
                ["Estoque", `${r.stock} un.`],
                ["VGV estoque", brlShort(r.vgvStock)],
                ["Ticket médio", brlShort(r.p.avgPrice)],
                ["Velocidade", `${r.speed.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/mês`],
                ["Giro do estoque", r.monthsLeft == null ? "—" : `${Math.ceil(r.monthsLeft)} meses`],
                ["Negociações abertas", r.open],
              ].map(([k, v], j) => (
                <div key={k as string} className={`px-5 py-3 ${j % 3 ? "border-l border-border" : ""} ${j >= 3 ? "border-t border-border" : ""}`}>
                  <div className="text-muted-foreground">{k}</div>
                  <div className="tnum mt-0.5 text-[14px] font-medium text-foreground">{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Vendas por mês" subtitle="Unidades vendidas por empreendimento · últimos 6 meses" />
          <div className="px-3 pb-4">
            <Bars data={series} series={c.products.map((p, i) => ({ key: `p${p.id}`, name: p.name, color: colors[i % colors.length] }))} height={240} />
            <div className="px-2 pt-2"><Legend items={c.products.map((p, i) => ({ name: p.name, color: colors[i % colors.length] }))} /></div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Funil por produto" subtitle="Período selecionado" />
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.p.id} className="flex items-center justify-between px-5 py-3 text-[13px]">
                <span className="font-medium">{r.p.name}</span>
                <span className="tnum text-muted-foreground">
                  {r.visits} visitantes · {r.proposals} propostas · {brlShort(r.vgvSold)} VGV
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {edit && <ProductDialog value={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ProductDialog({ value, onClose }: { value: Partial<Product>; onClose: () => void }) {
  const [d, setD] = useState(value);
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const toast = useToast();
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setD((x) => ({ ...x, [k]: v }));
  const n = (v: string) => Number(v.replace(",", ".")) || 0;

  const save = async () => {
    if (!d.name?.trim()) return;
    const body = {
      name: d.name.trim(),
      neighborhood: d.neighborhood || null,
      status: d.status ?? "Em obras",
      delivery: d.delivery || null,
      totalUnits: d.totalUnits ?? 0,
      soldUnits: d.soldUnits ?? 0,
      avgPrice: d.avgPrice ?? 0,
      avgArea: d.avgArea ?? 0,
    };
    if (d.id) await update.mutateAsync({ id: d.id, ...body });
    else await create.mutateAsync(body);
    toast(d.id ? "Empreendimento atualizado" : "Empreendimento criado");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={d.id ? "Editar empreendimento" : "Novo empreendimento"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={create.isPending || update.isPending} disabled={!d.name?.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome" className="col-span-2">
          <Input value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Bairro">
          <Input value={d.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={d.status ?? "Em obras"} onChange={(e) => set("status", e.target.value)}>
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Previsão de entrega">
          <Input value={d.delivery ?? ""} placeholder="ex.: Dez/2027" onChange={(e) => set("delivery", e.target.value)} />
        </Field>
        <Field label="Área média (m²)">
          <Input inputMode="decimal" value={d.avgArea ?? 0} onChange={(e) => set("avgArea", n(e.target.value))} />
        </Field>
        <Field label="Unidades totais">
          <Input inputMode="numeric" value={d.totalUnits ?? 0} onChange={(e) => set("totalUnits", Math.round(n(e.target.value)))} />
        </Field>
        <Field label="Unidades vendidas">
          <Input inputMode="numeric" value={d.soldUnits ?? 0} onChange={(e) => set("soldUnits", Math.round(n(e.target.value)))} />
        </Field>
        <Field label="Ticket médio (R$)" className="col-span-2">
          <Input inputMode="decimal" value={d.avgPrice ?? 0} onChange={(e) => set("avgPrice", n(e.target.value))} />
        </Field>
      </div>
    </Modal>
  );
}
