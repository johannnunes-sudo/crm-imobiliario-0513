// Resolução de metas mensais (compartilhada entre API e web)
type G = { managerId: number | null; metric: string; target: number; month: string | null };

/**
 * Meta de um mês: a lançada para o mês; se não houver, a do último mês anterior lançado;
 * se não houver nenhuma, a meta base antiga (sem mês).
 */
export function goalForMonth(goals: G[], metric: string, managerId: number | null, month: string) {
  const mine = goals.filter((g) => g.metric === metric && (g.managerId ?? null) === managerId);
  const exact = mine.find((g) => g.month === month);
  if (exact) return { target: exact.target, from: month };
  const prev = mine.filter((g) => g.month && g.month < month).sort((a, b) => b.month!.localeCompare(a.month!))[0];
  if (prev) return { target: prev.target, from: prev.month };
  const base = mine.find((g) => !g.month);
  return { target: base?.target ?? 0, from: base ? null : undefined };
}
