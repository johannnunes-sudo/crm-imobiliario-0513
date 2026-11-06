import type { Tone } from "../components/ui/kit";

export const oppStageTone: Record<string, Tone> = {
  "Em negociação": "neutral",
  Proposta: "amber",
  "Aguardando assinatura": "forest",
  Venda: "brand",
  Declinou: "danger",
};
export const oppStageColor: Record<string, string> = {
  "Em negociação": "#9aa09b",
  Proposta: "#C98A1B",
  "Aguardando assinatura": "#1F3A2E",
  Venda: "#5FAE3A",
  Declinou: "#C8473F",
};
export const tempTone: Record<string, Tone> = { Quente: "brand", Morno: "amber", Frio: "danger" };
export const agencyStageColor: Record<string, string> = {
  Captação: "#D9DDD5",
  "Visita à imobiliária": "#C7DDB5",
  "Atendimento a corretores": "#A9D18E",
  Treinamento: "#86C064",
  "Visita à obra": "#5FAE3A",
  "Atendimento a clientes": "#3F8A2C",
  Proposta: "#C98A1B",
  Venda: "#1F3A2E",
};
export const healthTone = { ok: "brand", warn: "amber", critical: "danger" } as const;
