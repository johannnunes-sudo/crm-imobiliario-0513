import { COUNTS_PARTICIPANTS, METRICS, METRIC_BY_ACTIVITY, type Metric } from "../../shared/constants";
import { isoDate, parseISO, daysBetween } from "./format";
import type { Activity, Agency, Opportunity } from "../queries/crm";

export const PERIODS = [
  "Hoje",
  "Semana atual",
  "Mês atual",
  "Mês anterior",
  "Trimestre atual",
  "Trimestre anterior",
  "Acumulado do ano",
  "Últimos 6 meses",
  "Personalizado",
] as const;
export type Period = (typeof PERIODS)[number];

export const today = () => new Date();

/** Retorna [from, to] inclusivos em ISO */
export function periodRange(p: Period, ref = today()): [string, string] {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const q = Math.floor(m / 3);
  const end = (d: Date) => isoDate(d);
  switch (p) {
    case "Hoje":
      return [isoDate(ref), isoDate(ref)];
    case "Semana atual": {
      const s = new Date(ref);
      s.setDate(ref.getDate() - ref.getDay());
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return [isoDate(s), end(e)];
    }
    case "Mês atual":
      return [isoDate(new Date(y, m, 1)), end(new Date(y, m + 1, 0))];
    case "Mês anterior":
      return [isoDate(new Date(y, m - 1, 1)), end(new Date(y, m, 0))];
    case "Trimestre atual":
      return [isoDate(new Date(y, q * 3, 1)), end(new Date(y, q * 3 + 3, 0))];
    case "Trimestre anterior":
      return [isoDate(new Date(y, q * 3 - 3, 1)), end(new Date(y, q * 3, 0))];
    case "Acumulado do ano":
      return [isoDate(new Date(y, 0, 1)), end(new Date(y, 11, 31))];
    case "Últimos 6 meses":
      return [isoDate(new Date(y, m - 5, 1)), end(new Date(y, m + 1, 0))];
    case "Personalizado":
      return [isoDate(new Date(y, m, 1)), end(ref)]; // padrão; o intervalo real vem do filtro
  }
}

/** Período imediatamente anterior de mesma natureza (para comparação) */
export function previousRange(p: Period, ref = today(), custom?: [string, string]): [string, string] {
  const map: Partial<Record<Period, Period>> = { "Mês atual": "Mês anterior", "Trimestre atual": "Trimestre anterior" };
  if (map[p]) return periodRange(map[p]!, ref);
  const [f, t] = p === "Personalizado" && custom ? custom : periodRange(p, ref);
  const len = parseISO(t).getTime() - parseISO(f).getTime() + 86_400_000;
  const nt = new Date(parseISO(f).getTime() - 86_400_000);
  const nf = new Date(nt.getTime() - len + 86_400_000);
  return [isoDate(nf), isoDate(nt)];
}

/** Quantos meses o período cobre (para escalar metas mensais) */
export function monthsIn(p: Period, custom?: [string, string]) {
  if (p === "Personalizado" && custom) {
    // metas mensais proporcionais aos dias do intervalo (mínimo de 1 dia)
    const days = Math.max(1, Math.round((parseISO(custom[1]).getTime() - parseISO(custom[0]).getTime()) / 86_400_000) + 1);
    return Math.round((days / 30.4) * 10) / 10;
  }
  if (p === "Hoje" || p === "Semana atual") return 1;
  if (p.startsWith("Trimestre")) return 3;
  if (p === "Acumulado do ano") return today().getMonth() + 1;
  if (p === "Últimos 6 meses") return 6;
  return 1;
}

export const inRange = (d: string, [f, t]: [string, string]) => d >= f && d <= t;

export const isProposal = (o: Opportunity) => o.stage !== "Em negociação";
export const isSale = (o: Opportunity) => o.stage === "Venda";

export function computeMetrics(acts: Activity[], opps: Opportunity[]): Record<Metric, number> {
  const r = Object.fromEntries(METRICS.map((m) => [m, 0])) as Record<Metric, number>;
  for (const a of acts) {
    if (a.status !== "Concluída") continue;
    const metric = METRIC_BY_ACTIVITY[a.type];
    if (!metric) continue;
    r[metric] += COUNTS_PARTICIPANTS.has(a.type) ? a.participants : 1;
  }
  for (const o of opps) {
    if (isProposal(o)) r.Propostas++;
    if (isSale(o)) r.Vendas++;
  }
  return r;
}

/** Última interação concluída por imobiliária */
export function lastInteractionMap(acts: Activity[]) {
  const map = new Map<number, string>();
  for (const a of acts) {
    if (a.status !== "Concluída" || !a.agencyId) continue;
    const cur = map.get(a.agencyId);
    if (!cur || a.date > cur) map.set(a.agencyId, a.date);
  }
  return map;
}

export function daysSince(agency: Agency, map: Map<number, string>) {
  const d = map.get(agency.id);
  return d ? daysBetween(d, today()) : 999;
}

export type Health = "ok" | "warn" | "critical";
export const health = (days: number): Health => (days >= 60 ? "critical" : days >= 30 ? "warn" : "ok");

/** Série mensal (últimos n meses) */
export function monthlySeries(n: number, fn: (from: string, to: string) => number, ref = today()) {
  const out: { key: string; month: number; value: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const e = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0);
    out.push({ key: isoDate(s).slice(0, 7), month: s.getMonth(), value: fn(isoDate(s), isoDate(e)) });
  }
  return out;
}

import type { Goal } from "../queries/crm";
/** p = período nomeado ou número de meses já calculado (filtro personalizado) */
export function goalFor(goals: Goal[], metric: string, managerId: number | null, p: Period | number) {
  const g = goals.find((x) => x.metric === metric && (x.managerId ?? null) === managerId);
  return Math.round((g?.target ?? 0) * (typeof p === "number" ? p : monthsIn(p)));
}


/** Intervalo [from,to] de um mês "YYYY-MM" */
export const monthRange = (key: string): [string, string] => {
  const [y, m] = key.split("-").map(Number);
  return [`${key}-01`, isoDate(new Date(y, m, 0))];
};
