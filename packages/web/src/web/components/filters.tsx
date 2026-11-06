import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CalendarRange, Users } from "lucide-react";
import { PERIODS, monthsIn, periodRange, previousRange, type Period } from "../lib/metrics";
import { isoDate } from "../lib/format";
import { useManagers, usePerms } from "../queries/crm";
import { cn } from "../lib/utils";

type Filters = {
  period: Period;
  setPeriod: (p: Period) => void;
  /** intervalo escolhido em "Personalizado" (de / até, ISO) */
  custom: [string, string];
  setCustom: (r: [string, string]) => void;
  managerId: number | null;
  setManagerId: (id: number | null) => void;
  range: [string, string];
  prevRange: [string, string];
  /** meses cobertos pelo período, para escalar metas mensais */
  months: number;
  /** texto do período para subtítulos ("mês atual", "01/10 a 15/10/2026") */
  label: string;
};

const Ctx = createContext<Filters | null>(null);

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};

const defaultCustom = (): [string, string] => {
  const t = new Date();
  return [isoDate(new Date(t.getFullYear(), t.getMonth(), 1)), isoDate(t)];
};
const fullDate = (iso: string) => iso.split("-").reverse().join("/");

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [period, setP] = useState<Period>(() => {
    const p = load<Period>("pf_period", "Mês atual");
    return PERIODS.includes(p) ? p : "Mês atual";
  });
  const [custom, setC] = useState<[string, string]>(() => load("pf_custom", defaultCustom()));
  const [managerId, setM] = useState<number | null>(() => load("pf_manager", null));
  const value = useMemo<Filters>(() => {
    const isCustom = period === "Personalizado";
    return {
      period,
      setPeriod: (p) => {
        setP(p);
        localStorage.setItem("pf_period", JSON.stringify(p));
      },
      custom,
      setCustom: (r) => {
        // garante de <= até
        const v: [string, string] = r[0] <= r[1] ? r : [r[1], r[0]];
        setC(v);
        localStorage.setItem("pf_custom", JSON.stringify(v));
      },
      managerId,
      setManagerId: (id) => {
        setM(id);
        localStorage.setItem("pf_manager", JSON.stringify(id));
      },
      range: isCustom ? custom : periodRange(period),
      prevRange: previousRange(period, undefined, custom),
      months: monthsIn(period, custom),
      label: isCustom ? `${fullDate(custom[0])} a ${fullDate(custom[1])}` : period.toLowerCase(),
    };
  }, [period, custom, managerId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFilters = () => useContext(Ctx)!;

const pill =
  "h-8.5 cursor-pointer appearance-none rounded-md border border-border bg-card pl-8 pr-7 text-[13px] font-medium text-foreground outline-none hover:border-border-strong focus:border-brand bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b726d%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_8px_center] bg-no-repeat";

export function GlobalFilters({ showManager = true, showPeriod = true, className }: { showManager?: boolean; showPeriod?: boolean; className?: string }) {
  const f = useFilters();
  const managers = useManagers();
  const perms = usePerms();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showPeriod && <div className="relative">
        <CalendarRange className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <select className={pill} value={f.period} onChange={(e) => f.setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => (
            <option key={p} value={p}>{p === "Personalizado" ? "Personalizado…" : p}</option>
          ))}
        </select>
      </div>}
      {showPeriod && f.period === "Personalizado" && (
        <div className="flex h-8.5 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[13px]">
          <span className="text-muted-foreground">de</span>
          <input type="date" aria-label="Data inicial" className="tnum bg-transparent outline-none" value={f.custom[0]} max={f.custom[1]} onChange={(e) => e.target.value && f.setCustom([e.target.value, f.custom[1]])} />
          <span className="text-muted-foreground">até</span>
          <input type="date" aria-label="Data final" className="tnum bg-transparent outline-none" value={f.custom[1]} min={f.custom[0]} onChange={(e) => e.target.value && f.setCustom([f.custom[0], e.target.value])} />
        </div>
      )}
      {showManager && perms.seesAll && (
        <div className="relative">
          <Users className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <select className={pill} value={f.managerId ?? ""} onChange={(e) => f.setManagerId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todos os gerentes</option>
            {managers.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
