import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { consultarPushAtividade } from '../lib/notificacoesAtividade';
import { useCores } from '../stores/temaStore';
import { Chip } from './ui';

export function StatusPushAtividade({ clubeId, atividadeId }: { clubeId: number; atividadeId: number }) {
  const cores = useCores();
  const [registro, setRegistro] = useState<Awaited<ReturnType<typeof consultarPushAtividade>>>();
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void consultarPushAtividade(clubeId, atividadeId, false).then((dados) => {
      if (ativo) setRegistro(dados);
    }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [atividadeId, clubeId]);

  async function verificar() {
    if (consultando) return;
    setConsultando(true);
    setErro(false);
    try { setRegistro(await consultarPushAtividade(clubeId, atividadeId, true)); }
    catch { setErro(true); }
    finally { setConsultando(false); }
  }

  if (!registro && !erro) return null;
  const resultados = registro ? Object.values(registro.recibos) : [];
  const confirmados = resultados.filter((r) => r === 'confirmado_provedor').length;
  const expirados = resultados.filter((r) => r === 'expirado').length;
  const recusados = resultados.length - confirmados - expirados;
  const pendentes = (registro?.tickets.length ?? 0) - resultados.length;
  return (
    <View style={{ gap: 6, marginTop: 12 }}>
      <Text style={{ color: cores.texto, fontWeight: '800' }}>Último envio de notificações push</Text>
      {registro && <Text style={{ color: cores.textoSecundario }}>
        {registro.consulta_com_erro ? 'Falha ao consultar aparelhos.'
          : `${registro.membros} destinatário(s) · ${registro.sem_aparelho} sem aparelho registrado · ${confirmados} confirmação(ões) do provedor · ${pendentes} aguardando recibo · ${registro.falhas + recusados} falha(s) · ${expirados} sem confirmação no prazo`}
      </Text>}
      {erro && <Text style={{ color: cores.textoSecundario }}>Não foi possível consultar as notificações agora.</Text>}
      {(pendentes > 0 || erro) && <Chip rotulo={consultando ? 'Consultando…' : 'Consultar recibos'} onPress={() => { void verificar(); }} />}
    </View>
  );
}
