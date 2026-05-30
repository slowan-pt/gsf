import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { BottomNav } from '../../src/components/BottomNav';

/* ─── Tipos ─────────────────────────────────────────────────────── */
type TipoCampo = 'pergunta' | 'pesquisa' | 'conselheiro' | 'reflexao' | 'ficha';

interface Campo {
  id: string;
  tipo: TipoCampo;
  label: string;
  ref?: string;
  placeholder?: string;
  minHeight?: number;
}

interface Episodio {
  num: number;
  titulo: string;
  cidade: string;
  cor: string;
  destaque: string;
  campos: Campo[];
  mensagem?: string;
  proxima?: string;
}

/* ─── Dados dos 14 episódios ─────────────────────────────────────── */
const EPISODIOS: Episodio[] = [
  {
    num: 1, titulo: 'CONHECENDO O MAPA', cidade: '📍 Cisjordânia / Mar Morto', cor: '#2e7d4f',
    destaque: 'A Bíblia é o nosso mapa. Em 1947, no Wadi Qumran, próximo ao Mar Morto, foram encontrados manuscritos datados entre o séc. II a.C. e 70 d.C. Os mais importantes eram textos da própria Bíblia.',
    campos: [
      { id: 'ep1_q1', tipo: 'pergunta', label: 'Qual a utilidade da Bíblia para nós?', ref: '2 Timóteo 3:16-17', placeholder: 'Escreva sua resposta aqui...' },
      { id: 'ep1_q2', tipo: 'pergunta', label: 'Como e por quem a Bíblia foi escrita?', ref: '2 Pedro 1:21', placeholder: 'Escreva sua resposta aqui...' },
      { id: 'ep1_q3', tipo: 'pergunta', label: 'Quanto tempo vai durar a Bíblia?', ref: 'Isaías 40:8', placeholder: 'Escreva sua resposta aqui...' },
      { id: 'ep1_q4', tipo: 'pergunta', label: 'Qual o maior tesouro que encontramos na Bíblia?', ref: 'João 5:39', placeholder: 'Escreva sua resposta aqui...' },
      { id: 'ep1_p1', tipo: 'pesquisa', label: 'Existe diferença entre rochas e minerais? Quais são? Pesquise e apresente ao seu capelão na próxima reunião.', placeholder: 'Anote aqui o resultado da sua pesquisa...' },
      { id: 'ep1_p2', tipo: 'pesquisa', label: 'Existem as rochas ígneas, sedimentares e metamórficas. Pesquise e apresente dois exemplos de cada grupo.', placeholder: 'Ígneas: ...\nSedimentares: ...\nMetamórficas: ...' },
    ],
    proxima: 'Uma cidade cujo nome vem de "urusalim", palavra semítica que significa "Base de Deus". Uma cidade histórica muito conhecida!',
  },
  {
    num: 2, titulo: 'A PEDRA DAS 3 CORES', cidade: '📍 Jerusalém', cor: '#1a6fa8',
    destaque: 'Jerusalém significa "cidade de Deus". Uma de suas curiosas leis municipais diz que as estruturas da cidade precisam ser cobertas com pedra, preservando assim seu aspecto histórico.',
    campos: [
      { id: 'ep2_q1', tipo: 'pergunta', label: 'Quantos deuses existem verdadeiramente?', ref: 'Efésios 4:6' },
      { id: 'ep2_q2', tipo: 'pergunta', label: 'Qual é a natureza de Deus e como devemos procurar compreendê-lo?', ref: 'João 4:24' },
      { id: 'ep2_q3', tipo: 'pergunta', label: 'Será que Ele se preocupa com nossos problemas e nos escuta?', ref: 'Salmo 40:1-3' },
      { id: 'ep2_q4', tipo: 'pergunta', label: 'O que esses textos revelam sobre Deus?', ref: '1 João 5:7-8; Mateus 28:19', placeholder: 'Escreva sobre a Trindade...' },
      { id: 'ep2_p1', tipo: 'pesquisa', label: 'Qual o significado da Escala de Mohs para determinar a dureza? Pesquise e apresente os minerais de acordo com a Escala de Mohs.', placeholder: 'Anote aqui o resultado da sua pesquisa sobre a Escala de Mohs...' },
    ],
    mensagem: '❤️ Devemos amar a Deus mais do que qualquer outra coisa neste mundo.',
    proxima: 'Uma cidade cujo nome significa "bela, adorável". Foi dedicada à deusa suméria Ishtar, deusa da fertilidade.',
  },
  {
    num: 3, titulo: 'A PEDRA PERDIDA', cidade: '📍 Nínive (atual Mossul, Iraque)', cor: '#7a2d2d',
    destaque: 'Nínive, citada em Gênesis 10:11-12, atualmente chamada de Mossul, era conhecida pelas crueldades com os povos vencidos. Por isso ficou conhecida como "A Cidade de Sangue".',
    campos: [
      { id: 'ep3_q1', tipo: 'pergunta', label: 'Quem foi o primeiro ser a pecar?', ref: 'Ezequiel 28:14-17' },
      { id: 'ep3_q2', tipo: 'pergunta', label: 'Em que circunstância ocorreu o primeiro pecado na terra?', ref: 'Gênesis 3:4-6' },
      { id: 'ep3_q3', tipo: 'pergunta', label: 'Em que momento da vida nos tornamos pecadores?', ref: 'Salmo 51:5' },
      { id: 'ep3_q4', tipo: 'pergunta', label: 'Qual é a consequência final do pecado e como podemos vencê-lo?', ref: 'Romanos 6:23; 8:37' },
      { id: 'ep3_p1', tipo: 'pesquisa', label: 'Pesquise a definição e significado de clivagem e gravidade específica em mineralogia.', placeholder: 'Clivagem: ...\nGravidade específica: ...' },
    ],
    mensagem: '🙏 Faça uma oração a Jesus todos os dias pedindo forças para não pecar.',
    proxima: 'Uma cidade na região montanhosa do Oriente Médio, constituída pelo antigo reino de Israel, situado em torno de sua antiga capital.',
  },
  {
    num: 4, titulo: 'A PEDRA DA ALEGRIA', cidade: '📍 Samaria', cor: '#c0392b',
    destaque: 'Samaria era o nome do distrito romano que ficava entre a Galileia (ao norte) e a Judeia (ao sul). Nos dias de Jesus, era uma região com grande importância histórica e religiosa.',
    campos: [
      { id: 'ep4_q1', tipo: 'pergunta', label: 'Qual a maior promessa que Jesus fez aos seus discípulos?', ref: 'João 14:1-3' },
      { id: 'ep4_q2', tipo: 'pergunta', label: 'Existe uma data marcada para a volta de Jesus? Justifique.', ref: 'Mateus 24:36' },
      { id: 'ep4_q3', tipo: 'pergunta', label: 'De que modo Jesus voltará à terra?', ref: 'Mateus 24:30' },
      { id: 'ep4_q4', tipo: 'pergunta', label: 'Quantos poderão vê-Lo e o que acontecerá com os que creram?', ref: 'Apocalipse 1:7; 1 Tessalonicenses 4:16-17' },
      { id: 'ep4_p1', tipo: 'pesquisa', label: 'Defina o que é: lustro, cor do traço, textura e cristal em mineralogia.', placeholder: 'Lustro: ...\nCor do traço: ...\nTextura: ...\nCristal: ...' },
    ],
    mensagem: '✨ MARANATA significa "O Senhor logo vem". Jesus voltará em breve!',
    proxima: 'Na região do Mar da Galileia — local de ministério de Jesus. Acredita-se que a antiga cidade judaica próxima a Tagba tenha sediado uma das sinagogas onde Jesus ensinava.',
  },
  {
    num: 5, titulo: 'A PEDRA DA ESPERANÇA', cidade: '📍 Cafarnaum', cor: '#8e44ad',
    destaque: 'Cafarnaum provavelmente significa "aldeia de Naum". Como Naum significa "compassivo", Cafarnaum também pode significar "vila de compaixão". Era citada especialmente em conexão com o ministério de Jesus.',
    campos: [
      { id: 'ep5_q1', tipo: 'pergunta', label: 'Que elementos compõem a vida humana?', ref: 'Gênesis 2:7' },
      { id: 'ep5_q2', tipo: 'pergunta', label: 'Para onde o ser humano vai quando morre?', ref: 'Gênesis 3:19' },
      { id: 'ep5_q3', tipo: 'pergunta', label: 'Será que é possível conversar com os mortos? Justifique.', ref: 'Eclesiastes 9:5-6' },
      { id: 'ep5_q4', tipo: 'pergunta', label: 'Qual é o plano de Deus para resolver o problema da morte?', ref: 'João 5:28-29' },
      { id: 'ep5_p1', tipo: 'pesquisa', label: 'Descubra e apresente ao seu capelão quatro utilidades das rochas.', placeholder: '1. ...\n2. ...\n3. ...\n4. ...' },
    ],
    mensagem: '💫 "Desbravador não morre, acampa no cemitério." Podemos ter a certeza de que Jesus vai ressuscitar a todos que O aceitarem!',
    proxima: 'Uma cidade que floresceu após 129 a.C. sob controle romano. Foi por muitos anos a segunda maior cidade do Império Romano.',
  },
  {
    num: 6, titulo: 'A PEDRA DO DESCANSO', cidade: '📍 Éfeso', cor: '#16a085',
    destaque: 'Éfeso era famosa pelo Templo de Ártemis (séc. V a.C.), uma das Sete Maravilhas do Mundo Antigo. Era uma das sete congregações citadas em Apocalipse.',
    campos: [
      { id: 'ep6_q1', tipo: 'pergunta', label: 'Ao concluir a criação, o que Deus fez para nos dar o exemplo?', ref: 'Gênesis 2:1-3' },
      { id: 'ep6_q2', tipo: 'pergunta', label: 'O sábado faz parte da lei de Deus? Por que devemos guardar esse dia?', ref: 'Êxodo 20:8-11' },
      { id: 'ep6_q3', tipo: 'pergunta', label: 'Quando começa e termina o sábado, e ele é um sinal entre quem?', ref: 'Levítico 23:32; Ezequiel 20:12' },
      { id: 'ep6_q4', tipo: 'pergunta', label: 'O que a Bíblia ensina sobre a perpetuidade do sábado?', ref: 'Isaías 66:22-23' },
      { id: 'ep6_p1', tipo: 'pesquisa', label: 'Descubra e apresente ao seu capelão quatro utilidades dos minerais.', placeholder: '1. ...\n2. ...\n3. ...\n4. ...' },
      { id: 'ep6_conselheiro', tipo: 'conselheiro', label: 'Converse com seu conselheiro: quais três formas de ajudar pessoas necessitadas no Sábado?', placeholder: '1. ...\n2. ...\n3. ...' },
    ],
    proxima: 'Uma cidade considerada a terceira maior do Império Romano e do mundo antigo, com população estimada em mais de meio milhão de habitantes.',
  },
  {
    num: 7, titulo: 'A PEDRA QUE FALA', cidade: '📍 Antioquia', cor: '#d35400',
    destaque: 'Antioquia cresceu ao ponto de se tornar o principal centro comercial e industrial da província romana da Síria. Era chamada de "Antioquia, a Bela" e "Rainha do Oriente".',
    campos: [
      { id: 'ep7_q1', tipo: 'pergunta', label: 'Qual a principal função de um profeta?', ref: 'Deuteronômio 18:18' },
      { id: 'ep7_q2', tipo: 'pergunta', label: 'Será que todos os profetas são verdadeiros? O que Jesus falou?', ref: 'Mateus 24:24' },
      { id: 'ep7_q3', tipo: 'pergunta', label: 'Cite pelo menos 4 características de um profeta verdadeiro.', ref: '1 João 4:1-2; Mateus 7:15-23; Deuteronômio 18:21-22; Isaías 8:19-20', placeholder: '1. ...\n2. ...\n3. ...\n4. ...' },
      { id: 'ep7_q4', tipo: 'pergunta', label: 'Como Deus apresenta o Dom Profético em Sua Igreja nos últimos dias?', ref: 'Apocalipse 12:17; 19:10' },
      { id: 'ep7_p1', tipo: 'pesquisa', label: 'Conte ao seu capelão ou conselheiro uma história bíblica onde foi mencionada uma pedra e sua importância.', placeholder: 'Anote aqui a história que você vai contar...' },
    ],
    mensagem: '🏆 "É melhor seguir os conselhos dos profetas de Deus para estar seguro e prosperar." — 2 Crônicas 20:20',
    proxima: 'Uma antiga cidade e porto marítimo, construída por Herodes, o Grande, cerca de 25-13 a.C. Já foi a capital civil e militar da Judeia.',
  },
  {
    num: 8, titulo: 'A PEDRA MARCADA', cidade: '📍 Cesareia', cor: '#2471a3',
    destaque: 'Cesareia Palestina é uma antiga cidade e porto marítimo na costa mediterrânica de Israel, construída por Herodes, o Grande. Foi a capital portuária de Israel no período romano.',
    campos: [
      { id: 'ep8_q1', tipo: 'pergunta', label: 'O que significa "igreja" biblicamente?', ref: '1 Timóteo 3:15' },
      { id: 'ep8_q2', tipo: 'pergunta', label: 'Quais as principais características da igreja verdadeira?', ref: 'Apocalipse 14:12' },
      { id: 'ep8_q3', tipo: 'pergunta', label: 'Qual é a missão da igreja?', ref: 'Mateus 28:19-20' },
      { id: 'ep8_q4', tipo: 'pergunta', label: 'Como é biblicamente chamado o povo de Deus fiel dos últimos dias?', ref: 'Apocalipse 12:17' },
      { id: 'ep8_p1', tipo: 'pesquisa', label: 'Escolha uma história bíblica onde uma rocha foi importante. Apresente-a aos membros de sua unidade através de mímica para que eles descubram de qual história se trata!', placeholder: 'Anote aqui a história que você escolheu e como vai apresentar...' },
    ],
    mensagem: '⛪ Agora que você aprendeu sobre a Igreja Verdadeira, lembre-se de ir à Igreja todos os sábados e em outros dias de culto também.',
    proxima: 'Iremos ao Egito! Lá descobriremos uma importante cidade que é a maior do mundo árabe e da África.',
  },
  {
    num: 9, titulo: 'A PEDRA DIFERENTE', cidade: '📍 Cairo, Egito', cor: '#b7950b',
    destaque: 'Cairo é a capital do Egito e significa em árabe "conquistador" ou "vencedor". O ponto turístico mais famoso são as Pirâmides de Gizé. A Grande Pirâmide de Quéops usou cerca de 2,5 milhões de blocos de pedra calcária!',
    campos: [
      { id: 'ep9_q1', tipo: 'pergunta', label: 'Todas as nossas escolhas devem agradar primeiramente a quem?', ref: '1 Coríntios 10:31' },
      { id: 'ep9_q2', tipo: 'pergunta', label: 'Que coisas devem ser abandonadas por quem escolhe andar com Deus?', ref: 'Colossenses 3:8' },
      { id: 'ep9_q3', tipo: 'pergunta', label: 'Quanto à maneira como nos vestimos, o que a Bíblia nos aconselha?', ref: 'Romanos 14:16' },
      { id: 'ep9_q4', tipo: 'pergunta', label: 'Que promessa encontramos na Bíblia para quem vencer as tentações até o fim?', ref: 'Apocalipse 3:14-21' },
      { id: 'ep9_p1', tipo: 'pesquisa', label: 'Escolha mais uma história na Bíblia que mencione uma rocha, faça um vídeo contando-a e compartilhe em uma rede social!', placeholder: 'Qual história você escolheu? Em qual rede social você vai compartilhar?' },
    ],
    mensagem: '✨ Seja puro, bondoso e leal para atrair pessoas a Jesus. Seja cortês e obediente; procure ser simples e modesto usando roupas decentes.',
    proxima: 'Uma cidade do sudoeste da Turquia, na Região do Egeu. Uma das mais antigas da bacia do Mediterrâneo e um dos portos mais importantes do mundo.',
  },
  {
    num: 10, titulo: 'A PEDRA DA FIDELIDADE', cidade: '📍 Esmirna', cor: '#117a65',
    destaque: 'Esmirna (do grego Smyrne, que significa "mirra") foi famosa por um estilo próprio de música (Smyrneika) e por sua variedade de produtos exportados para a Europa como passas, figos secos e tapetes.',
    campos: [
      { id: 'ep10_q1', tipo: 'pergunta', label: 'A quem pertencem todas as propriedades e riquezas do mundo?', ref: 'Salmo 24:1' },
      { id: 'ep10_q2', tipo: 'pergunta', label: 'Que pedido fez Deus ao ser humano como ato de adoração a Ele?', ref: 'Levítico 27:30' },
      { id: 'ep10_q3', tipo: 'pergunta', label: 'O que Deus diz sobre quem não devolve dízimo e ofertas?', ref: 'Malaquias 3:8-10' },
      { id: 'ep10_q4', tipo: 'pergunta', label: 'Que promessas o Senhor faz àqueles que são fiéis?', ref: 'Provérbios 3:9-10' },
      { id: 'ep10_p1', tipo: 'pesquisa', label: 'Escolha mais uma história bíblica que mencione uma rocha, faça um desenho onde seja possível identificar de qual episódio se trata e mostre ao seu capelão.', placeholder: 'Qual história você escolheu para desenhar?' },
    ],
    mensagem: '💰 Como "sócios" de Deus ficamos com 90% e entregamos 10% a Ele. E ainda recebemos muitas bênçãos!',
    proxima: 'Faremos escavações nas ruínas de uma cidade chamada de "Castelo Velho". No passado, tornou-se uma das primeiras sedes do cristianismo.',
  },
  {
    num: 11, titulo: 'A PEDRA DA LONGEVIDADE', cidade: '📍 Laodiceia', cor: '#6e2fa0',
    destaque: 'Laodiceia foi chamada assim em homenagem a Laódice, esposa de Antíoco II Teos. Era uma das mais importantes cidades da Ásia Menor e capital da província romana tardia da Frígia Pacaciana.',
    campos: [
      { id: 'ep11_q1', tipo: 'pergunta', label: 'Qual era a alimentação original do homem?', ref: 'Gênesis 1:29' },
      { id: 'ep11_q2', tipo: 'pergunta', label: 'Se alguém come carne, de quais animais é permitido comer?', ref: 'Levítico 11:2-12' },
      { id: 'ep11_q3', tipo: 'pergunta', label: 'Por que Deus se preocupa com nossos hábitos alimentares?', ref: '1 Coríntios 6:19-20' },
      { id: 'ep11_q4', tipo: 'pergunta', label: 'Que orientação importante a Bíblia nos faz quanto às nossas ações?', ref: '1 Coríntios 10:31' },
      { id: 'ep11_p1', tipo: 'pesquisa', label: 'Coleção: Inicie a montagem com pelo menos 8 espécies de rochas/minerais, classificados corretamente (nome, quem encontrou, data e local).', placeholder: 'Espécies coletadas:\n1. ...\n2. ...\n3. ...\n4. ...\n5. ...\n6. ...\n7. ...\n8. ...' },
    ],
    mensagem: '🥗 Nem tudo que é gostoso faz bem para a saúde. Se você seguir a Bíblia e comer o que Deus criou como alimento, você será saudável e viverá muito tempo!',
    proxima: 'Viajaremos a uma das cidades mais antigas do mundo, reconhecida como uma cidade global em finanças, comércio, mídia, entretenimento e turismo.',
  },
  {
    num: 12, titulo: 'A PEDRA MOLHADA', cidade: '📍 Atenas, Grécia', cor: '#1a6fa8',
    destaque: 'Atenas é considerada o berço da civilização ocidental e da democracia. Domina a região da Ática e é uma das cidades mais antigas do mundo.',
    campos: [
      { id: 'ep12_q1', tipo: 'pergunta', label: 'O que significa batismo na Bíblia?', ref: 'Romanos 6:3-4' },
      { id: 'ep12_q2', tipo: 'pergunta', label: 'De que maneira Jesus foi batizado?', ref: 'Marcos 1:9-10' },
      { id: 'ep12_q3', tipo: 'pergunta', label: 'Qual a importância do batismo para a salvação?', ref: 'Marcos 16:16' },
      { id: 'ep12_q4', tipo: 'pergunta', label: 'O que acontece quando uma pessoa é batizada?', ref: 'Romanos 6:4' },
      { id: 'ep12_p1', tipo: 'pesquisa', label: 'Coleção (parte 2): Conclua a montagem com mais 7 espécies de rochas e minerais. No próximo encontro você deverá apresentar a coleção completa!', placeholder: 'Espécies adicionadas:\n5. ...\n6. ...\n7. ...\n8. ...\n9. ...\n10. ...\n11. ...' },
    ],
    mensagem: '💧 O dia do batismo é feliz porque "há alegria no Céu por um pecador que se arrepende"!',
    proxima: 'Viajaremos a uma cidade que é descrita na Bíblia e qualquer pessoa gostaria de ser moradora dela...',
  },
  {
    num: 13, titulo: 'A NOVA PEDRA', cidade: '📍 Nova Jerusalém', cor: '#1c3f6e',
    destaque: 'Hoje viajaremos à Nova Jerusalém, a capital universal, sede do governo de Deus. Um lugar incrível, com ruas de ouro e alicerces de pedras preciosas. Somente chegaremos por um caminho que passa pela Cruz do Calvário!',
    campos: [
      { id: 'ep13_q1', tipo: 'pergunta', label: 'Que promessa Jesus fez aos seus discípulos?', ref: 'João 14:1-3' },
      { id: 'ep13_portas', tipo: 'ficha', label: 'A cidade tem _____ portas, com o nome das _____ tribos (Apocalipse 21:12).', placeholder: 'Ex.: 12 portas, com o nome das 12 tribos de Israel' },
      { id: 'ep13_forma', tipo: 'ficha', label: 'A cidade é _____ (verso 16), toda feita de _____ (verso 18) semelhante a vidro.', placeholder: 'Ex.: quadrada / ouro puro' },
      { id: 'ep13_luz', tipo: 'ficha', label: 'A cidade não precisa de _____ (verso 23) pois a glória de Deus a ilumina.', placeholder: 'Ex.: sol nem lua' },
      { id: 'ep13_q2', tipo: 'pergunta', label: 'Leia Isaías 65:18-25 e cite pelo menos 2 coisas legais que encontraremos na Nova Terra:', placeholder: '1. ...\n2. ...' },
      { id: 'ep13_p1', tipo: 'pesquisa', label: 'Exposição Final! Que tal montarmos uma amostra de rochas e minerais com todos do clube e apresentá-los para a sua comunidade?', placeholder: 'Como será a exposição? Onde? Quando?' },
    ],
    mensagem: '🌟 "Olho nenhum viu, ouvido nenhum ouviu, mente nenhuma imaginou o que Deus preparou para aqueles que O amam." — 1 Coríntios 2:9',
    proxima: 'Na nossa próxima viagem conheceremos alguns tesouros da Nova Jerusalém. Uma cidade preparada para os salvos com incríveis presentes — alguns para todos, outros Deus preparou especialmente para VOCÊ!',
  },
  {
    num: 14, titulo: 'A PEDRA BRANCA', cidade: '📍 Nova Jerusalém (conclusão)', cor: '#4a5568',
    destaque: 'Quando Jesus nos prometeu preparar lugar (João 14:1-3), Ele falava a toda a humanidade, mas também aos seus amigos, os discípulos. Jesus quer levar você para uma cidade muito, muito, muito melhor que a sua!',
    campos: [
      { id: 'ep14_q1', tipo: 'pergunta', label: 'Quem serão os habitantes da Nova Jerusalém?', ref: 'Apocalipse 3:5; 21:27' },
      { id: 'ep14_q2', tipo: 'pergunta', label: 'Como os habitantes atingirão a aparência gloriosa?', ref: '1 Coríntios 15:51; Apocalipse 22:2; Apocalipse 2:7' },
      { id: 'ep14_q3', tipo: 'pergunta', label: 'O que receberemos na investidura celestial?', ref: 'Apocalipse 2:10' },
      { id: 'ep14_q4', tipo: 'pergunta', label: 'Como será a Pedra Branca que cada morador da Nova Jerusalém receberá?', ref: 'Apocalipse 2:17' },
      { id: 'ep14_reflexao', tipo: 'reflexao', label: 'Reflexão final: O que você aprendeu nessa jornada das Jóias da Eternidade? O que vai mudar na sua vida?', placeholder: 'Escreva sua reflexão pessoal aqui...', minHeight: 110 },
    ],
    mensagem: '🏕️ A aventura continua! Um Desbravador vive aqui já sonhando com o Campori Eterno. Por isso observa a devoção matinal, faz sua parte, é cortês e obediente, frequenta reverentemente a casa de Deus e sempre tem um cântico no coração. Pois Cristo virá em breve dar o galardão!',
  },
];

