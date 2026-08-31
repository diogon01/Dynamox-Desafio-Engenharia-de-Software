/**
 * Destinos do menu lateral, em um lugar só.
 *
 * O sidenav lista DESTINOS DE PRIMEIRO NÍVEL — nunca rotas contextuais. "Nova máquina",
 * "editar", "aquisição" e "detalhe do alerta" são alcançados de dentro da página e voltam
 * pela trilha (breadcrumb); colocá-los aqui transformaria o menu num mapa do site.
 *
 * Os grupos separam as duas perguntas que a aplicação responde: **o que está acontecendo
 * agora** (monitoramento) e **o que existe na planta** (cadastro). A página da máquina é
 * canônica e junta operação e cadastro — por isso ela aparece UMA vez, no cadastro, com a
 * descrição dizendo que também abre a operação do ativo.
 */
export interface NavItem {
  /** Rota canônica do destino. */
  to: string;
  label: string;
  /** Segunda linha: para que serve o destino, não o que ele é. */
  description: string;
  /**
   * Prefixos extras que mantêm este item ativo. É aqui que a árvore de investigação se
   * declara: `/sensors/:serial` e `/acquisitions/:id` descem de uma máquina (a trilha do
   * breadcrumb começa nela), então quem está lá continua vendo "Máquinas" como o ramo ativo.
   */
  match?: string[];
}

export interface NavGroup {
  /** Rótulo discreto da seção; identifica o grupo para leitores de tela. */
  label: string;
  id: string;
  items: NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'monitoramento',
    label: 'Monitoramento',
    items: [
      {
        to: '/',
        label: 'Visão geral',
        description: 'Condição, prioridade e tendência',
        // A janela horária nasce do mapa de calor do painel e volta para ele.
        match: ['/monitoring/windows'],
      },
      {
        to: '/alerts',
        label: 'Alertas',
        description: 'Episódios A1/A2 abertos pelo motor',
      },
    ],
  },
  {
    id: 'cadastro',
    label: 'Cadastro',
    items: [
      {
        to: '/machines',
        label: 'Máquinas',
        description: 'Ativos, pontos e operação de cada um',
        match: ['/sensors', '/acquisitions', '/assets'],
      },
      {
        to: '/monitoring-points',
        label: 'Pontos e sensores',
        description: 'Registro de toda a planta, com busca',
      },
    ],
  },
];

/**
 * O item está no caminho atual? A raiz casa exatamente (senão ficaria ativa em tudo); os
 * demais casam com o próprio caminho e com seus descendentes, porque `/machines/P-101/edit`
 * ainda é "Máquinas".
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return [item.to, ...(item.match ?? [])].some((path) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** O grupo que contém o caminho atual — usado para destacar a seção junto com o item. */
export function activeNavGroup(pathname: string): NavGroup | null {
  return NAV_GROUPS.find((group) => group.items.some((item) => isNavItemActive(item, pathname))) ?? null;
}
