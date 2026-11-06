import { useMemo } from "react";
import { useCrmData } from "../queries/crm";
import { useFilters } from "../components/filters";
import { inRange, lastInteractionMap } from "../lib/metrics";

/** Dados + filtros globais aplicados + lookups */
export function useCrm() {
  const d = useCrmData();
  const f = useFilters();
  return useMemo(() => {
    const byMgr = <T extends { managerId: number | null }>(x: T[]) => (f.managerId ? x.filter((i) => i.managerId === f.managerId) : x);
    const agencies = byMgr(d.agencies);
    const activities = byMgr(d.activities);
    const opportunities = byMgr(d.opportunities);
    const lastMap = lastInteractionMap(d.activities);
    return {
      ...d,
      filters: f,
      scoped: { agencies, activities, opportunities },
      period: {
        activities: activities.filter((a) => inRange(a.date, f.range)),
        opportunities: opportunities.filter((o) => inRange(o.date, f.range)),
      },
      prev: {
        activities: activities.filter((a) => inRange(a.date, f.prevRange)),
        opportunities: opportunities.filter((o) => inRange(o.date, f.prevRange)),
      },
      lastMap,
      agencyName: (id: number | null) => d.agencies.find((a) => a.id === id)?.name ?? "Venda direta",
      productName: (id: number | null) => d.products.find((p) => p.id === id)?.name ?? "Geral",
      manager: (id: number | null) => d.managers.find((m) => m.id === id),
    };
  }, [d, f]);
}
