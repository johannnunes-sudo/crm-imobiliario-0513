import { useState } from "react";
import { ArrowRight, Undo2 } from "lucide-react";
import { ACTIVITY_BY_STAGE, AGENCY_STAGES, METRIC_BY_STAGE, type AgencyStage } from "../../shared/constants";
import { useCreateActivity, useCrmData, useUpdateAgency, type Agency } from "../queries/crm";
import { agencyStageColor } from "../lib/tones";
import { ActivityFields, activityMissing, emptyActivity, OpportunityDialog, SaleDialog, type ActivityDraft } from "./forms";
import { Button, Modal, useToast } from "./ui/kit";

type Req = { agency: Agency; stage: AgencyStage } | null;

const stageIdx = (s: string) => AGENCY_STAGES.indexOf(s as AgencyStage);

/**
 * Fluxo de mudança de etapa da carteira.
 * Avançar pergunta e contabiliza: etapas 1–6 registram a atividade do indicador,
 * Proposta cria a oportunidade e Venda pede o valor de contrato.
 */
export function useStageAdvance() {
  const { opportunities } = useCrmData();
  const [req, setReq] = useState<Req>(null);
  const [kind, setKind] = useState<"activity" | "back" | "proposal" | "sale" | "newSale" | null>(null);
  const [f, setF] = useState<ActivityDraft>(emptyActivity());
  const update = useUpdateAgency();
  const create = useCreateActivity();
  const toast = useToast();

  const close = () => {
    setKind(null);
    setReq(null);
  };

  const openSales = (a: Agency) => opportunities.filter((o) => o.agencyId === a.id && o.stage !== "Venda" && o.stage !== "Declinou");

  const request = (agency: Agency, stage: AgencyStage) => {
    if (agency.stage === stage) return;
    setReq({ agency, stage });
    if (stageIdx(stage) < stageIdx(agency.stage)) return setKind("back");
    if (stage === "Proposta") return setKind("proposal");
    if (stage === "Venda") return setKind(openSales(agency).length ? "sale" : "newSale");
    const type = ACTIVITY_BY_STAGE[stage]!;
    setF(
      emptyActivity({
        type,
        agencyId: agency.id,
        managerId: agency.managerId,
        participants: type === "Visita à obra" ? 2 : type === "Treinamento" ? 5 : 1,
        channel: type.startsWith("Atendimento") ? "WhatsApp" : "Presencial",
      }),
    );
    setKind("activity");
  };

  const move = (a: Agency, stage: AgencyStage, msg?: string) => {
    update.mutate({ id: a.id, stage });
    toast(msg ?? `${a.name} → ${stage}`);
  };

  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setF((x) => ({ ...x, [k]: v }));

  const element = req ? (
    <>
      {kind === "activity" && (
        <Modal
          open
          onClose={close}
          title={`Avançar para ${req.stage}?`}
          subtitle={req.agency.name}
          width={600}
          footer={
            <>
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  move(req.agency, req.stage, `${req.agency.name} → ${req.stage} (sem registro)`);
                  close();
                }}
              >
                Só mover, sem contabilizar
              </Button>
              <Button variant="ghost" onClick={close}>Cancelar</Button>
              <Button
                variant="primary"
                loading={create.isPending}
                disabled={activityMissing(f).length > 0}
                onClick={async () => {
                  await create.mutateAsync({ ...f, status: "Concluída", time: null });
                  move(req.agency, req.stage, `${req.stage} registrada · +${f.type === "Visita à obra" ? f.participants : 1} em ${METRIC_BY_STAGE[req.stage]}`);
                  close();
                }}
              >
                Avançar e contabilizar
              </Button>
            </>
          }
        >
          <StageHop from={req.agency.stage} to={req.stage} />
          <p className="mb-4 text-[13px] text-muted-foreground">
            Será registrada uma atividade de <span className="font-medium text-foreground">{f.type}</span>, que conta no indicador{" "}
            <span className="font-medium text-foreground">{METRIC_BY_STAGE[req.stage]}</span>
            {f.type === "Visita à obra" ? " (soma o número de pessoas)" : ""}.
          </p>
          <ActivityFields f={f} set={set} compact />
        </Modal>
      )}

      {kind === "back" && (
        <Modal
          open
          onClose={close}
          title={`Voltar para ${req.stage}?`}
          subtitle={req.agency.name}
          width={460}
          footer={
            <>
              <Button variant="ghost" onClick={close}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={() => {
                  move(req.agency, req.stage);
                  close();
                }}
              >
                <Undo2 className="size-3.5" /> Voltar etapa
              </Button>
            </>
          }
        >
          <StageHop from={req.agency.stage} to={req.stage} />
          <p className="text-[13px] text-muted-foreground">Voltar de etapa não altera nenhum indicador. As atividades já registradas continuam contabilizadas.</p>
        </Modal>
      )}

      <OpportunityDialog
        open={kind === "proposal" || kind === "newSale"}
        onClose={close}
        preset={{ agencyId: req.agency.id, managerId: req.agency.managerId, stage: kind === "newSale" ? "Venda" : "Proposta", temperature: kind === "newSale" ? "Quente" : "Morno" }}
        onSaved={() => move(req.agency, req.stage, `${req.agency.name} → ${req.stage} · contabilizado em ${METRIC_BY_STAGE[req.stage]}`)}
      />

      <SaleDialog
        open={kind === "sale"}
        onClose={close}
        agencyName={req.agency.name}
        opps={openSales(req.agency)}
        onDone={() => move(req.agency, "Venda", `${req.agency.name} → Venda · contabilizada`)}
        onNew={() => setKind("newSale")}
      />
    </>
  ) : null;

  return { request, element };
}

function StageHop({ from, to }: { from: string; to: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[12.5px]">
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: agencyStageColor[from] }} />
        {from}
      </span>
      <ArrowRight className="size-3.5 text-subtle" />
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-card px-2 py-1 font-medium">
        <span className="size-2 rounded-full" style={{ background: agencyStageColor[to] }} />
        {to}
      </span>
    </div>
  );
}
