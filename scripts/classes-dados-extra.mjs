// Dados estruturados das classes Pesquisador, Pioneiro, Excursionista, Guia
// (regular + avançada de cada) e Líder / Líder Máster, transcritos do texto
// oficial fornecido pelo usuário. Consumido por scripts/gerar-seed-classes-extra.mjs.
//
// Cada item pode ter:
//  - subitens: [{ sub, texto, especialidadeNome? }] — detalhamento ou opções de escolha
//  - grupoEscolha: { necessarias } — quando os subitens são alternativas (ex.: "uma das seguintes")
//  - tipo: rótulo do tipo de linha (default 'Requisito')

const NOS_ARTE_ACAMPAR = [
  'Simples', 'Cego', 'Direito', 'Cirurgião', 'Lais de guia', 'Lais de guia duplo',
  'Escota', 'Catau', 'Pescador', 'Fateixa', 'Volta do fiel', 'Nó de gancho',
  'Volta da ribeira', 'Ordinário',
].map((n, i) => ({ sub: String.fromCharCode(97 + i), texto: n }));

export const CLASSES_EXTRA = [
  // ═══════════════════════════════════════════════════════════════════════
  {
    classe: 'Pesquisador',
    idadeMinima: 12,
    secoes: [
      {
        nome: 'I. Gerais', itens: [
          { codigo: '1', texto: 'Ter, no mínimo, 12 anos de idade.' },
          { codigo: '2', texto: 'Ser membro ativo do Clube de Desbravadores.' },
          {
            codigo: '3', texto: 'Demonstrar sua compreensão do significado da Lei do Desbravador através de uma das seguintes atividades:',
            grupoEscolha: { necessarias: 1 },
            subitens: [
              { sub: 'a', texto: 'Representação' },
              { sub: 'b', texto: 'Debate' },
              { sub: 'c', texto: 'Redação' },
            ],
          },
          { codigo: '4', texto: 'Ler o livro do Curso de Leitura do ano e escrever dois parágrafos sobre o que mais lhe chamou atenção ou considerou importante.' },
          { codigo: '5', texto: 'Ler o livro Além da magia.' },
          { codigo: '6', texto: 'Participar ativamente da Classe Bíblica do seu Clube.' },
        ],
      },
      {
        nome: 'II. Descoberta espiritual', itens: [
          { codigo: '1', texto: 'Memorizar e demonstrar o seu conhecimento:', subitens: [
            { sub: 'a', texto: 'Levítico 11: regras dos alimentos considerados comestíveis e não comestíveis.' },
          ] },
          { codigo: '2', texto: 'Ler e explicar os versos abaixo:', subitens: [
            { sub: 'a', texto: 'Eclesiastes 12:13-14' }, { sub: 'b', texto: 'Romanos 6:23' },
            { sub: 'c', texto: 'Apocalipse 1:3' }, { sub: 'd', texto: 'Isaías 43:1-2' },
            { sub: 'e', texto: 'Salmo 51:10' }, { sub: 'f', texto: 'Salmo 16' },
          ] },
          { codigo: '3', tipo: 'Leitura', texto: 'Leitura bíblica: 1 Rs 1:28-53, 3, 4:20-34, 5, 6, 8:12-60, 10, 11:6-43, 12, 16:29-33, 17:1-7, 17:8-24, 18, 19, 21, 2 Rs 2, 4:1-7, 4:8-41, 5, 6:1-23, 6:24-33, 7, 20, 22, 23:36-37, 24, 25:1-7, 2 Cr 24:1-14, 36, Ed 1, 3, 6:14-15, Ne 1, 2, 4, 8, Ester 1-8, Jó 1, 2, 42, Sl 1, 15, 19, 23, 24, 27, 37, 39, 42, 46, 67, 90-92, 97, 98, 100, 117, 119, 121, 125, 150, Pv 1, 3, 4, 10, 15, 20, 25, Ec 1.' },
          {
            codigo: '4', texto: 'Conversar com seu líder e escolher uma das seguintes histórias, demonstrando sua compreensão de como Jesus salva as pessoas:',
            grupoEscolha: { necessarias: 1 },
            subitens: [
              { sub: 'a', texto: 'João 3 – Nicodemos' }, { sub: 'b', texto: 'João 4 – A mulher samaritana' },
              { sub: 'c', texto: 'Lucas 10 – O bom samaritano' }, { sub: 'd', texto: 'Lucas 15 – O filho pródigo' },
              { sub: 'e', texto: 'Lucas 19 – Zaqueu' },
            ],
          },
        ],
      },
      {
        nome: 'III. Servindo a outros', itens: [
          { codigo: '1', texto: 'Conhecer os projetos comunitários desenvolvidos em sua cidade e participar de, pelo menos, um deles com sua Unidade ou Clube.' },
          { codigo: '2', texto: 'Participar em três atividades missionárias da igreja.' },
        ],
      },
      {
        nome: 'IV. Desenvolvendo amizade', itens: [
          { codigo: '1', texto: 'Participar de um debate ou representação sobre a pressão de grupo e identificar a influência que isso exerce sobre suas decisões.' },
          { codigo: '2', texto: 'Visitar um órgão público de sua cidade ou bairro e descobrir de que maneiras o Clube pode ser útil à sua comunidade.' },
        ],
      },
      {
        nome: 'V. Saúde e aptidão física', itens: [
          { codigo: '1', texto: 'Escolher uma das atividades abaixo e escrever um texto pessoal para um estilo de vida livre do álcool:', subitens: [
            { sub: 'a', texto: 'Participar de uma discussão em classe sobre os efeitos do álcool no organismo.' },
            { sub: 'b', texto: 'Assistir a um vídeo sobre o efeito do álcool ou outras drogas no corpo humano e conversar sobre o assunto.' },
          ] },
        ],
      },
      {
        nome: 'VI. Organização e liderança', itens: [
          { codigo: '1', texto: 'Dirigir uma cerimônia de abertura da reunião semanal do seu Clube ou um programa da Escola Sabatina.' },
          { codigo: '2', texto: 'Ajudar a organizar a Classe Bíblica do seu Clube.' },
        ],
      },
      {
        nome: 'VII. Estudo da natureza', itens: [
          { codigo: '1', texto: 'Identificar a estrela Alfa da constelação de Centauro e a constelação de Órion. Conhecer o significado espiritual de Órion, como descrito no livro Primeiros Escritos, pág. 41.' },
          { codigo: '2', texto: 'Completar uma das especialidades abaixo:', subitens: [
            { sub: 'Astronomia', texto: 'Completar a especialidade de Astronomia.', especialidadeNome: 'Astronomia' },
            { sub: 'Cactos', texto: 'Completar a especialidade de Cactos.', especialidadeNome: 'Cactos' },
            { sub: 'Climatologia', texto: 'Completar a especialidade de Climatologia.', especialidadeNome: 'Climatologia' },
            { sub: 'Flores', texto: 'Completar a especialidade de Flores.', especialidadeNome: 'Flores' },
            { sub: 'Rastreio de animais', texto: 'Completar a especialidade de Rastreio de animais.', especialidadeNome: 'Rastreio de animais' },
          ] },
        ],
      },
      {
        nome: 'VIII. Arte de acampar', itens: [
          { codigo: '1', texto: 'Apresentar seis segredos para um bom acampamento. Participar de um acampamento de final de semana, planejando e cozinhando duas refeições.' },
          { codigo: '2', texto: 'Completar uma das seguintes especialidades:', subitens: [
            { sub: 'Acampamento III', texto: 'Completar a especialidade de Acampamento III.', especialidadeNome: 'Acampamento III' },
            { sub: 'Primeiros socorros básico', texto: 'Completar a especialidade de Primeiros socorros – básico.', especialidadeNome: 'Primeiros socorros - básico' },
          ] },
          { codigo: '3', texto: 'Aprender a usar uma bússola ou GPS (urbano ou de campo) e demonstrar sua habilidade encontrando endereços em uma zona urbana.' },
        ],
      },
      {
        nome: 'IX. Estilo de vida', itens: [
          { codigo: '1', texto: 'Completar uma especialidade, não realizada anteriormente, em Artes e habilidades manuais.' },
        ],
      },
      {
        nome: 'Classe avançada – Pesquisador de Campo e Bosque', itens: [
          { codigo: '1', texto: 'Conhecer e saber usar de forma adequada a bandeira dos Desbravadores e o bandeirim de Unidade.' },
          { codigo: '2', texto: 'Ler a história de J. N. Andrews ou de um pioneiro do seu país e discutir a importância do trabalho missionário e por que Cristo ordenou a grande comissão (Mateus 28:18-20).' },
          { codigo: '3', texto: 'Convidar uma pessoa para assistir um dos seguintes programas:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Clube de Desbravadores' }, { sub: 'b', texto: 'Classe Bíblica' }, { sub: 'c', texto: 'Pequeno Grupo' },
          ] },
          { codigo: '4', texto: 'Fazer uma das seguintes especialidades:', subitens: [
            { sub: 'Asseio e cortesia cristã', texto: 'Completar a especialidade de Asseio e cortesia cristã.', especialidadeNome: 'Asseio e cortesia cristã' },
            { sub: 'Vida familiar', texto: 'Completar a especialidade de Vida familiar.', especialidadeNome: 'Vida familiar' },
          ] },
          { codigo: '5', texto: 'Participar de uma caminhada de 10 km e fazer uma lista dos equipamentos necessários, incluindo roupa e calçado que devem ser usados.' },
          { codigo: '6', texto: 'Participar na organização de um dos eventos especiais do Clube:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Investidura' }, { sub: 'b', texto: 'Admissão em lenço' }, { sub: 'c', texto: 'Dia Mundial do Desbravador' },
          ] },
          { codigo: '7', texto: 'Identificar seis pegadas de animais ou aves. Fazer um modelo em gesso, massa de modelar ou biscuit de três dessas pegadas.' },
          { codigo: '8', texto: 'Aprender a fazer as quatro amarras básicas e construir um móvel de acampamento.' },
          { codigo: '9', texto: 'Planejar um cardápio vegetariano para sua Unidade para um acampamento de três dias e apresentá-lo ao seu instrutor.' },
          { codigo: '10', texto: 'Enviar e receber uma mensagem através de uma das formas de comunicação abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Alfabeto com semáforos' }, { sub: 'b', texto: 'Código Morse com lanterna' },
            { sub: 'c', texto: 'Alfabeto Libras (língua de sinais)' }, { sub: 'd', texto: 'Alfabeto Braille' },
          ] },
          { codigo: '11', texto: 'Completar uma especialidade, não realizada anteriormente, em uma das áreas abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Habilidades domésticas' }, { sub: 'b', texto: 'Ciência e saúde' },
            { sub: 'c', texto: 'Atividades missionárias' }, { sub: 'd', texto: 'Atividades agrícolas' },
          ] },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    classe: 'Pioneiro',
    idadeMinima: 13,
    secoes: [
      {
        nome: 'I. Gerais', itens: [
          { codigo: '1', texto: 'Ter, no mínimo, 13 anos de idade.' },
          { codigo: '2', texto: 'Ser membro ativo do Clube de Desbravadores.' },
          { codigo: '3', texto: 'Memorizar e entender o Alvo e o Lema JA.' },
          { codigo: '4', texto: 'Ler o livro do Curso de Leitura do ano e resumi-lo em uma página.' },
          { codigo: '5', texto: 'Ler o livro Expedição Galápagos.' },
        ],
      },
      {
        nome: 'II. Descoberta espiritual', itens: [
          { codigo: '1', texto: 'Memorizar e demonstrar o seu conhecimento:', subitens: [
            { sub: 'a', texto: 'Bem-Aventuranças: o sermão da montanha.' },
          ] },
          { codigo: '2', texto: 'Ler e explicar os versos abaixo:', subitens: [
            { sub: 'a', texto: 'Isaías 26:3' }, { sub: 'b', texto: 'Romanos 12:12' }, { sub: 'c', texto: 'João 14:1-3' },
            { sub: 'd', texto: 'Salmo 37:5' }, { sub: 'e', texto: 'Filipenses 3:12-14' }, { sub: 'f', texto: 'Salmo 23' },
            { sub: 'g', texto: 'I Samuel 15:22' },
          ] },
          { codigo: '3', texto: 'Conversar em seu Clube ou Unidade sobre:', subitens: [
            { sub: 'a', texto: 'O que é o cristianismo' }, { sub: 'b', texto: 'Quais são as características de um verdadeiro discípulo' },
            { sub: 'c', texto: 'O que fazer para ser um cristão verdadeiro' },
          ] },
          { codigo: '4', texto: 'Participar de um estudo especial sobre a inspiração da Bíblia, com a ajuda de um pastor, trabalhando os conceitos de inspiração, revelação e iluminação.' },
          { codigo: '5', texto: 'Convidar três ou mais pessoas para assistirem a uma Classe Bíblica ou Pequeno Grupo.' },
          { codigo: '6', tipo: 'Leitura', texto: 'Leitura bíblica: Ec 3, 5, 7, 11, 12, Is 5, 11, 26:1-12, 35, 40, 43, 52:13-15, 53, 58, 60, 61, Jr 9:23-26, 10:1-16, 18:1-6, 26, 36, 52:1-11, Dn 1-12, Jl 2:12-31, Am 7:10-16, 8:4-11, Jn 1-4, Mq 4, Ag 2, Zc 4, Ml 3, 4, Mt 1-23.' },
        ],
      },
      {
        nome: 'III. Servindo a outros', itens: [
          { codigo: '1', texto: 'Participar em dois projetos missionários definidos por seu Clube.' },
          { codigo: '2', texto: 'Trabalhar em um projeto comunitário de sua igreja, escola ou comunidade.' },
        ],
      },
      {
        nome: 'IV. Desenvolvendo amizade', itens: [
          { codigo: '1', texto: 'Participar de um debate e fazer uma avaliação pessoal sobre suas atitudes em dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
            { sub: 'a', texto: 'Autoestima' }, { sub: 'b', texto: 'Amizade' }, { sub: 'c', texto: 'Relacionamentos' }, { sub: 'd', texto: 'Otimismo e pessimismo' },
          ] },
        ],
      },
      {
        nome: 'V. Saúde e aptidão física', itens: [
          { codigo: '1', texto: 'Preparar um programa pessoal de exercícios físicos diários e conversar com seu líder ou conselheiro sobre os princípios de aptidão física. Fazer e assinar um compromisso pessoal de realizar exercícios físicos regularmente.' },
          { codigo: '2', texto: 'Discutir as vantagens do estilo de vida adventista de acordo com o que a Bíblia ensina.' },
        ],
      },
      {
        nome: 'VI. Organização e liderança', itens: [
          { codigo: '1', texto: 'Assistir a um seminário ou treinamento oferecido pela sua igreja ou distrito nos departamentos abaixo:', subitens: [
            { sub: 'a', texto: 'Ministério Pessoal' }, { sub: 'b', texto: 'Evangelismo' },
          ] },
          { codigo: '2', texto: 'Participar de uma atividade social de sua igreja.' },
        ],
      },
      {
        nome: 'VII. Estudo da natureza', itens: [
          { codigo: '1', texto: 'Estudar a história do dilúvio e o processo de fossilização.' },
          { codigo: '2', texto: 'Completar uma especialidade não realizada anteriormente em Estudo da natureza.' },
        ],
      },
      {
        nome: 'VIII. Arte de acampar', itens: [
          { codigo: '1', texto: 'Fazer um fogo refletor e demonstrar seu uso.' },
          { codigo: '2', texto: 'Participar de um acampamento de final de semana, arrumando de forma apropriada sua bolsa ou mochila com o equipamento pessoal necessário.' },
          { codigo: '3', texto: 'Completar a especialidade de Resgate básico.', especialidadeNome: 'Resgate básico' },
        ],
      },
      {
        nome: 'IX. Estilo de vida', itens: [
          { codigo: '1', texto: 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Atividades missionárias e comunitárias' }, { sub: 'b', texto: 'Atividades profissionais' }, { sub: 'c', texto: 'Atividades agrícolas e afins' },
          ] },
        ],
      },
      {
        nome: 'Classe avançada – Pioneiro de Novas Fronteiras', itens: [
          { codigo: '1', texto: 'Completar a especialidade de Cidadania cristã, caso não tenha sido realizada anteriormente.', especialidadeNome: 'Cidadania cristã' },
          { codigo: '2', texto: 'Encenar a história do bom samaritano, demonstrando como ajudar as pessoas e auxiliar de forma prática três pessoas ou mais.' },
          { codigo: '3', texto: 'Participar de uma das seguintes atividades, apresentando ao final um relatório escrito contendo, no mínimo, duas páginas:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Caminhar 10 km' }, { sub: 'b', texto: 'Cavalgar 2 km' }, { sub: 'c', texto: 'Viajar de canoa durante 2 horas' },
            { sub: 'd', texto: 'Praticar 15 km de ciclismo' }, { sub: 'e', texto: 'Nadar 200 metros' }, { sub: 'f', texto: 'Correr 1500 metros' },
            { sub: 'g', texto: 'Rodar 2 km de patins ou roller' },
          ] },
          { codigo: '4', texto: 'Completar a especialidade de Mapa e bússola.', especialidadeNome: 'Mapa e bússola' },
          { codigo: '5', texto: 'Demonstrar habilidade no uso correto de uma machadinha.' },
          { codigo: '6', texto: 'Ser capaz de acender uma fogueira em dia de chuva, saber como conseguir lenha seca e manter o fogo aceso.' },
          { codigo: '7', texto: 'Completar um dos seguintes itens:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Pesquisar e identificar 10 variedades de plantas silvestres comestíveis.' },
            { sub: 'b', texto: 'Ser capaz de enviar e receber 35 letras por minuto pelo código semafórico.' },
            { sub: 'c', texto: 'Ser capaz de enviar e receber 35 letras por minuto através do código náutico, usando o código internacional.' },
            { sub: 'd', texto: 'Ser capaz de apresentar e entender Mateus 24 em Libras (língua de sinais).' },
            { sub: 'e', texto: 'Preparar o Salmo 23 em braille.' },
          ] },
          { codigo: '8', texto: 'Completar uma especialidade, não realizada anteriormente, em Atividades recreativas.' },
          { codigo: '9', texto: 'Pesquisar e identificar, através de fotografia, exposição ou ao vivo, um dos seguintes itens:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: '25 folhas de árvores' }, { sub: 'b', texto: '25 rochas e minerais' }, { sub: 'c', texto: '25 flores silvestres' },
            { sub: 'd', texto: '25 borboletas e mariposas' }, { sub: 'e', texto: '25 conchas' },
          ] },
          { codigo: '10', texto: 'Completar a especialidade de Fogueiras e cozinha ao ar livre.', especialidadeNome: 'Fogueiras e cozinha ao ar livre' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    classe: 'Excursionista',
    idadeMinima: 14,
    secoes: [
      {
        nome: 'I. Gerais', itens: [
          { codigo: '1', texto: 'Ter, no mínimo, 14 anos de idade.' },
          { codigo: '2', texto: 'Ser membro ativo do Clube de Desbravadores.' },
          { codigo: '3', texto: 'Memorizar e explicar o significado do Objetivo JA.' },
          { codigo: '4', texto: 'Ler o livro do Curso de Leitura do ano e resumi-lo em uma página.' },
          { codigo: '5', texto: 'Ler o livro O fim do começo.' },
        ],
      },
      {
        nome: 'II. Descoberta espiritual', itens: [
          { codigo: '1', texto: 'Memorizar e demonstrar o seu conhecimento:', subitens: [
            { sub: 'a', texto: 'Apóstolos: o nome dos 12 apóstolos de Cristo.' },
            { sub: 'b', texto: 'Fruto do Espírito: a relação de adjetivos do caráter do cristão.' },
          ] },
          { codigo: '2', texto: 'Ler e explicar os versos abaixo:', subitens: [
            { sub: 'a', texto: 'Romanos 8:28' }, { sub: 'b', texto: 'Apocalipse 21:1-3' }, { sub: 'c', texto: 'II Pedro 1:20-21' },
            { sub: 'd', texto: 'I João 2:14' }, { sub: 'e', texto: 'II Crônicas 20:20' }, { sub: 'f', texto: 'Salmo 46' },
          ] },
          { codigo: '3', texto: 'Estudar e entender a pessoa do Espírito Santo, como Ele se relaciona, e qual o Seu papel no crescimento espiritual de cada ser humano.' },
          { codigo: '4', texto: 'Estudar, com sua Unidade, os eventos finais e a segunda vinda de Cristo.' },
          { codigo: '5', texto: 'Através do estudo da Bíblia, descobrir o verdadeiro significado da observância do sábado.' },
          { codigo: '6', tipo: 'Leitura', texto: 'Leitura bíblica: Mt 24-28, Mc 7, 9-12, 16, Lc 1, 2, 7:18-28, 8, 10-19, 21-24, Jo 1-6, 8-15, 17-21, At 1-8.' },
        ],
      },
      {
        nome: 'III. Servindo a outros', itens: [
          { codigo: '1', texto: 'Convidar um amigo para participar de uma atividade social de sua igreja ou da Associação/Missão.' },
          { codigo: '2', texto: 'Participar de um projeto comunitário desde o planejamento, organização até a execução.' },
          { codigo: '3', texto: 'Discutir como os jovens adventistas devem se relacionar com as pessoas nas diferentes situações do dia a dia, tais como:', subitens: [
            { sub: 'a', texto: 'Vizinhos' }, { sub: 'b', texto: 'Escola' }, { sub: 'c', texto: 'Atividades sociais' }, { sub: 'd', texto: 'Atividades recreativas' },
          ] },
        ],
      },
      {
        nome: 'IV. Desenvolvendo amizade', itens: [
          { codigo: '1', texto: 'Através de uma conversa em grupo ou avaliação pessoal, examinar suas atitudes em dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
            { sub: 'a', texto: 'Autoestima' }, { sub: 'b', texto: 'Relacionamento familiar' }, { sub: 'c', texto: 'Finanças pessoais' }, { sub: 'd', texto: 'Pressão de grupo' },
          ] },
          { codigo: '2', texto: 'Preparar uma lista contendo cinco sugestões de atividades recreativas para ajudar pessoas com necessidades específicas e colaborar na organização de uma dessas atividades para essas pessoas.' },
        ],
      },
      {
        nome: 'V. Saúde e aptidão física', itens: [
          { codigo: '1', texto: 'Completar a especialidade de Temperança.', especialidadeNome: 'Temperança' },
        ],
      },
      {
        nome: 'VI. Organização e liderança', itens: [
          { codigo: '1', texto: 'Preparar um organograma da igreja local e relacionar as funções dos departamentos.' },
          { codigo: '2', texto: 'Participar de dois programas envolvendo diferentes departamentos da igreja local.' },
          { codigo: '3', texto: 'Completar a especialidade de Aventuras com Cristo.', especialidadeNome: 'Aventuras com Cristo' },
        ],
      },
      {
        nome: 'VII. Estudo da natureza', itens: [
          { codigo: '1', texto: 'Recapitular a história de Nicodemos e relacioná-la com o ciclo de vida da lagarta ou borboleta, acrescentando um significado espiritual.' },
          { codigo: '2', texto: 'Completar uma especialidade em Estudo da natureza, não realizada anteriormente.' },
        ],
      },
      {
        nome: 'VIII. Arte de acampar', itens: [
          { codigo: '1', texto: 'Com um grupo de, no mínimo, quatro pessoas e com a presença de um conselheiro adulto e experiente, andar pelo menos 20 km numa área rural ou deserta, incluindo uma noite ao ar livre ou em barraca. Planejar a expedição em detalhes antes da saída. Durante a caminhada, efetuar anotações sobre o terreno, flora e fauna observados. Depois, usando as anotações, participar de uma discussão em grupo, dirigida por seu conselheiro.' },
          { codigo: '2', texto: 'Completar a especialidade de Pioneirias.', especialidadeNome: 'Pioneirias' },
        ],
      },
      {
        nome: 'IX. Estilo de vida', itens: [
          { codigo: '1', texto: 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Atividades missionárias e comunitárias' }, { sub: 'b', texto: 'Atividades agrícolas e afins' },
            { sub: 'c', texto: 'Ciência e saúde' }, { sub: 'd', texto: 'Habilidades domésticas' },
          ] },
        ],
      },
      {
        nome: 'Classe avançada – Excursionista na Mata', itens: [
          { codigo: '1', texto: 'Fazer uma apresentação escrita ou falada sobre o respeito que devemos ter com a Lei de Deus e as autoridades civis, enumerando 10 princípios de comportamento moral.' },
          { codigo: '2', texto: 'Acompanhar seu pastor ou ancião numa visita missionária ou estudo bíblico.' },
          { codigo: '3', texto: 'Completar a especialidade de Testemunho juvenil.', especialidadeNome: 'Testemunho juvenil' },
          { codigo: '4', texto: 'Apresentar cinco atividades na natureza, para serem realizadas no sábado à tarde.' },
          { codigo: '5', texto: 'Com sua Unidade, construir um móvel de acampamento e um portal para o Clube.' },
          { codigo: '6', texto: 'Através da supervisão de seu líder ou conselheiro, conversar em sua Unidade ou Clube sobre um dos seguintes temas:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Modéstia cristã' }, { sub: 'b', texto: 'Recreação' }, { sub: 'c', texto: 'Saúde' }, { sub: 'd', texto: 'Observância do sábado' },
          ] },
          { codigo: '7', texto: 'Demonstrar conhecimento para encontrar alimentos através de plantas silvestres de sua região e saber diferenciá-las de plantas tóxicas/venenosas.' },
          { codigo: '8', texto: 'Demonstrar conhecimento quanto aos procedimentos necessários em caso de ferimentos por diferentes animais peçonhentos e não peçonhentos.' },
          { codigo: '9', texto: 'Demonstrar técnicas para percorrer trilhas em diferentes tipos de terrenos, como: desertos, florestas, pântanos e rios.' },
          { codigo: '10', texto: 'Completar a especialidade de Ordem unida.', especialidadeNome: 'Ordem unida' },
          { codigo: '11', texto: 'Completar a especialidade de Vida silvestre.', especialidadeNome: 'Vida silvestre' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    classe: 'Guia',
    idadeMinima: 15,
    secoes: [
      {
        nome: 'I. Gerais', itens: [
          { codigo: '1', texto: 'Ter, no mínimo, 15 anos de idade.' },
          { codigo: '2', texto: 'Ser membro ativo do Clube de Desbravadores.' },
          { codigo: '3', texto: 'Memorizar e explicar o Voto de Fidelidade à Bíblia.' },
          { codigo: '4', texto: 'Ler o livro do Curso de Leitura do ano e resumi-lo em uma página.' },
          { codigo: '5', texto: 'Ler o livro O livro amargo.' },
        ],
      },
      {
        nome: 'II. Descoberta espiritual', itens: [
          { codigo: '1', texto: 'Memorizar e demonstrar o seu conhecimento:', subitens: [
            { sub: 'a', texto: '3 Mensagens Angélicas: reveladas em Apocalipse 14:6-12.' },
            { sub: 'b', texto: '7 Igrejas: o nome das igrejas do Apocalipse.' },
            { sub: 'c', texto: 'Pedras preciosas: os 12 fundamentos da Cidade Santa – A Nova Jerusalém.' },
          ] },
          { codigo: '2', texto: 'Ler e explicar os versos abaixo:', subitens: [
            { sub: 'a', texto: 'I Coríntios 13' }, { sub: 'b', texto: 'II Crônicas 7:14' }, { sub: 'c', texto: 'Apocalipse 22:18-20' },
            { sub: 'd', texto: 'II Timóteo 4:6-7' }, { sub: 'e', texto: 'Romanos 8:38-39' }, { sub: 'f', texto: 'Mateus 6:33-34' },
          ] },
          { codigo: '3', texto: 'Descrever os dons espirituais mencionados nos escritos de Paulo (Coríntios, Efésios, Filipenses) e para quais objetivos a igreja recebe esses dons.' },
          { codigo: '4', texto: 'Estudar a estrutura e serviço do santuário no Antigo Testamento e relacionar com o ministério pessoal de Jesus e a cruz.' },
          { codigo: '5', texto: 'Ler e resumir três histórias de pioneiros adventistas. Contar essas histórias na reunião do Clube, no culto JA ou na Escola Sabatina.' },
          { codigo: '6', tipo: 'Leitura', texto: 'Leitura bíblica: At 9-28, Rm 12-14, 1 Co 13, 2 Co 5, 11, 12, Gl 5, 6, Ef 5, 6, Fp 4, Cl 3, 1 Ts 4, 5, 2 Ts 2, 3, 1 Tm 4-6, 2 Tm 2, 3, Fm, Hb 11, Tg 1, 3, 5, 1 Pe 1, 5, 2 Pe 3, 1 Jo 2-5, Jd 17-25, Ap 1-3, 7, 12-14, 19-21.' },
        ],
      },
      {
        nome: 'III. Servindo a outros', itens: [
          { codigo: '1', texto: 'Ajudar a organizar e participar de uma das seguintes atividades:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Fazer uma visita de cortesia a uma pessoa doente' },
            { sub: 'b', texto: 'Adotar uma pessoa ou família em necessidade e ajudá-los' },
            { sub: 'c', texto: 'Um projeto de sua escolha aprovado por seu líder' },
          ] },
          { codigo: '2', texto: 'Discutir com sua Unidade os métodos de evangelismo pessoal e colocar alguns princípios em prática.' },
        ],
      },
      {
        nome: 'IV. Desenvolvendo amizade', itens: [
          { codigo: '1', texto: 'Assistir a uma palestra ou aula e examinar suas atitudes em relação a dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
            { sub: 'a', texto: 'A importância da escolha profissional' }, { sub: 'b', texto: 'Como se relacionar com os pais' },
            { sub: 'c', texto: 'A escolha da pessoa certa para namorar' }, { sub: 'd', texto: 'O plano de Deus para o sexo' },
          ] },
        ],
      },
      {
        nome: 'V. Saúde e aptidão física', itens: [
          { codigo: '1', texto: 'Fazer uma apresentação, para o seu Clube ou Unidade, sobre os oito remédios naturais dados por Deus.' },
          { codigo: '2', texto: 'Completar uma das seguintes atividades:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Escrever uma poesia ou artigo sobre saúde para ser divulgado em uma revista, boletim ou jornal da igreja' },
            { sub: 'b', texto: 'Individualmente ou em grupo, organizar e participar de uma corrida ou atividade similar e apresentar com antecedência um programa de treinamento físico para este evento' },
            { sub: 'c', texto: 'Ler as páginas 102-125 do livro Temperança, de Ellen White, e apresentar em uma página ou mais, 10 textos selecionados da leitura' },
            { sub: 'd', texto: 'Completar a especialidade de Nutrição ou liderar um grupo para a especialidade de Cultura física' },
          ] },
        ],
      },
      {
        nome: 'VI. Organização e liderança', itens: [
          { codigo: '1', texto: 'Preparar um organograma da estrutura administrativa da Igreja Adventista em sua Divisão.' },
          { codigo: '2', texto: 'Participar em um dos itens abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Curso para conselheiros' }, { sub: 'b', texto: 'Convenção de liderança da Associação/Missão' }, { sub: 'c', texto: 'Duas reuniões de diretoria do seu Clube' },
          ] },
          { codigo: '3', texto: 'Planejar e ensinar, no mínimo, dois requisitos de uma especialidade para um grupo ou Unidade de Desbravadores.' },
        ],
      },
      {
        nome: 'VII. Estudo da natureza', itens: [
          { codigo: '1', texto: 'Ler o capítulo 7 do livro O Desejado de Todas as Nações sobre a infância de Jesus. Apresentar para um grupo, Clube ou Unidade as lições encontradas, demonstrando a importância que o estudo da natureza exerceu na educação e ministério de Jesus.' },
          { codigo: '2', texto: 'Completar uma das seguintes especialidades:', subitens: [
            { sub: 'Ecologia', texto: 'Completar a especialidade de Ecologia.', especialidadeNome: 'Ecologia' },
            { sub: 'Conservação ambiental', texto: 'Completar a especialidade de Conservação ambiental.', especialidadeNome: 'Conservação ambiental' },
          ] },
        ],
      },
      {
        nome: 'VIII. Arte de acampar', itens: [
          { codigo: '1', texto: 'Participar com sua Unidade de um acampamento com estrutura de pioneiria, planejar o que deve ser levado e o que vai acontecer neste acampamento.' },
          { codigo: '2', texto: 'Planejar, preparar e cozinhar três refeições ao ar livre.' },
          { codigo: '3', texto: 'Construir e utilizar um móvel de acampamento em tamanho real, com nós e amarras.' },
          { codigo: '4', texto: 'Completar uma especialidade, não realizada anteriormente, que possa ser contada para um dos mestrados abaixo:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Aquática' }, { sub: 'b', texto: 'Esportes' }, { sub: 'c', texto: 'Atividades recreativas' }, { sub: 'd', texto: 'Vida campestre' },
          ] },
        ],
      },
      {
        nome: 'IX. Estilo de vida', itens: [
          { codigo: '1', texto: 'Completar uma especialidade, não realizada anteriormente, em uma das seguintes áreas:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Atividades recreativas' }, { sub: 'b', texto: 'Ciência e saúde' }, { sub: 'c', texto: 'Habilidades domésticas' }, { sub: 'd', texto: 'Atividades profissionais' },
          ] },
        ],
      },
      {
        nome: 'Classe avançada – Guia de Exploração', itens: [
          { codigo: '1', texto: 'Completar a especialidade de Mordomia.', especialidadeNome: 'Mordomia' },
          { codigo: '2', texto: 'Ler o livro O maior discurso de Cristo e escrever uma página sobre o efeito da leitura em sua vida.' },
          { codigo: '3', texto: 'Cumprir um dos seguintes itens:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Trazer dois amigos para assistir a duas diferentes reuniões da igreja' },
            { sub: 'b', texto: 'Ajudar a planejar e participar de, no mínimo, quatro domingos em uma série de evangelismo jovem' },
          ] },
          { codigo: '4', texto: 'Escrever uma página ou apresentar uma palestra sobre como influenciar amigos para Cristo.' },
          { codigo: '5', texto: 'Observar durante o período de dois meses o trabalho dos diáconos, apresentando um relatório detalhado de suas atividades, contendo:', subitens: [
            { sub: 'a', texto: 'Cuidado da propriedade da igreja' }, { sub: 'b', texto: 'Cerimônia de lava-pés' },
            { sub: 'c', texto: 'Cerimônia de batismo' }, { sub: 'd', texto: 'Recolhimento dos dízimos e ofertas' },
          ] },
          { codigo: '6', texto: 'Completar uma especialidade, não realizada anteriormente, para o mestrado em Vida campestre.' },
          { codigo: '7', texto: 'Projetar três tipos diferentes de abrigo, explicar seu uso e utilizar um deles em um acampamento.' },
          { codigo: '8', texto: 'Assistir a um seminário ou apresentar uma palestra sobre dois dos seguintes temas:', grupoEscolha: { necessarias: 2 }, subitens: [
            { sub: 'a', texto: 'Aborto' }, { sub: 'b', texto: 'Bullying' }, { sub: 'c', texto: 'Violência' }, { sub: 'd', texto: 'Drogas' }, { sub: 'e', texto: 'Infecções sexualmente transmissíveis' },
          ] },
          { codigo: '9', texto: 'Completar a especialidade de Liderança campestre.', especialidadeNome: 'Liderança campestre' },
          { codigo: '10', texto: 'Completar a especialidade de Orçamento familiar.', especialidadeNome: 'Orçamento familiar' },
        ],
      },
    ],
  },
];

