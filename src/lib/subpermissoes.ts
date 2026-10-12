/**
 * Permissões "filhas": cada permissão do clube se divide em ações que podem ser ligadas e desligadas
 * uma a uma (ex.: Gerenciar membros → cadastrar, editar, inativar, excluir...). A chave de uma ação é
 * `<permissão>.<ação>` e vale por si só: quem não tem `gerenciar_membros.excluir` não exclui, mesmo
 * tendo as outras ações do grupo.
 *
 * Armazenamento (tabela perfil_permissoes): uma linha por ação marcada, a linha do grupo (marcada
 * quando há ao menos uma ação) e a linha-marca `<permissão>#sub`, que diz "este grupo foi detalhado".
 * Perfil com o grupo marcado e SEM a marca (configuração antiga) continua com todas as ações.
 */
export interface SubPermissao {
  chave: string;
  rotulo: string;
  descricao: string;
  /** true = o banco também exige esta ação (RLS); false = vale só na interface do app. */
  noBanco?: boolean;
}

export const SUBPERMISSOES: Record<string, SubPermissao[]> = {
  admin_clube: [
    { chave: 'modelos', rotulo: 'Modelos do clube', descricao: 'Editar os modelos (cargos, itens, regras) do clube.' },
    { chave: 'formativos', rotulo: 'Planos formativos', descricao: 'Criar e editar planos formativos.' },
    { chave: 'pre_cadastros', rotulo: 'Pré-cadastros', descricao: 'Analisar e aprovar pré-cadastros.' },
    { chave: 'lgpd', rotulo: 'LGPD', descricao: 'Tela de privacidade e consentimentos.' },
    { chave: 'auditoria', rotulo: 'Auditoria', descricao: 'Ver o histórico de alterações do clube.' },
  ],
  gerenciar_acessos: [
    { chave: 'logins', rotulo: 'Criar e redefinir logins', descricao: 'Criar o acesso de um membro e redefinir senha.' },
    { chave: 'vincular', rotulo: 'Vincular usuários', descricao: 'Vincular usuários a perfis e membros.' },
    { chave: 'mfa', rotulo: 'Redefinir verificação em duas etapas', descricao: 'Zerar o MFA de um usuário.' },
    { chave: 'menus', rotulo: 'Menus públicos', descricao: 'Escolher o que cada perfil vê nos menus.' },
  ],
  gerenciar_membros: [
    { chave: 'cadastrar', rotulo: 'Cadastrar membros', descricao: 'Criar novos membros.', noBanco: true },
    { chave: 'editar', rotulo: 'Editar fichas', descricao: 'Alterar os dados, unidade e cargo de um membro.' },
    { chave: 'inativar', rotulo: 'Inativar e reativar', descricao: 'Tirar o membro das listas sem apagar o histórico.', noBanco: true },
    { chave: 'excluir', rotulo: 'Excluir membros', descricao: 'Apagar o membro e todos os seus dados.', noBanco: true },
    { chave: 'importar', rotulo: 'Importar planilha de membros', descricao: 'Cadastrar membros em lote por planilha.' },
    { chave: 'marcar_especialidades', rotulo: 'Marcar especialidades e classes', descricao: 'Registrar especialidades e classes de qualquer membro.' },
  ],
  gerenciar_documentos: [
    { chave: 'anexar', rotulo: 'Anexar documentos', descricao: 'Enviar arquivos para a ficha de qualquer membro.' },
    { chave: 'validar', rotulo: 'Validar documentos', descricao: 'Marcar documentos como conferidos.' },
    { chave: 'excluir', rotulo: 'Excluir documentos', descricao: 'Remover documentos anexados.' },
  ],
  gerenciar_pontuacao: [
    { chave: 'lancar', rotulo: 'Lançar pontuação', descricao: 'Lançar a pontuação das reuniões.' },
    { chave: 'extras', rotulo: 'Pontos extras', descricao: 'Dar e retirar pontos extras.' },
    { chave: 'extratos', rotulo: 'Editar extratos', descricao: 'Corrigir lançamentos nos extratos de membros e unidades.' },
  ],
  gerenciar_unidades: [
    { chave: 'criar', rotulo: 'Criar unidades', descricao: 'Criar novas unidades.' },
    { chave: 'editar', rotulo: 'Editar unidades', descricao: 'Alterar nome, cor e integrantes das unidades.' },
    { chave: 'excluir', rotulo: 'Excluir unidades', descricao: 'Apagar unidades.' },
  ],
  gerenciar_agenda: [
    { chave: 'criar', rotulo: 'Criar eventos', descricao: 'Adicionar eventos ao calendário.' },
    { chave: 'editar', rotulo: 'Editar eventos', descricao: 'Alterar eventos existentes.' },
    { chave: 'excluir', rotulo: 'Excluir eventos', descricao: 'Apagar eventos do calendário.' },
  ],
  gerenciar_atividades: [
    { chave: 'criar', rotulo: 'Criar atividades', descricao: 'Criar e editar atividades.' },
    { chave: 'acompanhar', rotulo: 'Acompanhar e avaliar', descricao: 'Ver entregas e avaliar as atividades.' },
    { chave: 'excluir', rotulo: 'Excluir atividades', descricao: 'Apagar atividades.' },
    { chave: 'enviar_requisitos', rotulo: 'Enviar requisitos em lote', descricao: 'Enviar requisitos de classes para os membros.' },
  ],
  enviar_mensagens: [
    { chave: 'enviar', rotulo: 'Enviar avisos', descricao: 'Escrever e enviar avisos e notificações.' },
    { chave: 'excluir', rotulo: 'Excluir avisos', descricao: 'Apagar avisos enviados.' },
  ],
  validar_classes: [
    { chave: 'classes', rotulo: 'Classes', descricao: 'Acompanhar e aprovar classes de todos os membros.' },
    { chave: 'especialidades', rotulo: 'Especialidades', descricao: 'Acompanhar e validar especialidades de todos os membros.' },
  ],
};

