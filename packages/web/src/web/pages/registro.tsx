import { useState } from "react";
import { Building, Handshake, GraduationCap, HardHat, UserRound, Headset, FileSignature, BadgeDollarSign, Send, Megaphone } from "lucide-react";
import { ACTIVITY_TYPES } from "../../shared/constants";
import { useCrm } from "../hooks/use-crm";
import { useCreateActivity, type Activity } from "../queries/crm";
import { NextStepDialog } from "../components/next-step";
import { isoDate } from "../lib/format";
import { ActivityFields, OpportunityDialog, activityMissing, emptyActivity, type ActivityDraft } from "../components/forms";
import { ActivityFeed } from "../components/blocks";
import { Button, PageHeader, PageSkeleton, Panel, PanelHeader, useToast } from "../components/ui/kit";
import { cn } from "../lib/utils";

const ICONS: Record<string, typeof Building> = {
  "Captação imobiliária": Handshake,
  "Visita à imobiliária": Building,
  "Atendimento a corretor": Headset,
  Treinamento: GraduationCap,
  "Visita à obra": HardHat,
  "Atendimento ao cliente": UserRound,
  "Envio de material / Follow-up": Send,
  "Ação de vendas / Evento": Megaphone,
};

export default function Registro() {
  const c = useCrm();
  const [f, setF] = useState<ActivityDraft>(emptyActivity());
  const [opp, setOpp] = useState<null | "Proposta" | "Venda">(null);
  const create = useCreateActivity();
  const [doneAct, setDoneAct] = useState<Activity | null>(null);
  const toast = useToast();
  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setF((x) => ({ ...x, [k]: v }));

  if (c.isLoading) return <PageSkeleton />;

  const save = async (again: boolean) => {
    const row = await create.mutateAsync({ ...f, time: null, nextAction: f.nextAction || null, nextDate: f.nextDate || null });
    toast(f.nextDate ? "Atividade registrada e próxima ação agendada" : "Atividade registrada");
    // sem próxima ação definida: oferece os lembretes rápidos
    if (!f.nextDate && (f.status ?? "Concluída") === "Concluída") setDoneAct(row as Activity);
    setF(again ? emptyActivity({ type: f.type, agencyId: f.agencyId, managerId: f.managerId, date: f.date, productId: f.productId }) : emptyActivity());
  };

  const todays = c.activities.filter((a) => a.date === isoDate(new Date()) && a.status === "Concluída");

  return (
    <>
      <PageHeader title="Registro rápido" subtitle="Registre em segundos as ações comerciais do dia" />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHeader title="1. Tipo de atividade" />
          <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-4">
            {ACTIVITY_TYPES.map((t) => {
              const Icon = ICONS[t];
              const on = f.type === t;
              return (
                <button
                  key={t}
                  onClick={() => set("type", t)}
                  className={cn(
                    "flex flex-col items-start gap-2.5 rounded-lg border p-3 text-left text-[13px] transition-colors",
                    on ? "border-brand bg-brand-soft text-forest" : "border-border hover:border-border-strong hover:bg-muted/60",
                  )}
                >
                  <Icon className={cn("size-4.5", on ? "text-brand-strong" : "text-subtle")} strokeWidth={1.8} />
                  <span className="font-medium leading-snug">{t}</span>
                </button>
              );
            })}
            {(["Proposta", "Venda"] as const).map((t) => {
              const Icon = t === "Proposta" ? FileSignature : BadgeDollarSign;
              return (
                <button key={t} onClick={() => setOpp(t)} className="flex flex-col items-start gap-2.5 rounded-lg border border-dashed border-border-strong p-3 text-left text-[13px] transition-colors hover:bg-muted/60">
                  <Icon className="size-4.5 text-subtle" strokeWidth={1.8} />
                  <span className="font-medium leading-snug">{t}<span className="block text-[11.5px] font-normal text-muted-foreground">via pipeline</span></span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border">
            <PanelHeader title="2. Detalhes" />
            <div className="px-5 pb-5">
              <ActivityFields f={f} set={set} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3 rounded-b-lg">
            <span className="mr-auto text-[12px] text-subtle">{activityMissing(f).length ? `Falta: ${activityMissing(f).join(", ")}` : "Conta imediatamente no indicador correspondente."}</span>
            <Button onClick={() => save(true)} loading={create.isPending} disabled={activityMissing(f).length > 0}>Salvar e registrar outra</Button>
            <Button variant="primary" onClick={() => save(false)} loading={create.isPending} disabled={activityMissing(f).length > 0}>Salvar atividade</Button>
          </div>
        </Panel>
        <div>
          <ActivityFeed
            title={todays.length ? `Registradas hoje · ${todays.length}` : "Últimos registros"}
            activities={todays.length ? todays : c.activities}
            agencyName={c.agencyName}
            managers={c.managers}
            limit={8}
          />
        </div>
      </div>
      <NextStepDialog done={doneAct} agencyName={doneAct?.agencyId ? c.agencyName(doneAct.agencyId) : undefined} onClose={() => setDoneAct(null)} />
      <OpportunityDialog open={!!opp} onClose={() => setOpp(null)} initial={null} preset={{ stage: opp ?? "Proposta", agencyId: f.agencyId, managerId: f.managerId, productId: f.productId }} />
    </>
  );
}