// Líder e Líder Máster não têm faixa etária (usam pré-requisitos próprios) e por
// isso ficam num array separado — sem idadeMinima nem vínculo com "documento_identidade".
export const CLASSES_LIDERANCA = [
  {
    classe: 'Líder',
    secoes: [
      {
        nome: 'Pré-requisitos', itens: [
          { codigo: '1', texto: 'Ter, no mínimo, 16 anos completos para iniciar a classe e, no mínimo, 18 anos completos para a investidura; ser membro batizado da IASD; possuir recomendação por escrito da comissão de sua igreja.' },
          { codigo: '2', texto: 'Ter concluído todas as classes regulares, ou estar simultaneamente cumprindo os requisitos de classes agrupadas e líder.' },
          { codigo: '3', texto: 'Ser membro ativo de um Clube ou estar participando de uma coordenação distrital ou regional, com cadastro atualizado no SGC.' },
        ],
      },
      {
        nome: 'I. Crescimento pessoal e espiritual', itens: [
          { codigo: '1', texto: 'Fazer um dos seguintes:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Completar o ano bíblico.' }, { sub: 'b', texto: 'Ler a Bíblia toda em dois anos.' },
          ] },
          { codigo: '2', texto: 'Ler o livro O Libertador, de Ellen White, e apresentar uma reação à leitura de duas páginas.' },
          { codigo: '3', texto: 'Selecionar e ler um livro sobre liderança ou desenvolvimento juvenil, e apresentar uma reação à leitura de duas páginas.' },
          { codigo: '4', texto: 'Demonstrar o crescimento de sua liderança e habilidade no ensino, completando quatro dos seguintes requisitos:', grupoEscolha: { necessarias: 4 }, subitens: [
            { sub: 'a', texto: 'Fazer uma dissertação sobre a arte de falar para adolescentes, de três a quatro páginas.' },
            { sub: 'b', texto: 'Ajudar no treinamento de uma equipe para um evento dos desbravadores de sua Associação/Missão.' },
            { sub: 'c', texto: 'Ensinar duas especialidades para uma unidade ou classe.' },
            { sub: 'd', texto: 'Planejar e coordenar um acampamento de clube ou unidade.' },
            { sub: 'e', texto: 'Assistir, no mínimo, a 75% das reuniões de diretoria durante o ano e fazer um relatório de sua participação.' },
            { sub: 'f', texto: 'Participar ou liderar um Pequeno Grupo por, no mínimo, seis meses.' },
          ] },
          { codigo: '5', texto: 'Conduzir ou colaborar na liderança de um dos seguintes:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Classe de juvenis ou adolescentes, por pelo menos seis meses.' },
            { sub: 'b', texto: 'Projeto "Desbravador por um dia".' },
            { sub: 'c', texto: 'Feira de saúde ou Escola Cristã de Férias.' },
            { sub: 'd', texto: 'Calebe de lenço.' },
          ] },
          { codigo: '6', texto: 'Estudar o Manual Administrativo do Clube de Desbravadores e prestar o exame preparado pela DSA, com nota mínima de 7,0 (70%).' },
          { codigo: '7', texto: 'Estudar o livro Nisto Cremos – crenças fundamentais 1 a 10, e prestar o exame preparado pela DSA, com nota mínima de 7,0 (70%).' },
        ],
      },
      {
        nome: 'II. Fundamentos do aconselhamento dos desbravadores', itens: [
          { codigo: '1', texto: 'Participar de um seminário de quatro horas dirigido pelo Ministério de Desbravadores e Aventureiros da Associação/Missão sobre o papel do conselheiro.' },
          { codigo: '2', texto: 'Ser conselheiro, conselheiro associado, instrutor, diretor, diretor associado, secretário ou capelão do clube por, no mínimo, um ano.' },
          { codigo: '3', texto: 'Fazer o curso do Estatuto da Criança e do Adolescente aplicado aos Desbravadores no SGC-EaD e apresentar o certificado impresso.' },
          { codigo: '4', texto: 'Ler os capítulos 4, 5, 6, 7, 8 e 31 do livro Orientação da Criança, de Ellen White, e apresentar uma reação à leitura de uma página.' },
          { codigo: '5', texto: 'Fazer pelo menos quatro visitas (uma por trimestre) à família de um desbravador com o propósito de inspirar confiança nos pais e compreender melhor o seu desbravador. Se for permitido, fazer uma breve meditação e/ou oração com a família.' },
        ],
      },
      {
        nome: 'III. Serviço ao Clube', itens: [
          { codigo: '1', texto: 'Ser instrutor de uma classe regular até a investidura.' },
          { codigo: '2', texto: 'Completar um destes mestrados: Zoologia, Botânica ou Atividades recreativas.', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Zoologia' }, { sub: 'b', texto: 'Botânica' }, { sub: 'c', texto: 'Atividades recreativas' },
          ] },
          { codigo: '3', texto: 'Completar a especialidade de Arte de contar histórias cristãs.', especialidadeNome: 'Arte de contar histórias cristãs' },
        ],
      },
      {
        nome: 'IV. Liderança aplicada', itens: [
          { codigo: '1', texto: 'Apresentar o certificado de participação em um curso de Treinamento de Diretoria – nível básico, com duração de no mínimo seis horas, realizado pelo Ministério de Desbravadores da Associação/Missão ou região.' },
          { codigo: '2', texto: 'Participar de um curso de liderança de 10 horas realizado pelo Ministério de Desbravadores e Aventureiros da Associação/Missão e apresentar o certificado.' },
          { codigo: '3', texto: 'Participar de um dos projetos missionários abaixo por sete dias ou mais:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Missão Calebe/Calebe de Lenço.' }, { sub: 'b', texto: 'Evangelismo público.' },
            { sub: 'c', texto: 'Semana santa.' }, { sub: 'd', texto: 'Semana de colheita.' },
          ] },
        ],
      },
    ],
  },
  {
    classe: 'Líder Máster',
    secoes: [
      {
        nome: 'Pré-requisitos', itens: [
          { codigo: '1', texto: 'Ter, no mínimo, um ano de experiência como líder investido para começar a cumprir os requisitos.' },
          { codigo: '2', texto: 'Ter 18 anos completos para iniciar esta classe; ser membro ativo da IASD; possuir recomendação por escrito da comissão de sua igreja.' },
          { codigo: '3', texto: 'Ser membro ativo de um clube ou estar participando de uma coordenação distrital ou regional, com cadastro atualizado no SGC.' },
        ],
      },
      {
        nome: 'I. Crescimento pessoal e espiritual', itens: [
          { codigo: '1', texto: 'Escolher e completar um dos seguintes hábitos devocionais:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Ano bíblico.' }, { sub: 'b', texto: 'Ano bíblico em áudio.' },
          ] },
          { codigo: '2', texto: 'Ler os capítulos 2, 3, 10, 11, 13, 18, 19, 20, 23, 24, 25, 26, 32, 34, 35, 37, 38, 39 e 42 do livro A Ciência do Bom Viver e apresentar uma reação à leitura de uma página.' },
          { codigo: '3', texto: 'Estudar o livro Nisto Cremos – crenças fundamentais 11 a 20, e prestar o exame preparado pela DSA, com nota mínima de 7,0 (70%).' },
          { codigo: '4', texto: 'Realizar um dos seguintes:', grupoEscolha: { necessarias: 1 }, subitens: [
            { sub: 'a', texto: 'Conduzir uma série completa de estudos bíblicos para a família de um desbravador não adventista.' },
            { sub: 'b', texto: 'Dirigir uma série de estudos bíblicos para uma classe bíblica visando ao batismo da primavera.' },
          ] },
          { codigo: '5', texto: 'Apresentar o certificado do curso de Treinamento de Diretoria – nível avançado.' },
          { codigo: '6', texto: 'Participar do curso de liderança para líder máster, realizado pela Associação/Missão, e apresentar o certificado.' },
        ],
      },
      {
        nome: 'II. Serviço ao Clube', itens: [
          { codigo: '1', texto: 'Ensinar uma classe regular e uma avançada durante um ano.' },
          { codigo: '2', texto: 'Ser conselheiro, diretor, diretor associado, secretário ou capelão do clube por, no mínimo, oito meses.' },
        ],
      },
      {
        nome: 'III. Capacitação aplicada', itens: [
          { codigo: '1', texto: 'Preparar, com recursos visuais e por escrito (duas páginas), um cronograma indicando os principais eventos na história da Igreja Adventista do Sétimo Dia, dando enfoque especial à sua Divisão, União e Campo. Apresentar a um grupo de pelo menos seis pessoas.' },
          { codigo: '2', texto: 'Escolher duas das áreas abaixo e ler um livro em cada uma delas, apresentando uma reação à leitura de uma página cada:', grupoEscolha: { necessarias: 2 }, subitens: [
            { sub: 'a', texto: 'Liderança' }, { sub: 'b', texto: 'Processo de aprendizagem' }, { sub: 'c', texto: 'Desenvolvimento do adolescente' },
            { sub: 'd', texto: 'Habilidades pessoais' }, { sub: 'e', texto: 'Desenvolvimento pessoal' }, { sub: 'f', texto: 'Comunicação e relacionamentos' },
          ] },
          {
            codigo: '3',
            texto: 'Selecionar e completar duas das sete áreas abaixo, cumprindo integralmente todos os subitens da área escolhida:',
            grupoEscolha: { necessarias: 2 },
            subitens: [
              {
                sub: 'Área 1', texto: 'Área 1 – Administração e Relações Humanas:\n' +
                  '1.1 Apresentar um planejamento anual detalhado para o seu clube.\n' +
                  '1.2 Apresentar o calendário para ensinar todos os requisitos de uma classe regular e de uma avançada durante um ano.\n' +
                  '1.3 Preparar o organograma de seu clube com os cargos, funções e as atividades desenvolvidas.\n' +
                  '1.4 Apresentar um seminário de 30 minutos sobre um dos seguintes assuntos: bullying, prevenção do abuso infantil ou violência doméstica.\n' +
                  '1.5 Ter a especialidade de Pacificador.',
              },
              {
                sub: 'Área 2', texto: 'Área 2 – Acampamento:\n' +
                  '2.1 Planejar e dirigir um acampamento para o seu clube.\n' +
                  '2.2 Fazer e utilizar quatro tipos de fogueiras em um evento ou acampamento.\n' +
                  '2.3 Durante um acampamento, dirigir uma simulação de busca e resgate de um acidentado, visando instruir e orientar o clube como agir nestas circunstâncias.\n' +
                  '2.4 Dirigir uma atividade na natureza, própria para o sábado.',
              },
              {
                sub: 'Área 3', texto: 'Área 3 – Evangelismo Juvenil e Atividades Comunitárias:\n' +
                  '3.1 Dirigir dois projetos evangelísticos em PG, ponto de pregação ou na igreja, com o clube ou unidade. Escolher entre: a) Voz juvenil, b) Semana santa, c) Semana de colheita, d) Classe bíblica, e) Classe bíblica juvenil.\n' +
                  '3.2 Planejar e dirigir um projeto comunitário de acordo com as necessidades de sua região.\n' +
                  '3.3 Ler os capítulos 1 e 2 do livro Serviço Cristão e apresentar uma reação à leitura de uma página.',
              },
              {
                sub: 'Área 4', texto: 'Área 4 – Criatividade:\n' +
                  '4.1 Implantar uma ideia criativa para fortalecer o clube em três das seguintes áreas: a) Reunião geral do clube, b) Devocional, c) Cantinho da unidade, d) Instrução de especialidades, e) Instrução de classes regulares e avançadas.\n' +
                  '4.2 Apresentar uma avaliação das medidas implantadas abordando: a) Qual problema foi resolvido? b) Qual foi a forma de resolver? c) Qual resultado foi alcançado? d) Coletar a opinião de outros membros da direção sobre como eles avaliam a execução da ideia e os resultados alcançados.\n' +
                  '4.3 Preparar e apresentar a pelo menos uma unidade, dois estudos bíblicos criativos.',
              },
              {
                sub: 'Área 5', texto: 'Área 5 – Ordem Unida e Civismo:\n' +
                  '5.1 Planejar e conduzir um desfile cívico em um evento especial.\n' +
                  '5.2 Coordenar o hasteamento das bandeiras em uma reunião do clube ou evento da região/Campo.\n' +
                  '5.3 Comandar uma demonstração de comandos de ordem unida com uma unidade ou clube por pelo menos cinco minutos.\n' +
                  '5.4 Ensinar a especialidade de Ordem unida para uma unidade ou clube.',
              },
              {
                sub: 'Área 6', texto: 'Área 6 – Educação Campestre:\n' +
                  '6.1 Planejar e dirigir uma corrida de orientação com pelo menos duas unidades.\n' +
                  '6.2 Listar cinco lugares em sua região onde o clube pode realizar atividades ao ar livre, apresentando os pontos positivos e negativos de cada um. Realizar uma atividade com uma unidade ou clube em um deles.\n' +
                  '6.3 Planejar e ensinar uma especialidade ao ar livre.\n' +
                  '6.4 Apresentar a um clube ou região um seminário de educação ambiental de, no mínimo, 30 minutos, contemplando pelo menos quatro dos seguintes assuntos: a) Uso do fogo e prevenção de incêndios, b) Uso consciente da água, c) Formas de obter água potável, d) Identificação de plantas tóxicas ou venenosas, e) Sanitarismo no acampamento, f) Escolha de locais seguros para acampar.',
              },
              {
                sub: 'Área 7', texto: 'Área 7 – Recreação:\n' +
                  '7.1 Escrever cinco princípios para guiar a escolha de uma recreação saudável.\n' +
                  '7.2 Criar um jogo para auxiliar na instrução de um requisito de uma classe.\n' +
                  '7.3 Apresentar 10 atividades recreativas que o clube possa realizar, sendo cinco gerais e cinco apropriadas para sábado à tarde.',
              },
            ],
          },
        ],
      },
      {
        nome: 'Classe avançada – Pré-requisitos', itens: [
          { codigo: '1', texto: 'Atividades realizadas em classes anteriores não podem ser reaproveitadas. Ter completado 20 anos de idade, no mínimo, quando investido nesta classe.' },
          { codigo: '2', texto: 'Haver sido investido na classe de Líder Máster.' },
          { codigo: '3', texto: 'Possuir uma recomendação para investidura, por escrito, da comissão de sua igreja.' },
          { codigo: '4', texto: 'NOTA: é requerido aos participantes completar esta classe no período de até dois anos.' },
        ],
      },
      {
        nome: 'Classe avançada – Seção I - Treinamento em Serviço', itens: [
          { codigo: '1', texto: 'Manter responsabilidade na diretoria de um clube por um ano, pelo menos. Durante esse período, assistir no mínimo de 75% das reuniões administrativas.' },
          { codigo: '2', texto: 'Ensinar uma Classe Regular por um período mínimo de cinco meses.' },
        ],
      },
      {
        nome: 'Classe avançada – Seção II - Desenvolvimento de Novas Habilidades', itens: [
          {
            codigo: '1',
            texto: 'Completar os requisitos de uma das seguintes áreas (assinale a área escolhida):',
            grupoEscolha: { necessarias: 1 },
            subitens: [
              {
                sub: 'Área I', texto: 'Área I – Administração e Relações Humanas:\n' +
                  '1. Participar de um seminário organizado pelo Ministério Jovem de sua Associação ou Missão sobre Administração, Comunicação e Dons Espirituais, com 10 horas de duração, no mínimo.\n' +
                  '2. Apresentar ao seu Regional um esboço detalhado do funcionamento do seu clube.\n' +
                  '3. Realizar um assessoramento completo dos processos administrativos de seu clube, incluindo aspectos positivos e negativos.\n' +
                  '4. Desenvolver um "Código de Disciplina" para o seu clube.\n' +
                  '5. Escrever, pelo menos, quatro páginas sobre: a) uma modalidade especial ou nova da administração de um Clube e que será de benefício para o seu funcionamento; ou b) liderança cristã.',
              },
              {
                sub: 'Área II', texto: 'Área II – Acampamento:\n' +
                  '1. Organizar e liderar uma expedição de acampamento em duas das áreas a seguir, apresentando ao final uma avaliação: a) inverno (chuva e frio); b) mochila; c) na água.\n' +
                  '2. Refazer todos os requisitos que tratem sobre a Arte de Acampar, desde Amigo até Guia.\n' +
                  '3. Apresentar um estudo especial, demonstrando o lugar de pioneirismo no Clube de Desbravadores e: a) construir quatro móveis campestres, cada um tendo no mínimo seis nós ou amarras diferentes; b) desenhar duas trilhas de eventos com 10 diferentes atividades cada uma, e descrever seu propósito; c) desenhar e construir uma ponte de, no mínimo, 2 metros de comprimento.',
              },
              {
                sub: 'Área III', texto: 'Área III – Evangelismo Juvenil e Atividades Comunitárias:\n' +
                  '1. Assistir a um seminário de 8 horas sobre evangelismo jovem ou juvenil.\n' +
                  '2. Completar dois dos seguintes: a) desenvolver um programa de testemunho para um ano que possa ser realizado por uma unidade ou clube; b) determinar os dons espirituais de um grupo de Desbravadores e planejar um programa de testemunho adaptado a eles; c) escrever um texto com, no mínimo, 1.000 palavras, sobre evangelismo juvenil.',
              },
              {
                sub: 'Área IV', texto: 'Área IV – Criatividade:\n' +
                  '1. Visitar uma exposição, concerto ou outro evento similar e fazer um estudo das maneiras através das quais as pessoas expressam sua criatividade. Com este estudo, preparar um trabalho apresentando a filosofia e o valor da criatividade no Clube dos Desbravadores.\n' +
                  '2. Demonstrar sua própria criatividade num culto divino, reunião do clube ou acampamento, utilizando três diferentes métodos, envolvendo o maior número possível de Desbravadores.\n' +
                  '3. Completar um dos 12 mestrados das especialidades, não completadas anteriormente: a) Atividades Agrícolas; b) Artes Domésticas; c) Natureza; d) Atividades Recreativas; e) Esporte; f) Atividades Profissionais; g) Vida Campestre; h) Testificação; i) Saúde.\n' +
                  '4. Ensinar duas artes manuais a um grupo de desbravadores.\n' +
                  '5. Apresentar ao seu clube um trabalho pessoal que demonstre suas habilidades artísticas.',
              },
              {
                sub: 'Área V', texto: 'Área V – Ordem Unida:\n' +
                  '1. Completar as especialidades de Ordem unida e Ordem unida avançada.\n' +
                  '2. Organizar e conduzir em três ocasiões diferentes uma apresentação de ordem unida do clube, com duração de, no mínimo, 10 minutos cada.\n' +
                  '3. Planejar, organizar e conduzir uma demonstração especial de ordem unida, com duração de três a cinco minutos, a ser usada em um evento coordenado pela Associação ou Missão, mediante acerto prévio com o departamental.\n' +
                  '4. Fazer um estudo de música apropriada para marchas e saber os procedimentos e protocolos especiais no uso das bandeiras cívicas.\n' +
                  '5. Sob a coordenação do diretor do clube ou Regional, preparar seu clube para um desfile cívico.',
              },
              {
                sub: 'Área VI', texto: 'Área VI – Educação Campestre:\n' +
                  'Em concordância com o Ministério Jovem de sua Associação ou Missão, desenvolver e demonstrar suas habilidades, completando os números 1 e 2 e escolhendo o 3 ou o 4:\n' +
                  '1. Natureza e Conservação\n' +
                  '2. Expedição\n' +
                  '3. Orientação\n' +
                  '4. Busca e Resgate',
              },
              {
                sub: 'Área VII', texto: 'Área VII – Recreação:\n' +
                  '1. Assistir a um seminário de 8 horas sobre recreação, coordenado por sua Associação ou Missão.\n' +
                  '2. Fazer um esboço de recreação para o seu Clube, por um ano, e ter uma pasta com um mínimo de 50 sugestões de brincadeiras apropriadas para o Clube ou acampamento.\n' +
                  '3. Ensinar a um grupo de Desbravadores três atividades recreativas, que ajudem a completar requisitos de alguma Classe Regular.\n' +
                  '4. Criar três atividades recreativas próprias para o sábado e liderar um grupo de Desbravadores nestas atividades.\n' +
                  '5. Escrever um artigo, apresentando a perspectiva cristã sobre cinco áreas problemáticas de recreação.\n' +
                  '6. Completar três especialidades da área de recreação, não feitas anteriormente.\n' +
                  '7. Fazer um relatório, avaliando o equipamento recreativo disponível em seu clube. Submeter esse relatório à comissão executiva do clube.',
              },
            ],
          },
        ],
      },
    ],
  },
];

export { NOS_ARTE_ACAMPAR };
