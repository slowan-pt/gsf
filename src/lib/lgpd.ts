import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { Usuario } from '../types';

export interface TermoLgpd {
  id: number;
  titulo: string;
  conteudo: string;
  versao: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export const TERMO_LGPD_TITULO_PADRAO = 'Termo de consentimento LGPD e responsabilidade';

export const TERMO_LGPD_PADRAO = `TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS E COMPROMISSO DE RESPONSABILIDADE

Ao acessar o DBV+, declaro que li e compreendi este termo e autorizo o tratamento dos dados pessoais necessários para a gestão de clubes de Desbravadores.

1. Finalidades do sistema

Os dados serão utilizados para cadastro e atualização de membros, responsáveis e diretoria; organização por clubes, unidades e funções; controle de documentos; agenda; presença; pontuação e ranking; atividades; classes; especialidades; relatórios; mensagens; notificações; auditoria; controle de acesso; segurança e demais rotinas administrativas, educacionais, pastorais e operacionais do clube.

2. Dados que podem ser tratados

O sistema poderá tratar dados como nome, e-mail, telefone, data de nascimento, sexo, foto de perfil, unidade, cargo, função adicional, tipo de acesso, informações de responsáveis, vínculo entre pais/responsáveis e filhos, histórico de pontuação, rankings, agenda, atividades, respostas enviadas, anexos, classes, especialidades, termos aceitos, logs de auditoria e registros de acesso.

Quando necessário para a rotina do clube, também poderão ser tratados documentos e imagens anexadas, como RG, CPF, autorizações, fichas, comprovantes, informações médicas ou outros documentos solicitados pela secretaria do clube.

3. Dados de crianças e adolescentes

Estou ciente de que o sistema pode conter dados de crianças e adolescentes vinculados ao clube. Esses dados devem ser utilizados somente para as finalidades legítimas do clube e com atenção especial à proteção, confidencialidade e segurança.

4. Acesso aos dados

O acesso às informações é controlado por perfil e vínculo com o clube. Administradores autorizados, secretaria e perfis liberados poderão acessar os dados necessários às suas funções. Conselheiros e demais usuários terão acesso limitado conforme suas permissões. Arquivos e imagens de documentos não devem ser visualizados por quem não possuir permissão específica.

5. Responsabilidade do usuário

Comprometo-me a manter sigilo sobre as informações acessadas, não compartilhar documentos, imagens, relatórios, dados pessoais ou credenciais com pessoas não autorizadas, não utilizar os dados para finalidades particulares ou externas ao clube e comunicar imediatamente qualquer suspeita de acesso indevido.

Declaro que minhas credenciais de acesso, senha e códigos de autenticação em dois fatores são pessoais e intransferíveis. As ações realizadas com meu usuário poderão ser registradas para fins de segurança, auditoria e responsabilização.

6. Segurança, armazenamento e retenção

Os dados serão armazenados em ambiente digital com controles de acesso, autenticação, permissões por perfil, registros de auditoria e regras de segurança para anexos e documentos. Os dados poderão ser mantidos enquanto forem necessários para participação no clube, obrigações administrativas, histórico institucional, prestação de contas, segurança e cumprimento de obrigações legais ou regulatórias.

7. Direitos do titular

O titular dos dados ou seu responsável legal poderá solicitar à administração do clube informações sobre seus dados, correção, atualização, revisão de permissões, revogação de consentimento ou exclusão quando aplicável, observadas as necessidades administrativas, legais e de segurança do clube.

8. Consentimento

Ao marcar o aceite, confirmo que li, compreendi e concordo com este termo, autorizando o tratamento dos dados pessoais para as finalidades descritas e assumindo o compromisso de responsabilidade pelo uso correto das informações acessadas no sistema.`;

export const TERMO_LGPD_FALLBACK: TermoLgpd = {
  id: 0,
  titulo: TERMO_LGPD_TITULO_PADRAO,
  conteudo: TERMO_LGPD_PADRAO,
  versao: 1,
  ativo: true,
};

export async function buscarTermoAtivo(): Promise<TermoLgpd | null> {
  const { data, error } = await supabase
    .from('lgpd_termos')
    .select('*')
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as TermoLgpd | null) ?? TERMO_LGPD_FALLBACK;
}

export async function usuarioAceitouTermo(usuarioId: string, termoId?: number | null): Promise<boolean> {
  if (!termoId) return false;
  const { data, error } = await supabase
    .from('lgpd_aceites')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('termo_id', termoId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function usuarioPrecisaAceitarTermo(usuarioId: string): Promise<boolean> {
  const termo = await buscarTermoAtivo();
  if (!termo?.id) return true;
  return !(await usuarioAceitouTermo(usuarioId, termo.id));
}

export async function registrarAceiteLgpd(usuario: Usuario, termo: TermoLgpd): Promise<void> {
  const userAgent =
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.userAgent
      : Platform.OS;

  const { error } = await supabase
    .from('lgpd_aceites')
    .upsert(
      {
        termo_id: termo.id,
        usuario_id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        user_agent: userAgent,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: 'termo_id,usuario_id' },
    );

  if (error) throw error;
}
