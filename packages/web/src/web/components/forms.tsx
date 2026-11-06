import { useEffect, useState } from "react";
import { BrokerInput } from "./broker-input";
import { ACTIVITY_TYPES, AGENCY_FOCUS, AGENCY_STAGES, BROKER_REQUIRED_ACTIVITY, BROKER_REQUIRED_OPP_STAGES, CHANNELS, DECLINE_REASONS, FOCUS_CITIES, OPP_STAGES, PRODUCT_STANDARDS, TEMPERATURES } from "../../shared/constants";
import {
  useCreateActivity, useCreateAgency, useCreateOpportunity, useUpdateAgency, useUpdateOpportunity, useRemoveOpportunity,
  type Agency, type Opportunity, useCrmData,
} from "../queries/crm";
import { brl, isoDate, pct } from "../lib/format";
import { Button, Field, Input, Modal, Select, Textarea, useToast } from "./ui/kit";

/* ---------- Oportunidade ---------- */

type OppDraft = Omit<Opportunity, "id" | "createdAt">;
const emptyOpp = (): OppDraft => ({
  client: "",
  agencyId: null,
  brokerName: "",
  productId: null,
  managerId: null,
  unit: "",
  stage: "Em negociação",
  temperature: "Morno",
  value: 0,
  tableValue: null,
  proposalValue: null,
  contractValue: null,
  discount: 0,
  declineReason: "",
  declineNote: "",
  date: isoDate(new Date()),
});

/** Valor efetivo (VGV) e desconto sobre a tabela, derivados dos três valores */
export function oppValues(f: Pick<OppDraft, "stage" | "tableValue" | "proposalValue" | "contractValue" | "value">) {
  const value = f.stage === "Venda" && f.contractValue ? f.contractValue : (f.proposalValue ?? f.tableValue ?? f.value ?? 0);
  const discount = f.tableValue && value ? Math.max(0, Math.round((1 - value / f.tableValue) * 1000) / 10) : 0;
  return { value, discount };
}

const money = (v: number | null | undefined) => (v ? String(v) : "");
const toMoney = (s: string) => (s === "" ? null : Number(s));