/* ─── Todos os campo IDs para calcular progresso ─────────────────── */
const TODOS_CAMPOS = EPISODIOS.flatMap((ep) => ep.campos.map((c) => c.id));

/* ─── Componente principal ──────────────────────────────────────── */
export default function ClasseBiblicaScreen() {
  const usuario   = useAuthStore((s) => s.usuario);
  const [loading, setLoading]         = useState(true);
  const [salvando, setSalvando]       = useState(false);
  const [respostas, setRespostas]     = useState<Record<string, string>>({});
  const [abertos, setAbertos]         = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Progresso */
  const preenchidos = TODOS_CAMPOS.filter((id) => (respostas[id] ?? '').trim().length > 2).length;
  const pct         = TODOS_CAMPOS.length > 0 ? Math.round((preenchidos / TODOS_CAMPOS.length) * 100) : 0;

  /* Carrega respostas ao focar */
  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    if (!usuario?.id) { setLoading(false); return; }
    try {
      const clubeId = getClubeAtivoId();
      const { data } = await supabase
        .from('classe_biblica_respostas')
        .select('campo_id, resposta')
        .eq('usuario_id', usuario.id)
        .eq('clube_id', clubeId);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.campo_id] = r.resposta; });
        setRespostas(map);
      }
    } catch { /* offline */ }
    setLoading(false);
  }

  function handleChange(campoId: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [campoId]: valor }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => salvar({ ...respostas, [campoId]: valor }), 1800);
  }

  async function salvar(dados: Record<string, string>) {
    if (!usuario?.id) return;
    setSalvando(true);
    try {
      const clubeId = getClubeAtivoId();
      const rows = Object.entries(dados)
        .filter(([, v]) => v.trim().length > 0)
        .map(([campo_id, resposta]) => ({
          usuario_id: usuario.id,
          clube_id:   clubeId,
          campo_id,
          resposta,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) {
        await supabase
          .from('classe_biblica_respostas')
          .upsert(rows, { onConflict: 'usuario_id,clube_id,campo_id' });
      }
    } catch { /* offline */ }
    setSalvando(false);
  }

  function toggleEp(num: number) {
    setAbertos((prev) => {
      const s = new Set(prev);
      s.has(num) ? s.delete(num) : s.add(num);
      return s;
    });
  }

  function camposPreenchidosEp(ep: Episodio) {
    return ep.campos.filter((c) => (respostas[c.id] ?? '').trim().length > 2).length;
  }

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#2e7d4f" />
        <Text style={s.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>⛏️ JÓIAS DA ETERNIDADE</Text>
          <Text style={s.headerSub}>Estudo Bíblico para Desbravadores</Text>
        </View>
        {salvando && <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />}
      </View>

      {/* Barra de progresso */}
      <View style={s.progContainer}>
        <View style={s.progBarBg}>
          <View style={[s.progBarFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={s.progTexto}>{pct}% concluído · {preenchidos}/{TODOS_CAMPOS.length} campos</Text>
      </View>

      {/* Intro */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.introCard}>
          <Text style={s.introTexto}>
            🗺️ Olá desbravador! Você foi convidado a buscar as <Text style={{ fontWeight: '900' }}>12 pedras preciosas</Text> que fazem a diferença na vida de qualquer pessoa. Prepare-se para viajar pela história e aprender coisas surpreendentes! Preencha cada episódio com base nos textos bíblicos indicados.
          </Text>
        </View>

        {EPISODIOS.map((ep) => {
          const aberto    = abertos.has(ep.num);
          const fill      = camposPreenchidosEp(ep);
          const total     = ep.campos.length;
          const completo  = fill === total;

          return (
            <View key={ep.num} style={s.epCard}>
              {/* Cabeçalho do episódio */}
              <TouchableOpacity
                style={[s.epHeader, { backgroundColor: ep.cor }]}
                onPress={() => toggleEp(ep.num)}
                activeOpacity={0.85}
              >
                <View style={s.epNum}>
                  {completo
                    ? <Ionicons name="checkmark" size={18} color="#fff" />
                    : <Text style={s.epNumText}>{ep.num}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.epTitulo}>{ep.titulo}</Text>
                  <Text style={s.epCidade}>{ep.cidade}</Text>
                </View>
                <View style={s.epProgBadge}>
                  <Text style={s.epProgText}>{fill}/{total}</Text>
                </View>
                <Ionicons
                  name={aberto ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="rgba(255,255,255,0.9)"
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {/* Corpo */}
              {aberto && (
                <View style={s.epBody}>
                  {/* Destaque */}
                  <View style={[s.destacaBox, { borderLeftColor: ep.cor }]}>
                    <Text style={s.destacaTexto}>{ep.destaque}</Text>
                  </View>

                  {/* Campos */}
                  {ep.campos.map((campo) => (
                    <CampoInput
                      key={campo.id}
                      campo={campo}
                      value={respostas[campo.id] ?? ''}
                      cor={ep.cor}
                      onChange={(v) => handleChange(campo.id, v)}
                    />
                  ))}

                  {/* Mensagem */}
                  {ep.mensagem && (
                    <View style={[s.mensagemBox, { borderColor: ep.cor + '66' }]}>
                      <Text style={[s.mensagemTexto, { color: ep.cor }]}>{ep.mensagem}</Text>
                    </View>
                  )}

                  {/* Próxima viagem */}
                  {ep.proxima && (
                    <View style={[s.proximaBox, { backgroundColor: ep.cor }]}>
                      <Text style={s.proximaTitulo}>🚐 PRÓXIMA VIAGEM</Text>
                      <Text style={s.proximaTexto}>{ep.proxima}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

/* ─── Campo de entrada ──────────────────────────────────────────── */
function CampoInput({
  campo, value, cor, onChange,
}: {
  campo: Campo; value: string; cor: string; onChange: (v: string) => void;
}) {
  const isPesquisa   = campo.tipo === 'pesquisa';
  const isConselheiro = campo.tipo === 'conselheiro';
  const isReflexao   = campo.tipo === 'reflexao';
  const isFicha      = campo.tipo === 'ficha';

  if (isPesquisa) {
    return (
      <View style={s.pesquisandoBox}>
        <Text style={s.pesquisandoTitulo}>🔍 PESQUISANDO E APRENDENDO</Text>
        <Text style={s.pesquisandoDesc}>{campo.label}</Text>
        <TextInput
          style={[s.textarea, { borderColor: '#ffe082', minHeight: campo.minHeight ?? 70 }]}
          value={value}
          onChangeText={onChange}
          placeholder={campo.placeholder ?? 'Anote aqui o resultado da sua pesquisa...'}
          placeholderTextColor="#aaa"
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  }

  if (isConselheiro) {
    return (
      <View style={s.perguntaWrap}>
        <Text style={[s.perguntaLabel, { color: '#1a6fa8' }]}>
          🤝 {campo.label}
        </Text>
        <TextInput
          style={[s.textarea, { borderColor: '#90caf9', minHeight: campo.minHeight ?? 70 }]}
          value={value}
          onChangeText={onChange}
          placeholder={campo.placeholder ?? 'Anote aqui...'}
          placeholderTextColor="#aaa"
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  }

  if (isFicha) {
    return (
      <View style={s.perguntaWrap}>
        <Text style={[s.perguntaLabel, { color: '#1c3f6e' }]}>📖 {campo.label}</Text>
        <TextInput
          style={[s.textarea, { borderColor: cor + '88', minHeight: 50 }]}
          value={value}
          onChangeText={onChange}
          placeholder={campo.placeholder ?? 'Responda aqui...'}
          placeholderTextColor="#aaa"
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  }

  return (
    <View style={s.perguntaWrap}>
      <Text style={s.perguntaLabel}>
        {campo.label}
        {campo.ref ? <Text style={s.perguntaRef}> ({campo.ref})</Text> : null}
      </Text>
      <TextInput
        style={[s.textarea, { borderColor: isReflexao ? cor : '#dde4ec', minHeight: campo.minHeight ?? 70 }]}
        value={value}
        onChangeText={onChange}
        placeholder={campo.placeholder ?? 'Escreva sua resposta aqui...'}
        placeholderTextColor="#aaa"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

/* ─── Estilos ────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5efe6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5efe6', gap: 12 },
  loadingText:    { color: '#555', fontSize: 14, fontWeight: '600' },

  header:         { backgroundColor: '#2e7d4f', paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:        { padding: 6 },
  headerTitle:    { color: '#f5c842', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  headerSub:      { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },

  progContainer:  { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e8ddd0' },
  progBarBg:      { backgroundColor: '#e8ddd0', borderRadius: 50, height: 8, overflow: 'hidden' },
  progBarFill:    { height: '100%', backgroundColor: '#4caf78', borderRadius: 50 },
  progTexto:      { textAlign: 'center', fontSize: 11, color: '#888', fontWeight: '700', marginTop: 5, letterSpacing: 0.3 },

  scroll:         { flex: 1 },
  scrollContent:  { padding: 14, gap: 10 },

  introCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderTopWidth: 4, borderTopColor: '#f5c842', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  introTexto:     { fontSize: 13, lineHeight: 20, color: '#555', fontWeight: '600' },

  epCard:         { borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  epHeader:       { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  epNum:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' },
  epNumText:      { color: '#fff', fontSize: 16, fontWeight: '900' },
  epTitulo:       { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  epCidade:       { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  epProgBadge:    { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  epProgText:     { color: '#fff', fontSize: 11, fontWeight: '800' },

  epBody:         { padding: 16, backgroundColor: '#f5efe6', gap: 14 },

  destacaBox:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  destacaTexto:   { fontSize: 13, lineHeight: 20, color: '#555', fontWeight: '600' },

  perguntaWrap:   { gap: 6 },
  perguntaLabel:  { fontSize: 13, fontWeight: '800', color: '#7a4f2d', lineHeight: 18 },
  perguntaRef:    { fontSize: 12, fontWeight: '600', color: '#1a6fa8', fontStyle: 'italic' },

  textarea: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#fff',
    lineHeight: 20,
    fontFamily: 'System',
    minHeight: 70,
  },

  pesquisandoBox: { backgroundColor: '#fffde7', borderWidth: 2, borderColor: '#f5c842', borderStyle: 'dashed', borderRadius: 12, padding: 14, gap: 8 },
  pesquisandoTitulo: { fontSize: 13, fontWeight: '900', color: '#7a4f2d', letterSpacing: 0.5 },
  pesquisandoDesc: { fontSize: 12, color: '#666', fontWeight: '600', lineHeight: 18 },

  mensagemBox:    { borderRadius: 12, padding: 14, backgroundColor: '#e8f5e9', borderWidth: 2, alignItems: 'center' },
  mensagemTexto:  { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  proximaBox:     { borderRadius: 12, padding: 14 },
  proximaTitulo:  { fontSize: 13, fontWeight: '900', color: '#f5c842', letterSpacing: 0.5, marginBottom: 4 },
  proximaTexto:   { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600', lineHeight: 18 },
});
