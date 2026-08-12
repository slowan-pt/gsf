// Dados estruturados do cartão "Classes agrupadas" — cada item traz a faixa de
// idades para as quais ele se aplica (tag entre parênteses no texto oficial),
// transcritos do texto fornecido pelo usuário.
// Consumido por scripts/gerar-seed-classes-agrupadas.mjs.

// Tag de idade: string como '11-12-13-14-15+' (15+ = "≥15"). O gerador calcula
// idade_agrupada_min/max a partir dela.
const T = (tag, texto, extra = {}) => ({ tag, texto, ...extra });

export const AGRUPADAS_SECOES = [
  {
    nome: 'I. Gerais', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Ser membro ativo do Clube de Desbravadores.' },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Memorizar e explicar o Voto e a Lei do Desbravador.' },
      { codigo: '3', tag: '11-12-13-14-15+', texto: 'Ilustrar de forma criativa o significado do Voto do Desbravador.' },
      { codigo: '4', tag: '12-13-14-15+', texto: 'Demonstrar sua compreensão do significado da Lei do Desbravador através de uma das seguintes atividades:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Representação' }, { sub: 'b', texto: 'Debate' }, { sub: 'c', texto: 'Redação' },
      ] },
      { codigo: '5', tag: '13-14-15+', texto: 'Memorizar e entender o Alvo e o Lema JA.' },
      { codigo: '6', tag: '14-15+', texto: 'Memorizar e explicar o significado do Objetivo JA.' },
      { codigo: '7', tag: '15+', texto: 'Memorizar e explicar o Voto de Fidelidade à Bíblia.' },
      { codigo: '8', tag: '11', texto: 'Ler o livro do Clube de Leitura do ano em curso e escrever um parágrafo sobre o que mais lhe chamou atenção ou considerou mais importante.' },
      { codigo: '9', tag: '12', texto: 'Ler o livro do Clube de Leitura do ano em curso e escrever dois parágrafos sobre o que mais lhe chamou atenção ou considerou importante.' },
      { codigo: '10', tag: '13-14-15+', texto: 'Ler o livro do Clube de Leitura do ano em curso e resumi-lo em uma página.' },
      { codigo: '11', tag: '11-12-13-14-15+', texto: 'Ler o livro Pela Graça de Deus.' },
      { codigo: '12', tag: '11-12-13-14-15+', texto: 'Ler o livro Caminho a Cristo.' },
      { codigo: '13', tag: '12-13-14-15+', texto: 'Ler o livro Além da Magia.' },
      { codigo: '14', tag: '13-14-15+', texto: 'Ler o livro A História da Vida.' },
      { codigo: '15', tag: '14-15+', texto: 'Ler o livro Nos Bastidores da Mídia.' },
      { codigo: '16', tag: '15+', texto: 'Ler o livro Nossa Herança.' },
      { codigo: '17', tag: '11-12-13', texto: 'Participar ativamente da Classe Bíblica do seu Clube.' },
    ],
  },
  {
    nome: 'II. Descoberta espiritual', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Memorizar e demonstrar seu conhecimento:', subitens: [
        { sub: 'a', texto: 'Criação: o que Deus criou em cada dia da criação.' },
        { sub: 'b', texto: '10 Pragas: quais as pragas que caíram sobre o Egito.' },
        { sub: 'c', texto: '12 Tribos: o nome de cada uma das 12 tribos de Israel.' },
        { sub: 'd', texto: '39 livros do Antigo Testamento e demonstrar habilidade para encontrar qualquer um deles.' },
      ] },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Memorizar e demonstrar seu conhecimento:', subitens: [
        { sub: 'a', texto: '10 Mandamentos: a Lei de Deus dada a Moisés.' },
        { sub: 'b', texto: '27 livros do Novo Testamento e demonstrar habilidade para encontrar qualquer um deles.' },
      ] },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Memorizar e demonstrar seu conhecimento:', subitens: [
        { sub: 'a', texto: 'Levítico 11: quais as regras dos alimentos considerados comestíveis e não comestíveis.' },
      ] },
      { codigo: '4', tag: '13-14-15+', texto: 'Memorizar e demonstrar seu conhecimento:', subitens: [
        { sub: 'a', texto: 'Bem-Aventuranças: o Sermão da Montanha.' },
      ] },
      { codigo: '5', tag: '14-15+', texto: 'Memorizar e demonstrar seu conhecimento:', subitens: [
        { sub: 'a', texto: '12 apóstolos: o nome dos 12 apóstolos de Cristo.' },
        { sub: 'b', texto: 'O fruto do Espírito: a relação de adjetivos do caráter de um cristão.' },
      ] },
      { codigo: '6', tag: '15+', texto: 'Memorizar e demonstrar seu conhecimento:', subitens: [
        { sub: 'a', texto: '3 mensagens angélicas: reveladas em Apocalipse 14:6-12.' },
        { sub: 'b', texto: '7 Igrejas: o nome das igrejas do Apocalipse.' },
        { sub: 'c', texto: 'Pedras preciosas: os 12 fundamentos da Cidade Santa - A Nova Jerusalém.' },
      ] },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Ler e explicar os versos abaixo:', subitens: [
        { sub: 'a', texto: 'João 3:16' }, { sub: 'b', texto: 'Efésios 6:1-3' }, { sub: 'c', texto: 'II Timóteo 3:16' }, { sub: 'd', texto: 'Salmo 1' },
      ] },
      { codigo: '8', tag: '11-12-13-14-15+', texto: 'Ler e explicar os versos abaixo:', subitens: [
        { sub: 'a', texto: 'Isaías 41:9-10' }, { sub: 'b', texto: 'Hebreus 13:5' }, { sub: 'c', texto: 'Provérbios 22:6' },
        { sub: 'd', texto: 'I João 1:9' }, { sub: 'e', texto: 'Salmo 8' },
      ] },
      { codigo: '9', tag: '12-13-14-15+', texto: 'Ler e explicar os versos abaixo:', subitens: [
        { sub: 'a', texto: 'Eclesiastes 12:13-14' }, { sub: 'b', texto: 'Romanos 6:23' }, { sub: 'c', texto: 'Apocalipse 1:3' },
        { sub: 'd', texto: 'Isaías 43:1-2' }, { sub: 'e', texto: 'Salmo 51:10' }, { sub: 'f', texto: 'Salmo 16' },
      ] },
      { codigo: '10', tag: '13-14-15+', texto: 'Ler e explicar os versos abaixo:', subitens: [
        { sub: 'a', texto: 'Isaías 26:3' }, { sub: 'b', texto: 'Romanos 12:12' }, { sub: 'c', texto: 'João 14:1-3' },
        { sub: 'd', texto: 'Salmo 37:5' }, { sub: 'e', texto: 'Filipenses 3:12-14' }, { sub: 'f', texto: 'Salmo 23' }, { sub: 'g', texto: 'I Samuel 15:22' },
      ] },
      { codigo: '11', tag: '14-15+', texto: 'Ler e explicar os versos abaixo:', subitens: [
        { sub: 'a', texto: 'Romanos 8:28' }, { sub: 'b', texto: 'Apocalipse 21:1-3' }, { sub: 'c', texto: 'II Pedro 1:20-21' },
        { sub: 'd', texto: 'I João 2:14' }, { sub: 'e', texto: 'II Crônicas 20:20' }, { sub: 'f', texto: 'Salmo 46' },
      ] },
      { codigo: '12', tag: '15+', texto: 'Ler e explicar os versos abaixo:', subitens: [
        { sub: 'a', texto: 'I Coríntios 13' }, { sub: 'b', texto: 'II Crônicas 7:14' }, { sub: 'c', texto: 'Apocalipse 22:18-20' },
        { sub: 'd', texto: 'II Timóteo 4:6-7' }, { sub: 'e', texto: 'Romanos 8:38-39' }, { sub: 'f', texto: 'Mateus 6:33-34' },
      ] },
      { codigo: '13', tag: '11-12-13-14-15+', tipo: 'Leitura', texto: 'Leitura bíblica — Gênesis: 1, 2, 3, 4:1-16, 6:11-22, 7, 8, 9:1-19, 11:1-9, 12:1-10, 13, 14:18-24, 15, 17:1-8, 15-22, 18:1-15, 18:16-33, 19:1-29, 21:1-21, 22:1-19, 23, 24:1-46, 48, 24:52-67, 27, 28, 29, 30:25-31, 31:2-3, 17-18, 32, 33, 37, 40, 41, 42, 43, 44, 45, 47, 50. Êxodo: 1, 2, 3, 4:1-17, 27-31, 5, 7, 8, 9, 10, 11, 12, 13:17-22, 14, 15:22-27, 16, 17, 18, 19, 20, 24, 32, 33, 34:1-14, 29-35, 35:4-29 e 40.' },
      { codigo: '14', tag: '11-12-13-14-15+', tipo: 'Leitura', texto: 'Leitura bíblica — Levítico: 11. Números: 9:15-23, 11, 12, 13, 14:1-38, 16, 17, 20:1-13, 22-29, 21:4-9, 22, 23, 24:1-10. Deuteronômio: 1:1-17, 32:1-43, 33, 34. Josué: 1, 2, 3, 4, 5:10, 6, 7, 9, 24:1-15, 29. Juízes: 6, 7, 13:1-18, 14, 15, 16. Rute: 1, 2, 3, 4. 1 Samuel: 1, 2, 3, 4, 5, 6, 8, 9, 10, 11:12-15, 12, 13, 15, 16, 17, 18:1-19, 20, 21:1-7, 22, 24, 25, 26, 31. 2 Samuel: 1, 5, 6, 7, 9, 11, 12:1-25, 15, 18.' },
      { codigo: '15', tag: '12-13-14-15+', tipo: 'Leitura', texto: 'Leitura bíblica — 1 Reis: 1:28-53, 3, 4:20-34, 5, 6, 8:12-60, 10, 11:6-43, 12, 16:29-33, 17:1-7, 17:8-24, 18, 19, 21. 2 Reis: 2, 4:1-7, 4:8-41, 5, 6:1-23, 6:24-33, 7, 20, 22, 23:36-37, 24, 25:1-7. 2 Crônicas: 24:1-14, 36. Esdras: 1, 3, 6:14-15. Neemias: 1, 2, 4, 8. Ester: 1, 2, 3, 4, 5, 6, 7, 8. Jó: 1, 2, 42. Salmos: 1, 15, 19, 23, 24, 27, 37, 39, 42, 46, 67, 90, 91, 92, 97, 98, 100, 117, 119:1-80, 119:81-176, 121, 125, 150. Provérbios: 1, 3, 4, 10, 15, 20, 25. Eclesiastes: 1.' },
      { codigo: '16', tag: '13-14-15+', tipo: 'Leitura', texto: 'Leitura bíblica — Eclesiastes: 3, 5, 7, 11, 12. Isaías: 5, 11, 26:1-12, 35, 40, 43, 52:13-15, 53, 58, 60, 61. Jeremias: 9:23-26, 10:1-16, 18:1-6, 26, 36, 52:1-11. Daniel: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12. Joel: 2:12-31. Amós: 7:10-16, 8:4-11. Jonas: 1, 2, 3, 4. Miqueias: 4. Ageu: 2. Zacarias: 4. Malaquias: 3, 4. Mateus: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23.' },
      { codigo: '17', tag: '14-15+', tipo: 'Leitura', texto: 'Leitura bíblica — Mateus: 24, 25, 26:1-35, 26:36-75, 27:1-31, 27:32-56, 27:57-66, 28. Marcos: 7, 9, 10, 11, 12, 16. Lucas: 1:4-25, 1:26-66, 2:21-38, 2:39-52, 7:18-28, 8, 10:1-37, 10:38-42, 11:1-13, 12, 13, 14, 15, 16:1-17, 17, 18, 19, 21, 22, 23, 24. João: 1, 2, 3, 4, 5, 6:1-21, 6:22-71, 8:1-38, 9, 10, 11:1-46, 12, 13, 14, 15, 17, 18, 19, 20, 21. Atos: 1, 2, 3, 4, 5, 6, 7, 8.' },
      { codigo: '18', tag: '15+', tipo: 'Leitura', texto: 'Leitura bíblica — Atos: 9:1-31, 9:32-43, 10, 11, 12, 13, 14, 16, 17:1-15, 17:16-34, 18, 19:1-22, 19:23-41, 20, 21:17-40, 22:1-16, 23, 24, 25, 26, 27, 28. Romanos: 12, 13, 14. 1 Coríntios: 13. 2 Coríntios: 5:11-21, 11:16-33, 12:1-10. Gálatas: 5:16-26, 6:1-10. Efésios: 5:1-21, 6. Filipenses: 4. Colossenses: 3. 1 Tessalonicenses: 4:13-18, 5. 2 Tessalonicenses: 2, 3. 1 Timóteo: 4:6-16, 5:1-16, 6:11-21. 2 Timóteo: 2, 3. Filemom. Hebreus: 11. Tiago: 1, 3, 5:7-20. 1 Pedro: 1, 5:1-11. 2 Pedro: 3. 1 João: 2, 3, 4, 5. Judas: 17-25. Apocalipse: 1, 2, 3, 7:9-17, 12, 13, 14, 19, 20, 21.' },
      { codigo: '19', tag: '13-14-15+', texto: 'Conversar em seu Clube ou Unidade sobre:', subitens: [
        { sub: 'a', texto: 'O que é cristianismo' }, { sub: 'b', texto: 'Quais as características de um verdadeiro discípulo' }, { sub: 'c', texto: 'O que fazer para ser um cristão verdadeiro' },
      ] },
      { codigo: '20', tag: '14-15+', texto: 'Estudar e entender a pessoa do Espírito Santo, como Ele se relaciona, e qual o Seu papel no crescimento espiritual de cada ser humano.' },
      { codigo: '21', tag: '15+', texto: 'Descrever os dons espirituais mencionados nos escritos de Paulo (Coríntios, Efésios, Filipenses) e para quais objetivos a igreja recebe esses dons.' },
      { codigo: '22', tag: '11-12-13-14-15+', texto: 'Em consulta com seu Conselheiro, escolher um dos seguintes temas. Depois, demonstrar seu conhecimento sobre o tema escolhido através de um destes: troca de ideia com o Conselheiro, atividade que integre todo o grupo ou redação.', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Uma parábola de Jesus' }, { sub: 'b', texto: 'Um milagre de Jesus' },
        { sub: 'c', texto: 'O Sermão da Montanha' }, { sub: 'd', texto: 'Um sermão sobre a Segunda Vinda de Cristo' },
      ] },
      { codigo: '23', tag: '12-13-14-15+', texto: 'Conversar com seu líder e escolher uma das seguintes histórias. Através dela, demonstrar sua compreensão de como Jesus salva as pessoas, usando um destes métodos: conversar em grupo com a participação do líder, apresentar uma mensagem em uma reunião do Clube, fazer uma série de cartazes ou uma maquete, ou escrever uma poesia ou hino.', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'João 3 - Nicodemos' }, { sub: 'b', texto: 'João 4 - A mulher samaritana' }, { sub: 'c', texto: 'Lucas 10 - O bom samaritano' },
        { sub: 'd', texto: 'Lucas 15 - O filho pródigo' }, { sub: 'e', texto: 'Lucas 19 - Zaqueu' },
      ] },
      { codigo: '24', tag: '13-14-15+', texto: 'Participar de um estudo sobre a inspiração da Bíblia, com a ajuda de um pastor, trabalhando os conceitos de inspiração, revelação e iluminação.' },
      { codigo: '25', tag: '14-15+', texto: 'Estudar, com sua Unidade, os eventos finais e a segunda vinda de Cristo.' },
      { codigo: '26', tag: '15+', texto: 'Estudar a estrutura e serviço do santuário do Antigo Testamento e relacionar com o ministério pessoal de Jesus e a cruz.' },
      { codigo: '27', tag: '13-14-15+', texto: 'Convidar três ou mais pessoas para assistirem a uma classe bíblica ou pequeno grupo.' },
      { codigo: '28', tag: '14-15+', texto: 'Através do estudo da Bíblia, descobrir o verdadeiro significado da observância do sábado.' },
      { codigo: '29', tag: '15+', texto: 'Ler e resumir três histórias de pioneiros adventistas. Contar essa história na reunião do Clube, no Culto JA ou na Escola Sabatina.' },
    ],
  },
  {
    nome: 'III. Servindo aos outros', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Dedicar duas horas ajudando alguém em sua comunidade, através de uma das seguintes atividades:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Visitar alguém que precisa de amizade e orar com essa pessoa' },
        { sub: 'b', texto: 'Oferecer alimento para alguém carente' },
        { sub: 'c', texto: 'Participar de um projeto ecológico ou educativo' },
      ] },
      { codigo: '2', tag: '11', texto: 'Planejar e dedicar pelo menos duas horas servindo sua comunidade e demonstrando companheirismo a alguém, de maneira prática.' },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Conhecer os projetos comunitários desenvolvidos em sua cidade e participar em pelo menos um deles com sua Unidade ou Clube.' },
      { codigo: '4', tag: '13-14-15+', texto: 'Participar de dois projetos missionários definidos por seu Clube.' },
      { codigo: '5', tag: '14-15+', texto: 'Convidar um amigo para participar de uma atividade social de sua igreja ou da Associação/Missão.' },
      { codigo: '6', tag: '15+', texto: 'Ajudar a organizar e participar de uma das seguintes atividades:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Fazer uma visita de cortesia a uma pessoa doente' },
        { sub: 'b', texto: 'Adotar uma pessoa ou família em necessidade e ajudá-los' },
        { sub: 'c', texto: 'Um projeto de sua escolha aprovado por seu líder' },
      ] },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Escrever uma redação explicando como ser um bom cidadão no lar e na escola.' },
      { codigo: '8', tag: '11-12', texto: 'Participar de um projeto que beneficiará sua comunidade ou igreja.' },
      { codigo: '9', tag: '12-13-14-15+', texto: 'Participar em três atividades missionárias da igreja.' },
      { codigo: '10', tag: '13-14-15+', texto: 'Trabalhar em um projeto comunitário de sua igreja, escola ou comunidade.' },
      { codigo: '11', tag: '14-15+', texto: 'Participar de um projeto comunitário desde o planejamento, organização até a execução.' },
      { codigo: '12', tag: '15+', texto: 'Discutir com sua Unidade os métodos de evangelismo pessoal e colocar alguns princípios em prática.' },
      { codigo: '13', tag: '14-15+', texto: 'Discutir como os jovens adventistas devem se relacionar com as pessoas nas diferentes situações do dia a dia, tais como:', subitens: [
        { sub: 'a', texto: 'Vizinhos' }, { sub: 'b', texto: 'Escola' }, { sub: 'c', texto: 'Atividades sociais' }, { sub: 'd', texto: 'Atividades recreativas' },
      ] },
    ],
  },
  {
    nome: 'IV. Desenvolvendo amizade', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Mencionar dez qualidades de um bom amigo e apresentar quatro situações diárias onde você praticou a Regra Áurea de Mateus 7:12.' },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Conversar com seu Conselheiro ou Unidade sobre como respeitar pessoas de diferentes culturas, raça e sexo.' },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Participar de um debate ou representação sobre a pressão de grupo e identificar a influência que isso exerce sobre as decisões.' },
      { codigo: '4', tag: '13-14-15+', texto: 'Participar de um debate e fazer uma avaliação pessoal sobre suas atitudes em dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: 'Auto-estima' }, { sub: 'b', texto: 'Amizade' }, { sub: 'c', texto: 'Relacionamentos' }, { sub: 'd', texto: 'Otimismo e pessimismo' },
      ] },
      { codigo: '5', tag: '14-15+', texto: 'Através de uma conversa em grupo ou avaliação pessoal, examinar suas atitudes em dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: 'Auto-estima' }, { sub: 'b', texto: 'Relacionamento familiar' }, { sub: 'c', texto: 'Finanças pessoais' }, { sub: 'd', texto: 'Pressão de grupo' },
      ] },
      { codigo: '6', tag: '15+', texto: 'Assistir uma palestra ou aula e examinar suas atitudes em relação a dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: 'A importância da escolha profissional' }, { sub: 'b', texto: 'Como se relacionar com os pais' },
        { sub: 'c', texto: 'A escolha da pessoa certa para namorar' }, { sub: 'd', texto: 'O plano de Deus para o sexo' },
      ] },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Saber cantar o Hino Nacional de seu país e conhecer sua história. Saber o nome do autor da letra e da música do hino.' },
      { codigo: '8', tag: '12-13-14-15+', texto: 'Visitar um órgão público de sua cidade ou bairro e descobrir de que maneiras o Clube pode ser útil à sua comunidade.' },
      { codigo: '9', tag: '13-14-15+', texto: 'Preparar uma lista contendo cinco sugestões de atividades recreativas para ajudar pessoas com necessidades específicas e colaborar na organização de uma destas atividades para essas pessoas.' },
    ],
  },
  {
    nome: 'V. Saúde e aptidão física', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Completar uma das seguintes especialidades:', subitens: [
        { sub: 'Natação principiante I', texto: 'Completar a especialidade de Natação principiante I.', especialidadeNome: 'Natação principiante I' },
        { sub: 'Cultura física', texto: 'Completar a especialidade de Cultura física.', especialidadeNome: 'Cultura física' },
        { sub: 'Nós e amarras', texto: 'Completar a especialidade de Nós e amarras.', especialidadeNome: 'Nós e amarras' },
      ] },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Memorizar e explicar I Coríntios 9:24-27.' },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Escolher uma das atividades abaixo e escrever um texto pessoal para um estilo de vida livre do álcool:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Participar de uma discussão em classe sobre os efeitos do álcool no organismo' },
        { sub: 'b', texto: 'Assistir um vídeo sobre o efeito do álcool ou outras drogas no corpo humano e conversar sobre o assunto' },
      ] },
      { codigo: '4', tag: '13-14-15+', texto: 'Preparar um programa especial de exercícios físicos diários e conversar com seu líder ou Conselheiro sobre os princípios de aptidão física. Fazer e assinar um compromisso pessoal de realizar exercícios físicos regularmente.' },
      { codigo: '5', tag: '14-15+', texto: 'Completar a especialidade de Temperança.', especialidadeNome: 'Temperança' },
      { codigo: '6', tag: '11-12-13-14-15+', texto: 'Fazer uma apresentação, para alunos do Ensino Fundamental, sobre os oito remédios naturais dados por Deus.' },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Utilizando a experiência de Daniel:', subitens: [
        { sub: 'a', texto: 'Explicar os princípios de temperança que ele defendeu ou participar de uma apresentação ou encenação sobre Daniel 1.' },
        { sub: 'b', texto: 'Memorizar e explicar Daniel 1:8.' },
        { sub: 'c', texto: 'Escrever seu compromisso pessoal de seguir um estilo de vida saudável.' },
      ] },
      { codigo: '8', tag: '11-12', texto: 'Conversar com seu líder sobre a aptidão física e os exercícios físicos regulares que se relacionam com uma vida saudável.' },
      { codigo: '9', tag: '13-14-15+', texto: 'Discutir as vantagens do estilo de vida Adventista de acordo com o que a Bíblia ensina.' },
      { codigo: '10', tag: '15+', texto: 'Completar uma das seguintes atividades:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Escrever uma poesia ou artigo sobre saúde para ser divulgado em uma revista, boletim ou jornal da igreja.' },
        { sub: 'b', texto: 'Individualmente ou em grupo, organizar e participar de uma corrida ou atividade similar e apresentar com antecedência um programa de treinamento físico para esse evento.' },
        { sub: 'c', texto: 'Ler as páginas 102-125 do livro Temperança, de Ellen G. White, e apresentar em uma página ou mais, 10 textos selecionados da leitura.' },
        { sub: 'd', texto: 'Completar a especialidade de Nutrição ou liderar um grupo para a especialidade de Cultura Física.' },
      ] },
      { codigo: '11', tag: '11-12-13-14-15+', texto: 'Aprender os princípios de uma dieta saudável e ajudar a preparar um quadro com os grupos básicos de alimentos.' },
      { codigo: '12', tag: '11-12-13-14-15+', texto: 'Aprender sobre os prejuízos que o cigarro causa à saúde e escrever seu compromisso de não fazer uso do fumo.' },
      { codigo: '13', tag: '11-12-13-14-15+', texto: 'Completar uma das seguintes especialidades:', subitens: [
        { sub: 'Natação principiante II', texto: 'Completar a especialidade de Natação principiante II.', especialidadeNome: 'Natação principiante II' },
        { sub: 'Acampamento II', texto: 'Completar a especialidade de Acampamento II.', especialidadeNome: 'Acampamento II' },
      ] },
    ],
  },
  {
    nome: 'VI. Organização e liderança', itens: [
      { codigo: '1', tag: '11-12-13', texto: 'Através da observação, acompanhar todo o processo de planejamento até a execução de uma caminhada de 5 quilômetros.' },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Dirigir ou colaborar em uma meditação criativa para sua Unidade ou Clube.' },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Dirigir uma cerimônia de abertura da reunião semanal em seu Clube ou um programa de Escola Sabatina.' },
      { codigo: '4', tag: '13-14-15+', texto: 'Assistir a um seminário ou treinamento, oferecido pela sua igreja ou distrito nos departamentos abaixo:', subitens: [
        { sub: 'a', texto: 'Ministério Pessoal' }, { sub: 'b', texto: 'Evangelismo' },
      ] },
      { codigo: '5', tag: '14-15+', texto: 'Preparar um organograma da igreja local e relacionar as funções dos departamentos.' },
      { codigo: '6', tag: '15+', texto: 'Preparar um organograma da estrutura administrativa da Igreja Adventista em sua Divisão.' },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Ajudar no planejamento de uma excursão ou acampamento com sua Unidade ou Clube, envolvendo pelo menos um pernoite.' },
      { codigo: '8', tag: '12-13-14-15+', texto: 'Ajudar a organizar a classe bíblica do seu Clube.' },
      { codigo: '9', tag: '13-14-15+', texto: 'Participar de uma atividade social de sua igreja.' },
      { codigo: '10', tag: '14-15+', texto: 'Participar de dois programas envolvendo diferentes departamentos da igreja local.' },
      { codigo: '11', tag: '15+', texto: 'Participar em um dos itens abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Curso de Conselheiros' }, { sub: 'b', texto: 'Convenção de liderança da Associação/Missão' }, { sub: 'c', texto: 'Duas reuniões de diretoria do seu Clube' },
      ] },
      { codigo: '12', tag: '14-15+', texto: 'Completar a especialidade de Aventuras com Cristo.', especialidadeNome: 'Aventuras com Cristo' },
      { codigo: '13', tag: '15+', texto: 'Planejar e ensinar, no mínimo, dois requisitos de uma especialidade para um grupo ou Unidade de desbravadores.' },
    ],
  },
  {
    nome: 'VII. Estudo da natureza', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Completar uma das seguintes especialidades:', subitens: [
        { sub: 'Felinos', texto: 'Completar a especialidade de Felinos.', especialidadeNome: 'Felinos' },
        { sub: 'Cães', texto: 'Completar a especialidade de Cães.', especialidadeNome: 'Cães' },
        { sub: 'Mamíferos', texto: 'Completar a especialidade de Mamíferos.', especialidadeNome: 'Mamíferos' },
        { sub: 'Sementes', texto: 'Completar a especialidade de Sementes.', especialidadeNome: 'Sementes' },
        { sub: 'Aves de estimação', texto: 'Completar a especialidade de Aves de estimação.', especialidadeNome: 'Aves de estimação' },
      ] },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Participar de jogos na natureza ou caminhada ecológica, pelo período de uma hora.' },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Identificar a estrela Alfa da constelação do Centauro e a constelação de Órion. Conhecer o significado espiritual de Órion, como descrito no livro Primeiros Escritos, de Ellen White, pág. 41.' },
      { codigo: '4', tag: '13-14-15+', texto: 'Estudar a história do dilúvio e o processo de fossilização.' },
      { codigo: '5', tag: '14-15+', texto: 'Recapitular a história de Nicodemos e relacioná-la com o ciclo da vida da lagarta ou da borboleta, acrescentando um significado espiritual.' },
      { codigo: '6', tag: '15+', texto: 'Ler o capítulo 7 do livro O Desejado de Todas as Nações, sobre a infância de Jesus. Apresentar para um grupo, Clube ou Unidade as lições encontradas, demonstrando a importância que o estudo da natureza exerceu na educação e ministério de Jesus.' },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Aprender e demonstrar uma maneira para purificar a água e escrever um parágrafo destacando o significado de Jesus como a água da vida.' },
      { codigo: '8', tag: '11-12-13-14-15+', texto: 'Completar duas das seguintes especialidades:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: 'Anfíbios' }, { sub: 'b', texto: 'Aves' }, { sub: 'c', texto: 'Aves domésticas' }, { sub: 'd', texto: 'Pecuária' },
        { sub: 'e', texto: 'Répteis' }, { sub: 'f', texto: 'Moluscos' }, { sub: 'g', texto: 'Árvores' }, { sub: 'h', texto: 'Arbustos' },
      ] },
      { codigo: '9', tag: '12-13-14-15+', texto: 'Completar uma das especialidades abaixo:', subitens: [
        { sub: 'Astronomia', texto: 'Completar a especialidade de Astronomia.', especialidadeNome: 'Astronomia' },
        { sub: 'Cactos', texto: 'Completar a especialidade de Cactos.', especialidadeNome: 'Cactos' },
        { sub: 'Climatologia', texto: 'Completar a especialidade de Climatologia.', especialidadeNome: 'Climatologia' },
        { sub: 'Flores', texto: 'Completar a especialidade de Flores.', especialidadeNome: 'Flores' },
        { sub: 'Rastreio de animais', texto: 'Completar a especialidade de Rastreio de animais.', especialidadeNome: 'Rastreio de animais' },
      ] },
      { codigo: '10', tag: '13', texto: 'Completar uma especialidade, não realizada anteriormente, em Estudos da natureza.' },
      { codigo: '11', tag: '14-15+', texto: 'Completar duas especialidades em Estudos da Natureza, não realizadas anteriormente.' },
      { codigo: '12', tag: '15+', texto: 'Completar uma das seguintes especialidades:', subitens: [
        { sub: 'Ecologia', texto: 'Completar a especialidade de Ecologia.', especialidadeNome: 'Ecologia' },
        { sub: 'Conservação ambiental', texto: 'Completar a especialidade de Conservação ambiental.', especialidadeNome: 'Conservação ambiental' },
      ] },
      { codigo: '13', tag: '11-12-13-14-15+', texto: 'Aprender e montar três tipos de barraca em locais apropriados.' },
      { codigo: '14', tag: '11-12-13-14-15+', texto: 'Recapitular o estudo da criação e fazer um diário por sete dias registrando suas observações do que foi criado em cada dia correspondente.' },
    ],
  },
  {
    nome: 'VIII. Arte de acampar', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Demonstrar como cuidar corretamente de uma corda. Fazer e explicar o uso prático dos seguintes nós:', subitens: [
        { sub: 'a', texto: 'Simples' }, { sub: 'b', texto: 'Cego' }, { sub: 'c', texto: 'Direito' }, { sub: 'd', texto: 'Cirurgião' },
        { sub: 'e', texto: 'Lais de guia' }, { sub: 'f', texto: 'Lais de guia duplo' }, { sub: 'g', texto: 'Escota' }, { sub: 'h', texto: 'Catau' },
        { sub: 'i', texto: 'Pescador' }, { sub: 'j', texto: 'Fateixa' }, { sub: 'k', texto: 'Volta do fiel' }, { sub: 'l', texto: 'Nó de gancho' },
        { sub: 'm', texto: 'Volta da ribeira' }, { sub: 'n', texto: 'Ordinário' },
      ] },
      { codigo: '2', tag: '11-12-13-14-15+', texto: 'Descobrir os pontos cardeais sem a ajuda de uma bússola e desenhar a Rosa dos Ventos.' },
      { codigo: '3', tag: '12-13-14-15+', texto: 'Apresentar seis segredos para um bom acampamento. Participar de um acampamento de final de semana, planejando e cozinhando duas refeições.' },
      { codigo: '4', tag: '13-14-15+', texto: 'Fazer um fogo refletor e mostrar seu uso.' },
      { codigo: '5', tag: '14-15+', texto: 'Com um grupo de, no mínimo, quatro pessoas e com a presença de um Conselheiro adulto experiente, andar pelo menos 20 quilômetros numa área rural ou deserta, incluindo uma noite ao ar livre ou em barraca. Planejar a expedição em detalhes antes da saída. Durante a caminhada, efetuar anotações sobre o terreno, flora e fauna observados. Depois, usando as anotações, participar de uma discussão de grupo, dirigida por seu Conselheiro.' },
      { codigo: '6', tag: '15+', texto: 'Participar com sua Unidade de um acampamento com estrutura de pioneiria, planejando o que vai acontecer neste acampamento.' },
      { codigo: '7', tag: '11-12-13-14-15+', texto: 'Completar a especialidade de Acampamento I.', especialidadeNome: 'Acampamento I' },
      { codigo: '8', tag: '11-12-13-14-15+', texto: 'Participar de um acampamento de final de semana e fazer um relatório destacando o que mais lhe impressionou positivamente.' },
      { codigo: '9', tag: '13-14-15+', texto: 'Completar as seguintes especialidades:', subitens: [
        { sub: 'a', texto: 'Acampamento III', especialidadeNome: 'Acampamento III' },
        { sub: 'b', texto: 'Primeiros socorros - Básico', especialidadeNome: 'Primeiros socorros - Básico' },
      ] },
      { codigo: '10', tag: '13-14-15+', texto: 'Participar de um acampamento de final de semana, arrumando de forma apropriada sua bolsa ou mochila com o equipamento pessoal necessário.' },
      { codigo: '11', tag: '14-15+', texto: 'Completar a especialidade de Pioneirias.', especialidadeNome: 'Pioneirias' },
      { codigo: '12', tag: '15+', texto: 'Planejar, preparar e cozinhar três refeições ao ar livre.' },
      { codigo: '13', tag: '11-12-13-14-15+', texto: 'Apresentar 10 regras para uma caminhada e explicar o que fazer quando estiver perdido.' },
      { codigo: '14', tag: '11-12-13-14-15+', texto: 'Aprender os seguintes nós:', subitens: [
        { sub: 'a', texto: 'Oito' }, { sub: 'b', texto: 'Volta do salteador' }, { sub: 'c', texto: 'Duplo' }, { sub: 'd', texto: 'Caminhoneiro' },
        { sub: 'e', texto: 'Direito' }, { sub: 'f', texto: 'Volta do Fiel' }, { sub: 'g', texto: 'Escota' }, { sub: 'h', texto: 'Laís de Guia' }, { sub: 'i', texto: 'Simples' },
      ] },
      { codigo: '15', tag: '12-13-14-15+', texto: 'Aprender a usar uma bússola ou um GPS (urbano ou campo), e demonstrar sua habilidade encontrando endereços na zona urbana.' },
      { codigo: '16', tag: '13-14-15+', texto: 'Completar a especialidade de Resgate Básico.', especialidadeNome: 'Resgate Básico' },
      { codigo: '17', tag: '15+', texto: 'Construir e utilizar um móvel de acampamento em tamanho real, com nós e amarras.' },
      { codigo: '18', tag: '11-12-13-14-15+', texto: 'Aprender os sinais para seguir uma pista. Preparar e seguir uma pista de no mínimo 10 sinais, que possa ser seguida por outros.' },
      { codigo: '19', tag: '15+', texto: 'Completar uma especialidade, não realizada anteriormente, que possa ser contada para um dos mestrados abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Aquática' }, { sub: 'b', texto: 'Esportes' }, { sub: 'c', texto: 'Atividades recreativas' }, { sub: 'd', texto: 'Vida campestre' },
      ] },
    ],
  },
  {
    nome: 'IX. Estilo de vida', itens: [
      { codigo: '1', tag: '11-12-13-14-15+', texto: 'Completar duas especialidades não realizadas anteriormente na área de Artes e Habilidades Manuais.' },
      { codigo: '2', tag: '12-13-14-15+', texto: 'Completar uma especialidade não realizada anteriormente na seção de Artes e Habilidades Manuais.' },
      { codigo: '3', tag: '13-14-15+', texto: 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Atividades Missionárias' }, { sub: 'b', texto: 'Atividades Profissionais' }, { sub: 'c', texto: 'Atividades Agrícolas' },
      ] },
      { codigo: '4', tag: '14-15+', texto: 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Atividades Missionárias' }, { sub: 'b', texto: 'Atividades Agrícolas' }, { sub: 'c', texto: 'Ciência e Saúde' }, { sub: 'd', texto: 'Habilidades Domésticas' },
      ] },
      { codigo: '5', tag: '15+', texto: 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Atividades Recreativas' }, { sub: 'b', texto: 'Ciência e Saúde' }, { sub: 'c', texto: 'Habilidades Domésticas' }, { sub: 'd', texto: 'Atividades Profissionais' },
      ] },
    ],
  },
];

