# Porto Florêncio CRM — Design

CRM comercial interno da incorporadora Porto Florêncio. Web (desktop-first, responsivo). Visual clean no estilo Linear/Notion: superfícies claras, hairlines finas, tipografia firme, verde da marca usado só como destaque. Função: gerentes comerciais acompanham imobiliárias parceiras, registram atividades, conduzem o pipeline de oportunidades e batem metas.

## Brand & Colors

| Token | Valor | Uso |
|-------|-------|-----|
| brand | #5FAE3A | Botão primário, foco, barras principais, indicadores positivos |
| brand-soft | #EEF6E8 | Fundos de chips/realce |
| forest | #1F3A2E | Texto de destaque, segunda série de gráfico, sidebar ativa |
| background | #F7F7F4 | Fundo do app (off-white quente) |
| card | #FFFFFF | Painéis |
| foreground | #17201B | Texto principal |
| muted-foreground | #6B726D | Texto secundário |
| border | #E7E7E1 | Hairlines |
| amber | #C98A1B | Atenção (30–59 dias, morno) |
| red | #C8473F | Crítico (60+ dias, frio, declinou) |

## Typography

- Display / títulos / números: **Poppins** 500–600, tracking levemente negativo.
- Corpo / UI: **DM Sans** 400–500, 13–14px na UI densa.
- Números sempre `tabular-nums`.

## Layout

- Sidebar fixa 240px (logo + navegação agrupada + usuário), conteúdo com max-width 1440px, header de página com título, subtítulo e ações à direita.
- Painéis: borda 1px, raio 10px, sem sombra (no máximo sombra sutil em hover/drag).
- KPIs em faixa contínua (grid com divisórias) em vez de cards soltos.
- Status como pontos coloridos + texto, nunca blocos saturados.

## Pages

Login · Consolidado · Pipeline (kanban oportunidades) · Carteira (kanban imobiliárias) · Ficha da imobiliária · Agenda · Registro rápido · Gestor comercial · Empreendimentos/Estoque · Relatórios · Configurações.

## Motion

Fade + slide de 6px em entrada de página, stagger leve nos KPIs. Drag & drop com elevação sutil.
