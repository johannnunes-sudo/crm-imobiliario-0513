import { useEffect, useState } from "react";
import { BellPlus } from "lucide-react";
import { NEXT_STEPS } from "../../shared/constants";
import { useCreateActivity, type Activity } from "../queries/crm";
import { isoDate } from "../lib/format";
import { Button, Field, Input, Modal, useToast } from "./ui/kit";
import { cn } from "../lib/utils";

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  // fim de semana → próxima segunda
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return isoDate(d);
};

/**
 * Aberto logo após concluir uma atividade: oferece lembretes rápidos
 * (enviar material, agendar treinamento...) que viram atividades planejadas na agenda.
 */
export function NextStepDialog({ done, agencyName, onClose }: { done: Activity | null; agencyName?: string; onClose: () => void }) {
  const create = useCreateActivity();
  const toast = useToast();
  const [picked, setPicked] = useState<number[]>([]);
  const [dates, setDates] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  useEffect(() => {
    if (done) {
      setPicked([]);
      setNote("");
      setDates(Object.fromEntries(NEXT_STEPS.map((s, i) => [i, addDays(s.days)])));
    }
  }, [done]);
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const save = async () => {
    if (!done) return;
    for (const i of picked) {
      const s = NEXT_STEPS[i];
      await create.mutateAsync({
        type: s.type,
        date: dates[i],
        status: "Planejada",
        agencyId: done.agencyId,
        managerId: done.managerId,
        productId: done.productId,
        notes: [s.label, note.trim()].filter(Boolean).join(" · "),
        origin: "lembrete",
      });
    }
    toast(`${picked.length} lembrete${picked.length > 1 ? "s" : ""} na agenda`);
    onClose();
  };

  return (
    <Modal
      open={!!done}
      onClose={onClose}
      title="Concluída! Qual o próximo passo?"
      subtitle={`${done?.type ?? ""}${agencyName ? ` · ${agencyName}` : ""} · os lembretes entram na sua agenda como planejados`}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Sem próximo passo</Button>
          <Button variant="primary" onClick={save} loading={create.isPending} disabled={!picked.length}>
            <BellPlus className="size-3.5" /> Criar {picked.length > 1 ? `${picked.length} lembretes` : "lembrete"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {NEXT_STEPS.map((s, i) => {
          const on = picked.includes(i);
          return (
            <div key={s.label} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors", on ? "border-brand bg-brand-soft" : "border-border")}>
              <button type="button" onClick={() => toggle(i)} className="flex flex-1 items-center gap-2.5 text-left">
                <span className={cn("flex size-4.5 items-center justify-center rounded border text-[11px] text-white", on ? "border-brand bg-brand" : "border-border-strong")}>{on && "✓"}</span>
                <span className="text-[13.5px] font-medium">{s.label}</span>
                <span className="text-[12px] text-muted-foreground">{s.type}</span>
              </button>
              <Input type="date" aria-label={`Data de ${s.label}`} className="h-8 w-[150px]" value={dates[i] ?? ""} onChange={(e) => { setDates({ ...dates, [i]: e.target.value }); if (!on) toggle(i); }} />
            </div>
          );
        })}
        <Field label="Observação (opcional)" className="pt-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: enviar tabela e book do Florencio Tower" />
        </Field>
      </div>
    </Modal>
  );
}
