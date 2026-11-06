import { useId, useMemo } from "react";
import { useCrmData } from "../queries/crm";
import { brokerList } from "../lib/brokers";
import { Input } from "./ui/kit";

/** Campo de corretor com sugestão dos nomes já usados (primeiro os da imobiliária escolhida) */
export function BrokerInput({ value, onChange, agencyId, placeholder = "Nome do corretor", className }: { value: string; onChange: (v: string) => void; agencyId?: number | null; placeholder?: string; className?: string }) {
  const id = useId();
  const { opportunities, activities } = useCrmData();
  const names = useMemo(() => {
    const own = agencyId ? brokerList(opportunities, activities, agencyId).map((b) => b.name) : [];
    const all = brokerList(opportunities, activities).map((b) => b.name);
    return [...new Set([...own, ...all])].slice(0, 80);
  }, [opportunities, activities, agencyId]);
  return (
    <>
      <Input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} autoComplete="off" />
      <datalist id={id}>{names.map((n) => <option key={n} value={n} />)}</datalist>
    </>
  );
}
