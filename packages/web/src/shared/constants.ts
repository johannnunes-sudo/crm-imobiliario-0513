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
  "Envio de material / Follow-up",
  "Ação de vendas / Evento",
] as const;

/** Atalhos de "próximo passo" oferecidos ao concluir uma atividade (dias = prazo sugerido) */
export const NEXT_STEPS = [
  { label: "Enviar material", type: "Envio de material / Follow-up", days: 1 },
  { label: "Agendar treinamento", type: "Treinamento", days: 7 },
  { label: "Nova visita", type: "Visita à imobiliária", days: 15 },
  { label: "Levar corretores à obra", type: "Visita à obra", days: 10 },
  { label: "Retornar contato", type: "Atendimento a corretor", days: 3 },
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

/** Perfis de acesso */
export const ROLES = ["admin", "gerente", "aprovador", "pendente"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  gerente: "Gerente de relacionamento",
  aprovador: "Aprovação de vendas",
  pendente: "Aguardando liberação",
};
export const ROLE_HINT: Record<Role, string> = {
  admin: "Vê e edita tudo, gerencia usuários e metas",
  gerente: "Vê e edita só a própria carteira, agenda e negociações",
  aprovador: "Vê todos os dados e atualiza negociações (aprovação de vendas)",
  pendente: "Sem acesso aos dados até um administrador liberar",
};

/** Motivos de não compra — obrigatório ao declinar uma negociação */
export const DECLINE_REASONS = [
  "Preço acima do orçamento",
  "Condição de pagamento / fluxo",
  "Crédito ou financiamento não aprovado",
  "Comprou com concorrente",
  "Localização",
  "Planta, tipologia ou metragem",
  "Prazo de entrega",
  "Desistiu ou adiou a compra",
  "Cliente sem retorno",
  "Outro",
] as const;

/** Corretor obrigatório: atividades e etapas de negociação que exigem o nome do corretor */
export const BROKER_REQUIRED_ACTIVITY = new Set(["Atendimento ao cliente"]);
export const BROKER_REQUIRED_OPP_STAGES = new Set(["Proposta", "Aguardando assinatura", "Venda"]);

/** Perfil comercial da imobiliária */
export const AGENCY_FOCUS = ["Lançamento", "Estoque / pronto", "Ambos"] as const;
/** Padrões de produto que a imobiliária trabalha (sugestões; aceita outros) */
export const PRODUCT_STANDARDS = ["Frente mar", "Quadra mar", "Meia Praia", "Morretes", "Centro de Itapema", "Perequê", "Porto Belo centro", "Bombinhas"] as const;
/** Cidades onde a imobiliária foca a venda (sugestões; aceita outras) */
export const FOCUS_CITIES = ["Itapema", "Porto Belo", "Bombinhas", "Balneário Camboriú", "Camboriú", "Tijucas", "Itajaí"] as const;

/** Motivos de saída da carteira (solicitação da gerente ou inativação pelo ADM) */
export const EXIT_REASONS = [
  "Fechou / encerrou atividades",
  "Não trabalha com o perfil dos produtos",
  "Sem corretores ativos",
  "Conflito comercial",
  "Incorporada por outra imobiliária",
  "Relacionamento não evoluiu",
  "Outro",
] as const;