export function OpportunityDialog({ open, onClose, initial, preset, onSaved }: { open: boolean; onClose: () => void; initial?: Opportunity | null; preset?: Partial<OppDraft>; onSaved?: (o: OppDraft) => void }) {
  const { agencies, products, managers } = useCrmData();
  const [f, setF] = useState<OppDraft>(emptyOpp());
  const create = useCreateOpportunity();
  const update = useUpdateOpportunity();
  const remove = useRemoveOpportunity();
  const toast = useToast();
  useEffect(() => {
    if (open) setF(initial ? { ...initial } : { ...emptyOpp(), ...preset });
  }, [open, initial]); // eslint-disable-line
  const set = <K extends keyof OppDraft>(k: K, v: OppDraft[K]) => setF((x) => ({ ...x, [k]: v }));

  const isSaleStage = f.stage === "Venda";
  const { value, discount } = oppValues(f);
  const missing = [
    !f.client.trim() && "cliente",
    !f.unit?.trim() && "unidade",
    !f.tableValue && "valor de tabela",
    !f.proposalValue && "valor da proposta",
    isSaleStage && !f.contractValue && "valor de contrato",
    BROKER_REQUIRED_OPP_STAGES.has(f.stage) && !f.brokerName?.trim() && "corretor",
    f.stage === "Declinou" && !f.declineReason && "motivo de não compra",
    f.stage === "Declinou" && f.declineReason === "Outro" && !f.declineNote?.trim() && "descrição do motivo",
  ].filter(Boolean) as string[];
  const save = async () => {
    if (missing.length) return;
    const agency = agencies.find((a) => a.id === f.agencyId);
    const payload = { ...f, value, discount, contractValue: isSaleStage ? f.contractValue : f.contractValue ?? null, managerId: f.managerId ?? agency?.managerId ?? null };
    if (initial) await update.mutateAsync({ id: initial.id, ...payload });
    else await create.mutateAsync(payload);
    toast(initial ? "Oportunidade atualizada" : isSaleStage ? "Venda registrada" : "Oportunidade criada");
    onSaved?.(payload);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar oportunidade" : "Nova oportunidade"}
      subtitle="Negociação vinculada a uma imobiliária parceira e a um empreendimento"
      width={620}
      footer={
        <>
          {initial && (
            <Button
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync({ id: initial.id });
                toast("Oportunidade removida");
                onClose();
              }}
            >
              Excluir
            </Button>
          )}
          {missing.length > 0 && <span className="mr-auto self-center text-[12px] text-subtle">Falta: {missing.join(", ")}</span>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={create.isPending || update.isPending} disabled={missing.length > 0}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cliente" className="col-span-2">
          <Input value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="Nome do cliente" />
        </Field>
        <Field label="Imobiliária">
          <Select value={f.agencyId ?? ""} onChange={(e) => set("agencyId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Venda direta</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={BROKER_REQUIRED_OPP_STAGES.has(f.stage) ? "Corretor *" : "Corretor"} hint={BROKER_REQUIRED_OPP_STAGES.has(f.stage) ? "Obrigatório em proposta e venda" : undefined}>
          <BrokerInput value={f.brokerName ?? ""} onChange={(v) => set("brokerName", v)} agencyId={f.agencyId} className={BROKER_REQUIRED_OPP_STAGES.has(f.stage) && !f.brokerName?.trim() ? "border-danger/60" : undefined} />
        </Field>
        <Field label="Empreendimento">
          <Select value={f.productId ?? ""} onChange={(e) => set("productId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Selecione</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Unidade *">
          <Input value={f.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="Ex.: 1204" />
        </Field>
        <Field label="Etapa">
          <Select
            value={f.stage}
            onChange={(e) => {
              const st = e.target.value;
              setF((x) => ({ ...x, stage: st, contractValue: st === "Venda" ? (x.contractValue ?? x.proposalValue) : x.contractValue }));
            }}
          >
            {OPP_STAGES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Temperatura">
          <Select value={f.temperature} onChange={(e) => set("temperature", e.target.value)}>
            {TEMPERATURES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <div className="col-span-2 grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/30 p-3.5 sm:grid-cols-3">
          <Field label="Valor de tabela (R$) *">
            <Input type="number" min={0} value={money(f.tableValue)} onChange={(e) => set("tableValue", toMoney(e.target.value))} placeholder="0" />
          </Field>
          <Field label="Valor da proposta (R$) *" hint={f.tableValue && f.proposalValue ? `Desconto ${pct(Math.max(0, 1 - f.proposalValue / f.tableValue), 1)} s/ tabela` : undefined}>
            <Input type="number" min={0} value={money(f.proposalValue)} onChange={(e) => set("proposalValue", toMoney(e.target.value))} placeholder="0" />
          </Field>
          <Field label={isSaleStage ? "Valor de contrato (R$) *" : "Valor de contrato (R$)"} hint={isSaleStage ? `Desconto final ${pct(discount / 100, 1)}` : "Preenchido quando virar venda"}>
            <Input
              type="number"
              min={0}
              disabled={!isSaleStage}
              value={money(f.contractValue)}
              onChange={(e) => set("contractValue", toMoney(e.target.value))}
              placeholder={isSaleStage ? "0" : "—"}
            />
          </Field>
        </div>
        <Field label="Gerente">
          <Select value={f.managerId ?? ""} onChange={(e) => set("managerId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Gerente da imobiliária</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        {f.stage === "Declinou" && (
          <DeclineFields reason={f.declineReason ?? ""} note={f.declineNote ?? ""} onReason={(v) => set("declineReason", v)} onNote={(v) => set("declineNote", v)} />
        )}
      </div>
    </Modal>
  );
}

/* ---------- Declinar (motivo obrigatório) ---------- */

export function DeclineFields({ reason, note, onReason, onNote }: { reason: string; note: string; onReason: (v: string) => void; onNote: (v: string) => void }) {
  return (
    <>
      <Field label="Motivo de não compra *" className="col-span-2">
        <Select value={reason} onChange={(e) => onReason(e.target.value)} className={!reason ? "border-danger/60" : undefined}>
          <option value="">Selecione o motivo</option>
          {DECLINE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </Field>
      {reason && (
        <Field label={reason === "Outro" ? "Descreva o motivo *" : "Detalhe (opcional)"} className="col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ex.: cliente preferiu unidade com vista mar em outro empreendimento" />
        </Field>
      )}
    </>
  );
}

/** Aberto ao arrastar um card para "Declinou": só conclui com o motivo selecionado */
export function DeclineDialog({ opp, onClose }: { opp: Opportunity | null; onClose: () => void }) {
  const update = useUpdateOpportunity();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (opp) { setReason(""); setNote(""); }
  }, [opp]);
  const ok = !!reason && (reason !== "Outro" || !!note.trim());
  const confirm = async () => {
    if (!opp || !ok) return;
    const leavingSale = opp.stage === "Venda";
    await update.mutateAsync({
      id: opp.id,
      stage: "Declinou",
      temperature: "Frio",
      declineReason: reason,
      declineNote: note.trim() || null,
      ...(leavingSale ? { value: opp.proposalValue ?? opp.value, contractValue: null } : {}),
    });
    toast(`${opp.client} → Declinou · ${reason}`);
    onClose();
  };
  return (
    <Modal
      open={!!opp}
      onClose={onClose}
      title="Declinar negociação"
      subtitle={opp ? `${opp.client}${opp.unit ? ` · un. ${opp.unit}` : ""} · o motivo é obrigatório e alimenta o relatório de motivos de não compra` : undefined}
      width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" onClick={confirm} loading={update.isPending} disabled={!ok}>Declinar</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <DeclineFields reason={reason} note={note} onReason={setReason} onNote={setNote} />
      </div>
    </Modal>
  );
}

/* ---------- Converter em venda ---------- */

/** Pede o valor de contrato ao transformar uma (ou uma entre várias) oportunidade em venda */
export function SaleDialog({ open, onClose, opps, onDone, onNew, agencyName }: { open: boolean; onClose: () => void; opps: Opportunity[]; onDone?: (o: Opportunity) => void; onNew?: () => void; agencyName?: string }) {
  const { products } = useCrmData();
  const [sel, setSel] = useState<number | null>(null);
  const [contract, setContract] = useState<number | null>(null);
  const [broker, setBroker] = useState("");
  const update = useUpdateOpportunity();
  const toast = useToast();
  const o = opps.find((x) => x.id === sel) ?? null;
  useEffect(() => {
    if (!open) return;
    const first = opps[0] ?? null;
    setSel(first?.id ?? null);
    setContract(first ? (first.contractValue ?? first.proposalValue ?? first.value) : null);
    setBroker(first?.brokerName ?? "");
  }, [open]); // eslint-disable-line
  const pick = (id: number) => {
    const x = opps.find((y) => y.id === id);
    setSel(id);
    setContract(x ? (x.contractValue ?? x.proposalValue ?? x.value) : null);
    setBroker(x?.brokerName ?? "");
  };
  const table = o?.tableValue ?? null;
  const confirm = async () => {
    if (!o || !contract || !broker.trim()) return;
    const discount = table ? Math.max(0, Math.round((1 - contract / table) * 1000) / 10) : o.discount;
    await update.mutateAsync({ id: o.id, stage: "Venda", temperature: "Quente", contractValue: contract, value: contract, discount, brokerName: broker.trim() });
    toast(`Venda registrada · ${o.client}`);
    onDone?.({ ...o, stage: "Venda", contractValue: contract, value: contract, discount });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar venda"
      subtitle={agencyName ? `${agencyName} · informe o valor de contrato para contabilizar a venda` : "Informe o valor de contrato para contabilizar a venda"}
      width={520}
      footer={
        <>
          {onNew && (
            <Button variant="ghost" className="mr-auto" onClick={onNew}>
              Cadastrar outra venda
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={confirm} loading={update.isPending} disabled={!o || !contract || !broker.trim()}>
            Confirmar venda
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {opps.length > 1 && (
          <Field label="Qual negociação virou venda?">
            <Select value={sel ?? ""} onChange={(e) => pick(Number(e.target.value))}>
              {opps.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.client} · un. {x.unit || "—"} · {brl(x.proposalValue ?? x.value)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {o && (
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3.5 text-[12.5px]">
            <div>
              <div className="text-subtle">Unidade</div>
              <div className="mt-0.5 font-medium">{o.unit || "—"}</div>
              <div className="truncate text-subtle">{products.find((p) => p.id === o.productId)?.name}</div>
            </div>
            <div>
              <div className="text-subtle">Valor de tabela</div>
              <div className="tnum mt-0.5 font-medium">{table ? brl(table) : "—"}</div>
            </div>
            <div>
              <div className="text-subtle">Valor da proposta</div>
              <div className="tnum mt-0.5 font-medium">{brl(o.proposalValue ?? o.value)}</div>
            </div>
          </div>
        )}
        <Field label="Corretor *" hint="Obrigatório para registrar a venda">
          <BrokerInput value={broker} onChange={setBroker} agencyId={o?.agencyId} className={!broker.trim() ? "border-danger/60" : undefined} />
        </Field>
        <Field label="Valor de contrato (R$) *" hint={table && contract ? `Desconto final ${pct(Math.max(0, 1 - contract / table), 1)} sobre a tabela` : undefined}>
          <Input type="number" min={0} value={money(contract)} onChange={(e) => setContract(toMoney(e.target.value))} placeholder="0" />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------- Imobiliária ---------- */

type AgencyDraft = Omit<Agency, "id" | "createdAt">;
const emptyAgency = (): AgencyDraft => ({
  name: "", managerId: null, stage: "Captação", brokers: 0, city: "", contactName: "", phone: "", email: "", creci: "", notes: "", focus: null, standards: [], focusCities: [], active: true,
});

export function AgencyDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Agency | null }) {
  const { managers } = useCrmData();
  const [f, setF] = useState<AgencyDraft>(emptyAgency());
  const create = useCreateAgency();
  const update = useUpdateAgency();
  const toast = useToast();
  useEffect(() => {
    if (open) setF(initial ? { ...initial } : emptyAgency());
  }, [open, initial]);
  const set = <K extends keyof AgencyDraft>(k: K, v: AgencyDraft[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return;
    if (initial) await update.mutateAsync({ id: initial.id, ...f });
    else await create.mutateAsync(f);
    toast(initial ? "Cadastro atualizado" : "Imobiliária adicionada à carteira");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar imobiliária" : "Nova imobiliária"}
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={create.isPending || update.isPending} disabled={!f.name.trim()}>Salvar</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome" className="col-span-2">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nome da imobiliária" />
        </Field>
        <Field label="Gerente responsável">
          <Select value={f.managerId ?? ""} onChange={(e) => set("managerId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Sem gerente</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Etapa do relacionamento">
          <Select value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {AGENCY_STAGES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Contato principal">
          <Input value={f.contactName ?? ""} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(47) 90000-0000" />
        </Field>
        <Field label="E-mail">
          <Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Cidade">
          <Input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="CRECI">
          <Input value={f.creci ?? ""} onChange={(e) => set("creci", e.target.value)} />
        </Field>
        <Field label="Corretores estimados" hint="Estimativa cadastral">
          <Input type="number" value={f.brokers || ""} onChange={(e) => set("brokers", Number(e.target.value))} />
        </Field>
        <Field label="Foco de venda">
          <Select value={f.focus ?? ""} onChange={(e) => set("focus", e.target.value || null)}>
            <option value="">Não informado</option>
            {AGENCY_FOCUS.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Padrões de produto que trabalha" className="col-span-2" hint="Clique para marcar · digite para incluir outro">
          <ChipPicker options={PRODUCT_STANDARDS} value={f.standards ?? []} onChange={(v) => set("standards", v)} />
        </Field>
        <Field label="Cidades onde foca a venda" className="col-span-2">
          <ChipPicker options={FOCUS_CITIES} value={f.focusCities ?? []} onChange={(v) => set("focusCities", v)} />
        </Field>
        <Field label="Observações" className="col-span-2">
          <Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}

/** Seleção múltipla em chips, com sugestões e opção de incluir outro valor */
export function ChipPicker({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [extra, setExtra] = useState("");
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (x: string) => onChange(value.includes(x) ? value.filter((v) => v !== x) : [...value, x]);
  const add = () => {
    const t = extra.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setExtra("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {all.map((x) => {
        const on = value.includes(x);
        return (
          <button type="button" key={x} onClick={() => toggle(x)} className={on ? "rounded-full border border-brand bg-brand-soft px-2.5 py-1 text-[12.5px] font-medium text-forest" : "rounded-full border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:border-border-strong"}>
            {on ? "✓ " : ""}{x}
          </button>
        );
      })}
      <input value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} placeholder="+ outro" className="h-7 w-24 rounded-full border border-dashed border-border bg-transparent px-2.5 text-[12.5px] outline-none focus:border-brand" />
    </div>
  );
}

/* ---------- Atividade ---------- */

export type ActivityDraft = {
  type: string; date: string; time: string; status: string; agencyId: number | null; managerId: number | null; productId: number | null;
  personName: string; brokerName: string; participants: number; channel: string; notes: string; nextAction: string; nextDate: string;
};
/** O que falta para salvar a atividade (vazio = pode salvar) */
export const activityMissing = (f: ActivityDraft) =>
  [!f.date && "data", BROKER_REQUIRED_ACTIVITY.has(f.type) && !f.brokerName?.trim() && "corretor"].filter(Boolean) as string[];
export const emptyActivity = (over: Partial<ActivityDraft> = {}): ActivityDraft => ({
  type: ACTIVITY_TYPES[1], date: isoDate(new Date()), time: "", status: "Concluída", agencyId: null, managerId: null, productId: null,
  personName: "", brokerName: "", participants: 1, channel: "WhatsApp", notes: "", nextAction: "", nextDate: "", ...over,
});

export function ActivityFields({ f, set, compact }: { f: ActivityDraft; set: <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => void; compact?: boolean }) {
  const { agencies, products, managers } = useCrmData();
  const needsPerson = f.type.startsWith("Atendimento");
  const needsCount = f.type === "Visita à obra" || f.type === "Treinamento";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Imobiliária">
        <Select
          value={f.agencyId ?? ""}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            set("agencyId", id);
            const a = agencies.find((x) => x.id === id);
            if (a?.managerId) set("managerId", a.managerId);
          }}
        >
          <option value="">Selecione</option>
          {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Gerente responsável">
        <Select value={f.managerId ?? ""} onChange={(e) => set("managerId", e.target.value ? Number(e.target.value) : null)}>
          <option value="">Selecione</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>
      <Field label="Data">
        <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
      </Field>
      <Field label="Empreendimento">
        <Select value={f.productId ?? ""} onChange={(e) => set("productId", e.target.value ? Number(e.target.value) : null)}>
          <option value="">Geral / todos</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      {needsPerson && (
        <>
          <Field label={f.type === "Atendimento ao cliente" ? "Cliente" : "Corretor"}>
            {f.type === "Atendimento ao cliente" ? (
              <Input value={f.personName} onChange={(e) => set("personName", e.target.value)} placeholder="Nome" />
            ) : (
              <BrokerInput value={f.personName} onChange={(v) => set("personName", v)} agencyId={f.agencyId} placeholder="Nome" />
            )}
          </Field>
          {BROKER_REQUIRED_ACTIVITY.has(f.type) && (
            <Field label="Corretor *" hint="Obrigatório no atendimento ao cliente">
              <BrokerInput value={f.brokerName ?? ""} onChange={(v) => set("brokerName", v)} agencyId={f.agencyId} placeholder="Corretor que trouxe o cliente" className={!f.brokerName?.trim() ? "border-danger/60" : undefined} />
            </Field>
          )}
          <Field label="Canal">
            <Select value={f.channel} onChange={(e) => set("channel", e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </>
      )}
      {needsCount && (
        <Field label="Participantes" hint={f.type === "Visita à obra" ? "Soma no indicador de pessoas" : undefined}>
          <Input type="number" min={1} value={f.participants} onChange={(e) => set("participants", Math.max(1, Number(e.target.value)))} />
        </Field>
      )}
      <Field label="Assunto / resultado" className="sm:col-span-2">
        <Textarea rows={compact ? 2 : 3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Breve resumo da atividade" />
      </Field>
      {!compact && (
        <>
          <Field label="Próxima ação (opcional)">
            <Input value={f.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="Ex.: retornar ao corretor" />
          </Field>
          <Field label="Data da próxima ação" hint="Cria um item planejado na agenda">
            <Input type="date" value={f.nextDate} onChange={(e) => set("nextDate", e.target.value)} />
          </Field>
        </>
      )}
    </div>
  );
}

export function ActivityDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Partial<ActivityDraft> }) {
  const [f, setF] = useState<ActivityDraft>(emptyActivity(preset));
  const create = useCreateActivity();
  const toast = useToast();
  useEffect(() => {
    if (open) setF(emptyActivity(preset));
  }, [open]); // eslint-disable-line
  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setF((x) => ({ ...x, [k]: v }));
  const planned = f.status === "Planejada";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={planned ? "Agendar atividade" : "Registrar atividade"}
      subtitle={planned ? "Atividades planejadas não contam nos indicadores até serem concluídas" : undefined}
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={activityMissing(f).length > 0}
            onClick={async () => {
              await create.mutateAsync({ ...f, time: f.time || null });
              toast(planned ? "Atividade agendada" : "Atividade registrada");
              onClose();
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tipo de atividade">
          <Select value={f.type} onChange={(e) => set("type", e.target.value)}>
            {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Situação">
          <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option>Concluída</option>
            <option>Planejada</option>
          </Select>
        </Field>
        {planned && (
          <Field label="Horário">
            <Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
        )}
      </div>
      <ActivityFields f={f} set={set} compact />
    </Modal>
  );
}
