import { businessDaysBetween, MIN_LEAD_DAYS } from "../../shared/dates";
import { isoDate } from "./format";
import type { Activity } from "../queries/crm";

export type LeadKind = "planejada" | "espontanea" | "lembrete";

/** Dias úteis de antecedência no cadastro (registros antigos: calculado pela data de criação) */
export const leadOf = (a: Activity) => a.leadDays ?? businessDaysBetween(isoDate(new Date(a.createdAt)), a.date);

/** Regra do Daniel: >= 3 dias úteis = planejada (verde); menos = espontânea (vermelho); lembretes ficam fora */
export const leadKind = (a: Activity): LeadKind => (a.origin === "lembrete" ? "lembrete" : leadOf(a) >= MIN_LEAD_DAYS ? "planejada" : "espontanea");

export const LEAD_LABEL: Record<LeadKind, string> = {
  planejada: `Com antecedência (${MIN_LEAD_DAYS}+ dias úteis)`,
  espontanea: `Em cima da hora (< ${MIN_LEAD_DAYS} dias úteis)`,
  lembrete: "Lembrete de próximo passo",
};

/** Classes do chip na agenda: cor = antecedência */
export const LEAD_CHIP: Record<LeadKind, string> = {
  planejada: "border-brand bg-brand-soft text-forest",
  espontanea: "border-danger bg-danger-soft text-[#8c2f28]",
  lembrete: "border-border-strong bg-muted text-muted-foreground",
};
export const LEAD_DOT: Record<LeadKind, string> = { planejada: "bg-brand", espontanea: "bg-danger", lembrete: "bg-subtle" };
