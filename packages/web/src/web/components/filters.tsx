import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CalendarRange, Users } from "lucide-react";
import { PERIODS, periodRange, previousRange, type Period } from "../lib/metrics";
import { useManagers, usePerms } from "../queries/crm";
import { cn } from "../lib/utils";

type Filters = {
  period: Period;
  setPeriod: (p: Period) => void;
  managerId: number | null;
  setManagerId: (id: number | null) => void;
  range: [string, string];
  prevRange: [string, string];
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

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [period, setP] = useState<Period>(() => {
    const p = load<Period>("pf_period", "Mês atual");
    return PERIODS.includes(p) ? p : "Mês atual";
  });
  const [managerId, setM] = useState<number | null>(() => load("pf_manager", null));
  const value = useMemo<Filters>(
    () => ({
      period,
      setPeriod: (p) => {
        setP(p);
        localStorage.setItem("pf_period", JSON.stringify(p));
      },
      managerId,
      setManagerId: (id) => {
        setM(id);
        localStorage.setItem("pf_manager", JSON.stringify(id));
      },
      range: periodRange(period),
      prevRange: previousRange(period),
    }),
    [period, managerId],
  );
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
    <div className={cn("flex items-center gap-2", className)}>
      {showPeriod && <div className="relative">
        <CalendarRange className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <select className={pill} value={f.period} onChange={(e) => f.setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>}
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
