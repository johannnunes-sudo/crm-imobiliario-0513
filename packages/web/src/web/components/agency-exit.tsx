import { useEffect, useState } from "react";
import { EXIT_REASONS } from "../../shared/constants";
import { useDecideExit, useInactivateAgency, useRequestExit, useCrmData, type Agency, type AgencyExit } from "../queries/crm";
import { fmtDate, isoDate } from "../lib/format";
import { Badge, Button, Field, Modal, Select, Textarea, useToast } from "./ui/kit";

export const EXIT_STATUS_LABEL: Record<string, string> = {
  pendente: "Saída solicitada",
  inativada: "Inativada",
  transferida: "Transferida",
  recusada: "Saída recusada",
  reativada: "Reativada",
};
export const EXIT_TONE: Record<string, "amber" | "danger" | "brand" | "neutral" | "forest"> = {
  pendente: "amber", inativada: "danger", transferida: "forest", recusada: "neutral", reativada: "brand",
};

function ReasonFields({ reason, note, setReason, setNote }: { reason: string; note: string; setReason: (v: string) => void; setNote: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Motivo *">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Selecione o motivo</option>
          {EXIT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label={reason === "Outro" ? "Descreva o motivo *" : "Detalhe (opcional)"}>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: imobiliária passou a trabalhar só com locação" />
      </Field>
    </div>
  );
}

/** Gerente pede a saída (mode=request) ou ADM inativa direto (mode=inactivate) */
export function ExitRequestDialog({ agency, mode, onClose }: { agency: Agency | null; mode: "request" | "inactivate"; onClose: () => void }) {
  const request = useRequestExit();
  const inactivate = useInactivateAgency();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (agency) { setReason(""); setNote(""); setErr(""); } }, [agency]);
  const ok = !!reason && (reason !== "Outro" || !!note.trim());
  const save = async () => {
    if (!agency || !ok) return;
    setErr("");
    try {
      const body = { agencyId: agency.id, reason: reason as (typeof EXIT_REASONS)[number], note: note.trim() || null };
      if (mode === "request") { await request.mutateAsync(body); toast("Saída solicitada · aguardando decisão do ADM"); }
      else { await inactivate.mutateAsync(body); toast(`${agency.name} inativada`); }
      onClose();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Modal
      open={!!agency}
      onClose={onClose}
      title={mode === "request" ? "Solicitar saída da carteira" : "Inativar imobiliária"}
      subtitle={
        mode === "request"
          ? `${agency?.name ?? ""} · continua na sua carteira e nos indicadores até o ADM decidir (inativar, transferir ou recusar)`
          : `${agency?.name ?? ""} · sai do kanban e das metas; lembretes futuros são cancelados; histórico e vendas ficam guardados`
      }
      width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant={mode === "request" ? "primary" : "danger"} onClick={save} loading={request.isPending || inactivate.isPending} disabled={!ok}>{mode === "request" ? "Enviar solicitação" : "Inativar"}</Button></>}
    >
      <ReasonFields reason={reason} note={note} setReason={setReason} setNote={setNote} />
      {err && <p className="mt-3 text-[12.5px] text-danger">{err}</p>}
    </Modal>
  );
}

/** ADM decide uma solicitação pendente */
export function ExitDecisionDialog({ exit, onClose }: { exit: AgencyExit | null; onClose: () => void }) {
  const { agencies, managers } = useCrmData();
  const decide = useDecideExit();
  const toast = useToast();
  const [decision, setDecision] = useState<"inativar" | "transferir" | "recusar">("transferir");
  const [to, setTo] = useState<string>("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (exit) { setDecision("transferir"); setTo(""); setNote(""); setErr(""); } }, [exit]);
  const ag = agencies.find((a) => a.id === exit?.agencyId);
  const from = managers.find((m) => m.id === exit?.managerId);
  const ok = decision !== "recusar" || !!note.trim();
  const save = async () => {
    if (!exit || !ok) return;
    setErr("");
    try {
      await decide.mutateAsync({ id: exit.id, decision, toManagerId: decision === "transferir" ? (to ? Number(to) : null) : null, note: note.trim() || null });
      toast(decision === "inativar" ? "Imobiliária inativada" : decision === "transferir" ? "Imobiliária transferida" : "Solicitação recusada");
      onClose();
    } catch (e) { setErr((e as Error).message); }
  };
  const opts = [
    { v: "transferir", t: "Transferir", d: "Continua ativa, muda de gerente (ou vai para a roleta, sem gerente)" },
    { v: "inativar", t: "Inativar", d: "Sai da operação: some do kanban e das metas, cancela lembretes futuros" },
    { v: "recusar", t: "Recusar", d: "Continua com a gerente; ela recebe o motivo da recusa" },
  ] as const;
  return (
    <Modal
      open={!!exit}
      onClose={onClose}
      title={`Saída da carteira · ${ag?.name ?? ""}`}
      subtitle={exit ? `Pedido de ${exit.requestedBy} em ${fmtDate(isoDate(new Date(exit.createdAt)))}${from ? ` · carteira de ${from.name}` : ""}` : ""}
      width={560}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant={decision === "inativar" ? "danger" : "primary"} onClick={save} loading={decide.isPending} disabled={!ok}>Confirmar decisão</Button></>}
    >
      {exit && (
        <div className="mb-4 rounded-md bg-muted px-3 py-2.5 text-[13px]">
          <div className="font-medium">{exit.reason}</div>
          {exit.note && <div className="mt-0.5 text-muted-foreground">{exit.note}</div>}
        </div>
      )}
      <div className="space-y-2">
        {opts.map((o) => (
          <label key={o.v} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${decision === o.v ? "border-brand bg-brand-soft" : "border-border"}`}>
            <input type="radio" className="mt-1 accent-[#5FAE3A]" checked={decision === o.v} onChange={() => setDecision(o.v)} />
            <span><span className="text-[13.5px] font-medium">{o.t}</span><span className="block text-[12px] text-muted-foreground">{o.d}</span></span>
          </label>
        ))}
      </div>
      {decision === "transferir" && (
        <Field label="Para" className="mt-4">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Roleta (sem gerente)</option>
            {managers.filter((m) => m.active && m.id !== exit?.managerId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={decision === "recusar" ? "Motivo da recusa *" : "Observação (opcional)"} className="mt-4">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="mt-3 text-[12.5px] text-danger">{err}</p>}
    </Modal>
  );
}

/** Histórico de saídas/reativações de uma imobiliária */
export function ExitHistory({ rows }: { rows: AgencyExit[] }) {
  const { managers } = useCrmData();
  if (!rows.length) return <p className="text-[12.5px] text-muted-foreground">Nenhuma solicitação de saída.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.id} className="text-[12.5px]">
          <div className="flex items-center gap-2"><Badge tone={EXIT_TONE[r.status]} dot>{EXIT_STATUS_LABEL[r.status]}</Badge><span className="text-subtle">{fmtDate(isoDate(new Date(r.createdAt)))}</span></div>
          <div className="mt-1 text-muted-foreground">
            {r.reason && <>Motivo: {r.reason}{r.note ? ` — ${r.note}` : ""} · </>}pedido por {r.requestedBy}
            {r.decidedBy && r.status !== "pendente" && <> · decidido por {r.decidedBy}{r.status === "transferida" ? ` → ${managers.find((m) => m.id === r.toManagerId)?.name ?? "roleta"}` : ""}{r.decisionNote ? ` (${r.decisionNote})` : ""}</>}
          </div>
        </div>
      ))}
    </div>
  );
}
