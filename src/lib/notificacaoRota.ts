/** Tela de destino de cada assunto de notificação (campo `tela` do push). */
const ROTAS: Record<string, string> = {
  calendario: '/(tabs)/calendario',
  agenda: '/(tabs)/calendario',
  ranking: '/(tabs)/ranking',
  pontuacao: '/(tabs)/pontuacao',
  extras: '/(tabs)/pontuacao?aba=extras',
  mensagens: '/mensagens',
  atividades: '/(tabs)/atividades',
  aprovacoes: '/admin/aprovacoes',
  classes: '/classes',
  anoBiblico: '/ano-biblico',
};

/** Rota a abrir para uma notificação, ou null se ela não indica nenhuma tela. */
export function rotaDaNotificacao(dados?: Record<string, unknown> | null): string | null {
  const tela = typeof dados?.tela === 'string' ? dados.tela : '';
  if (tela === 'rota') return typeof dados?.rota === 'string' && dados.rota.startsWith('/') ? dados.rota : null;
  return ROTAS[tela] ?? null;
}
