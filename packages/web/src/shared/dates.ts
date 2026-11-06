// Datas compartilhadas entre API e web (regra de antecedência da agenda)

/** Antecedência mínima, em dias úteis, para uma ação contar como planejada */
export const MIN_LEAD_DAYS = 3;

const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Dias úteis (seg–sex) entre o cadastro e a data da ação, sem contar o dia do cadastro.
 * Ex.: cadastrada na segunda para quinta = 3; sexta para segunda = 1; mesmo dia ou data passada = 0.
 */
export function businessDaysBetween(fromIso: string, toIso: string) {
  const from = parse(fromIso);
  const to = parse(toIso);
  if (to <= from) return 0;
  let n = 0;
  const d = new Date(from);
  while (d < to) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return n;
}

/** Data local de hoje em ISO (YYYY-MM-DD) */
export const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