// Classes avançadas do cartão agrupado — cada bloco vale para a faixa de idade
// indicada junto ao título (todos os itens do bloco compartilham a mesma tag).
export const AGRUPADAS_AVANCADAS = [
  {
    nome: 'I. Amigo da Natureza', tag: '11-12-13-14-15+', itens: [
      { codigo: '1', texto: 'Memorizar, cantar ou tocar o Hino dos Desbravadores e conhecer a história do hino.' },
      { codigo: '2', texto: 'Em consulta com seu líder, escolher um dos seguintes personagens do Antigo Testamento e conversar com seu grupo sobre o amor e cuidado de Deus e o livramento demonstrado na vida do personagem escolhido:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'José' }, { sub: 'b', texto: 'Jonas' }, { sub: 'c', texto: 'Ester' }, { sub: 'd', texto: 'Rute' },
      ] },
      { codigo: '3', texto: 'Levar pelo menos dois amigos não adventistas à Escola Sabatina ou ao Clube de Desbravadores.' },
      { codigo: '4', texto: 'Conhecer os princípios de higiene, de boas maneiras à mesa e como se comportar diante de pessoas que tenham diferentes idades. Demonstrar e explicar como estas boas maneiras podem ser úteis nas reuniões e acampamentos do Clube.' },
      { codigo: '5', texto: 'Completar a Especialidade de Arte de acampar.', especialidadeNome: 'Arte de acampar' },
      { codigo: '6', texto: 'Conhecer e identificar 10 flores silvestres e 10 insetos de sua região.' },
      { codigo: '7', texto: 'Começar uma fogueira com apenas um fósforo, usando materiais naturais, e mantê-la acesa.' },
      { codigo: '8', texto: 'Usar corretamente uma faca, facão ou uma machadinha e conhecer dez regras para usá-los com segurança.' },
      { codigo: '9', texto: 'Escolher e completar uma especialidade em uma das áreas abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Atividades Missionárias e Comunitárias' }, { sub: 'b', texto: 'Atividades Agrícolas e Afins' },
      ] },
    ],
  },
  {
    nome: 'II. Companheiro de Excursionismo', tag: '11-12-13-14-15+', itens: [
      { codigo: '1', texto: 'Aprender e demonstrar a composição, significado e uso correto da Bandeira Nacional.' },
      { codigo: '2', texto: 'Ler a primeira visão de Ellen White e discutir como Deus usa os profetas para apresentar Sua mensagem à igreja (ver Primeiros Escritos, págs. 13 a 20).' },
      { codigo: '3', texto: 'Participar de uma atividade missionária ou comunitária, envolvendo também um amigo.' },
      { codigo: '4', texto: 'Conversar com seu Conselheiro ou Unidade sobre como demonstrar respeito pelos seus pais ou responsáveis e fazer uma lista mostrando como cuidam de você.' },
      { codigo: '5', texto: 'Participar de uma caminhada de 6 quilômetros, preparando, ao final, um relatório de uma página.' },
      { codigo: '6', texto: 'Escolher um dos seguintes itens:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Assistir a um curso "Como deixar de fumar"' }, { sub: 'b', texto: 'Assistir a dois filmes sobre saúde' },
        { sub: 'c', texto: 'Ajudar a preparar material para uma exposição ou passeata sobre saúde' },
        { sub: 'd', texto: 'Pesquisar na internet informações sobre saúde e escrever uma página sobre os resultados encontrados' },
      ] },
      { codigo: '7', texto: 'Identificar e descrever 12 pássaros e 12 árvores nativas.' },
      { codigo: '8', texto: 'Planejar e organizar uma das seguintes:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Investidura' }, { sub: 'b', texto: 'Admissão em lenço' }, { sub: 'c', texto: 'Dia Mundial do Desbravador' },
      ] },
      { codigo: '9', texto: 'Preparar uma refeição em uma fogueira durante um acampamento do Clube ou unidade.' },
      { codigo: '10', texto: 'Preparar um quadro com quinze nós diferentes.' },
      { codigo: '11', texto: 'Completar a especialidade de Excursionismo Pedestre com mochila.', especialidadeNome: 'Excursionismo Pedestre com mochila' },
      { codigo: '12', texto: 'Completar uma especialidade, não realizada anteriormente, em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Habilidades Domésticas' }, { sub: 'b', texto: 'Ciência e Saúde' },
        { sub: 'c', texto: 'Atividades Missionárias e Comunitárias' }, { sub: 'd', texto: 'Atividades Agrícolas e Afins' },
      ] },
    ],
  },
  {
    nome: 'III. Pesquisador de Campo e Bosque', tag: '12-13-14-15+', itens: [
      { codigo: '1', texto: 'Conhecer e saber usar de forma adequada a Bandeira dos Desbravadores e o Bandeirim de Unidade.' },
      { codigo: '2', texto: 'Ler a história de J. N. Andrews ou um pioneiro de seu país. Discutir a importância do trabalho de missionários em outros países e por que Cristo ordenou a Grande Comissão (Mateus 28:18-20).' },
      { codigo: '3', texto: 'Convidar uma pessoa para assistir um dos seguintes programas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Clube de Desbravadores' }, { sub: 'b', texto: 'Classe Bíblica' }, { sub: 'c', texto: 'Pequenos Grupos' },
      ] },
      { codigo: '4', texto: 'Fazer uma das seguintes especialidades:', subitens: [
        { sub: 'Asseio e cortesia cristã', texto: 'Completar a especialidade de Asseio e cortesia cristã.', especialidadeNome: 'Asseio e cortesia cristã' },
        { sub: 'Vida familiar', texto: 'Completar a especialidade de Vida familiar.', especialidadeNome: 'Vida familiar' },
      ] },
      { codigo: '5', texto: 'Participar de uma caminhada de 10 km e fazer uma lista dos equipamentos necessários, incluindo a roupa e o calçado que devem ser usados.' },
      { codigo: '6', texto: 'Participar na organização de um dos eventos especiais do Clube:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Investidura' }, { sub: 'b', texto: 'Admissão em lenço' }, { sub: 'c', texto: 'Dia Mundial do Desbravador' },
      ] },
      { codigo: '7', texto: 'Identificar seis pegadas de animais ou aves. Fazer um modelo em gesso, massa de modelar ou biscuit de três dessas pegadas.' },
      { codigo: '8', texto: 'Aprender a fazer as quatro amarras básicas e construir um móvel de acampamento.' },
      { codigo: '9', texto: 'Planejar um cardápio vegetariano para sua Unidade, para um acampamento de três dias e apresentar ao seu instrutor.' },
      { codigo: '10', texto: 'Enviar e receber uma mensagem através de uma das formas de comunicação abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Alfabeto com semáforos' }, { sub: 'b', texto: 'Código Morse, com lanterna' },
        { sub: 'c', texto: 'Alfabeto LIBRAS (língua de sinais)' }, { sub: 'd', texto: 'Alfabeto Braile' },
      ] },
      { codigo: '11', texto: 'Completar uma especialidade, não realizada anteriormente, em duas das seguintes áreas:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: 'Habilidades Domésticas' }, { sub: 'b', texto: 'Ciência e Saúde' },
        { sub: 'c', texto: 'Atividades Missionárias e Comunitárias' }, { sub: 'd', texto: 'Atividades Agrícolas e Afins' },
      ] },
    ],
  },
  {
    nome: 'IV. Pioneiro de Novas Fronteiras', tag: '13-14-15+', itens: [
      { codigo: '1', texto: 'Completar a especialidade de Cidadania cristã, caso não tenha sido feita anteriormente.', especialidadeNome: 'Cidadania cristã' },
      { codigo: '2', texto: 'Encenar a história do bom samaritano, demonstrando como ajudar as pessoas. Auxiliar de forma prática pelo menos a três pessoas.' },
      { codigo: '3', texto: 'Participar de uma das seguintes atividades, apresentando ao final um relatório escrito contendo no mínimo duas páginas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Caminhar 10 km' }, { sub: 'b', texto: 'Cavalgar 2 km' }, { sub: 'c', texto: 'Viajar de canoa durante 2h' },
        { sub: 'd', texto: 'Praticar 15 km de ciclismo' }, { sub: 'e', texto: 'Nadar 200 metros' }, { sub: 'f', texto: 'Correr 1500 metros' }, { sub: 'g', texto: 'Rodar 2 km de patins ou roller' },
      ] },
      { codigo: '4', texto: 'Completar a especialidade de Mapa e bússola.', especialidadeNome: 'Mapa e bússola' },
      { codigo: '5', texto: 'Demonstrar habilidade no uso correto de uma machadinha.' },
      { codigo: '6', texto: 'Ser capaz de acender uma fogueira em dia de chuva, saber como conseguir lenha seca e manter o fogo aceso.' },
      { codigo: '7', texto: 'Completar um dos seguintes itens:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Pesquisar e identificar 10 variedades de plantas silvestres comestíveis.' },
        { sub: 'b', texto: 'Ser capaz de enviar e receber 35 letras por minuto pelo código semafórico' },
        { sub: 'c', texto: 'Ser capaz de enviar e receber 35 letras por minuto através do código náutico, usando o código internacional' },
        { sub: 'd', texto: 'Ser capaz de apresentar e entender Mateus 24 em LIBRAS (língua de sinais)' },
        { sub: 'e', texto: 'Preparar o salmo 23 em braile' },
      ] },
      { codigo: '8', texto: 'Completar uma especialidade, não realizada anteriormente, em Atividades Recreativas.' },
      { codigo: '9', texto: 'Pesquisar e identificar, através de fotografia, exposição ou ao vivo, dois dos seguintes itens:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: '25 folhas de árvores' }, { sub: 'b', texto: '25 rochas e minerais' }, { sub: 'c', texto: '25 flores silvestres' },
        { sub: 'd', texto: '25 borboletas e mariposas' }, { sub: 'e', texto: '25 conchas' },
      ] },
      { codigo: '10', texto: 'Completar a especialidade de Fogueiras e cozinha ao ar livre.', especialidadeNome: 'Fogueiras e cozinha ao ar livre' },
    ],
  },
  {
    nome: 'V. Excursionista na Mata', tag: '14-15+', itens: [
      { codigo: '1', texto: 'Fazer uma apresentação escrita ou falada sobre o respeito que devemos ter com a Lei de Deus e as autoridades civis, enumerando dez princípios de comportamento moral.' },
      { codigo: '2', texto: 'Acompanhar seu pastor ou ancião numa visita missionária ou estudo bíblico.' },
      { codigo: '3', texto: 'Completar a especialidade de Testemunho juvenil.', especialidadeNome: 'Testemunho juvenil' },
      { codigo: '4', texto: 'Apresentar cinco atividades junto à natureza, que podem ser desenvolvidas nas tardes de Sábado.' },
      { codigo: '5', texto: 'Com sua Unidade, construir um móvel de acampamento e um portal para o Clube.' },
      { codigo: '6', texto: 'Através da supervisão de seu líder ou Conselheiro, conversar em sua Unidade ou Clube sobre um dos seguintes temas:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Modéstia Cristã' }, { sub: 'b', texto: 'Recreação' }, { sub: 'c', texto: 'Saúde' }, { sub: 'd', texto: 'Observância do Sábado' },
      ] },
      { codigo: '7', texto: 'Demonstrar conhecimento para encontrar alimentos, através de plantas silvestres de sua região e saber diferenciá-las de plantas tóxicas/venenosas.' },
      { codigo: '8', texto: 'Demonstrar conhecimento quanto aos procedimentos necessários em caso de ferimentos por diferentes animais peçonhentos e não peçonhentos.' },
      { codigo: '9', texto: 'Demonstrar técnicas para percorrer trilhas em diferentes tipos de terrenos, como: desertos, florestas, pântanos e rios.' },
      { codigo: '10', texto: 'Completar a Especialidade de Ordem unida.', especialidadeNome: 'Ordem unida' },
      { codigo: '11', texto: 'Completar a Especialidade de Vida silvestre.', especialidadeNome: 'Vida silvestre' },
    ],
  },
  {
    nome: 'VI. Guia de Exploração', tag: '15+', itens: [
      { codigo: '1', texto: 'Completar a especialidade de Mordomia.', especialidadeNome: 'Mordomia' },
      { codigo: '2', texto: 'Ler o livro O Maior Discurso de Cristo e escrever uma página sobre o efeito da leitura em sua vida.' },
      { codigo: '3', texto: 'Cumprir um dos seguintes itens:', grupoEscolha: { necessarias: 1 }, subitens: [
        { sub: 'a', texto: 'Trazer dois amigos para assistir a duas diferentes reuniões da igreja.' },
        { sub: 'b', texto: 'Ajudar a planejar e participar de, no mínimo, quatro domingos em uma série de evangelismo jovem.' },
      ] },
      { codigo: '4', texto: 'Escrever uma página ou apresentar uma palestra sobre como influenciar amigos para Cristo.' },
      { codigo: '5', texto: 'Observar durante o período de dois meses o trabalho dos diáconos, apresentando um relatório detalhado de suas atividades, contendo:', subitens: [
        { sub: 'a', texto: 'Cuidado da propriedade da igreja' }, { sub: 'b', texto: 'Cerimônia de lava-pés' },
        { sub: 'c', texto: 'Cerimônia de batismo' }, { sub: 'd', texto: 'Recolhimento dos dízimos e ofertas' },
      ] },
      { codigo: '6', texto: 'Completar uma Especialidade, não realizada anteriormente, para o mestrado em Vida campestre.' },
      { codigo: '7', texto: 'Projetar três tipos diferentes de abrigo, explicar seu uso e utilizar um deles em um acampamento.' },
      { codigo: '8', texto: 'Assistir a um seminário ou apresentar uma palestra sobre dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
        { sub: 'a', texto: 'Aborto' }, { sub: 'b', texto: 'Bullying' }, { sub: 'c', texto: 'Violência' }, { sub: 'd', texto: 'Drogas' }, { sub: 'e', texto: 'Doenças Sexualmente Transmissíveis' },
      ] },
      { codigo: '9', texto: 'Completar a Especialidade de Liderança campestre.', especialidadeNome: 'Liderança campestre' },
      { codigo: '10', texto: 'Completar a Especialidade em Orçamento familiar.', especialidadeNome: 'Orçamento familiar' },
    ],
  },
];