export const chaveSub = (grupo: string, sub: string) => `${grupo}.${sub}`;
export const marcaSub = (grupo: string) => `${grupo}#sub`;
export const ehMarcaSub = (chave: string) => chave.endsWith('#sub');

/** Todas as chaves de ação (`grupo.acao`). */
export const TODAS_AS_SUBS: string[] = Object.entries(SUBPERMISSOES).flatMap(([g, subs]) => subs.map((s) => chaveSub(g, s.chave)));

/**
 * Transforma as linhas guardadas de um perfil na lista efetiva de permissões:
 *  - grupo detalhado (com a marca): vale só o que está marcado; o grupo fica ativo se houver ao menos uma ação;
 *  - grupo sem a marca (padrão de fábrica ou configuração antiga): todas as ações do grupo.
 */
export function expandirPermissoes(base: readonly string[]): string[] {
  const saida = new Set<string>(base.filter((p) => !ehMarcaSub(p)));
  for (const [grupo, subs] of Object.entries(SUBPERMISSOES)) {
    if (base.includes(marcaSub(grupo))) {
      const algumaMarcada = subs.some((s) => saida.has(chaveSub(grupo, s.chave)));
      if (algumaMarcada) saida.add(grupo); else saida.delete(grupo);
    } else if (saida.has(grupo)) {
      for (const s of subs) saida.add(chaveSub(grupo, s.chave));
    }
  }
  return Array.from(saida);
}

/** Lista efetiva (com ações) -> linhas a gravar: ações marcadas, grupos ativos e a marca de cada grupo detalhado. */
export function linhasParaGravar(efetivas: readonly string[]): string[] {
  const saida = new Set<string>(efetivas.filter((p) => !ehMarcaSub(p)));
  for (const [grupo, subs] of Object.entries(SUBPERMISSOES)) {
    saida.add(marcaSub(grupo));
    const algumaMarcada = subs.some((s) => saida.has(chaveSub(grupo, s.chave)));
    if (algumaMarcada) saida.add(grupo); else saida.delete(grupo);
  }
  return Array.from(saida);
}
