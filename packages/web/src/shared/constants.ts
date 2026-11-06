// Constantes de domínio compartilhadas entre API e web.

/** Etapas da carteira = os 8 indicadores de performance comercial */
export const AGENCY_STAGES = [
  "Captação",
  "Visita à imobiliária",
  "Atendimento a corretores",
  "Treinamento",
  "Visita à obra",
  "Atendimento a clientes",
  "Proposta",
  "Venda",
] as const;
export type AgencyStage = (typeof AGENCY_STAGES)[number];

export const OPP_STAGES = [
  "Em negociação",
  "Proposta",
  "Aguardando assinatura",
  "Venda",
  "Declinou",
] as const;

export const TEMPERATURES = ["Quente", "Morno", "Frio"] as const;

export const ACTIVITY_TYPES = [
  "Captação imobiliária",
  "Visita à imobiliária",
  "Atendimento a corretor",
  "Treinamento",
  "Visita à obra",
  "Atendimento ao cliente",
] as const;

export const ACTIVITY_STATUS = ["Planejada", "Concluída", "Cancelada"] as const;
export const CHANNELS = ["WhatsApp", "Telefone", "Presencial", "Videochamada", "E-mail"] as const;

/** Os oito indicadores comerciais acompanhados com meta */
export const METRICS = [
  "Captações",
  "Visitas a imobiliárias",
  "Atendimentos a corretores",
  "Treinamentos",
  "Visitas à obra (pessoas)",
  "Atendimentos a clientes",
  "Propostas",
  "Vendas",
] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_BY_ACTIVITY: Record<string, Metric> = {
  "Captação imobiliária": "Captações",
  "Visita à imobiliária": "Visitas a imobiliárias",
  "Atendimento a corretor": "Atendimentos a corretores",
  Treinamento: "Treinamentos",
  "Visita à obra": "Visitas à obra (pessoas)",
  "Atendimento ao cliente": "Atendimentos a clientes",
};

/** Atividade registrada ao avançar a imobiliária para cada etapa (Proposta/Venda geram oportunidade) */
export const ACTIVITY_BY_STAGE: Partial<Record<AgencyStage, (typeof ACTIVITY_TYPES)[number]>> = {
  Captação: "Captação imobiliária",
  "Visita à imobiliária": "Visita à imobiliária",
  "Atendimento a corretores": "Atendimento a corretor",
  Treinamento: "Treinamento",
  "Visita à obra": "Visita à obra",
  "Atendimento a clientes": "Atendimento ao cliente",
};
export const METRIC_BY_STAGE: Record<AgencyStage, Metric> = {
  Captação: "Captações",
  "Visita à imobiliária": "Visitas a imobiliárias",
  "Atendimento a corretores": "Atendimentos a corretores",
  Treinamento: "Treinamentos",
  "Visita à obra": "Visitas à obra (pessoas)",
  "Atendimento a clientes": "Atendimentos a clientes",
  Proposta: "Propostas",
  Venda: "Vendas",
};

/** Tipos cujo indicador soma participantes em vez de contar registros */
export const COUNTS_PARTICIPANTS = new Set(["Visita à obra"]);
