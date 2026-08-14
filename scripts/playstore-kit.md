# Kit de publicação — GSF Clubes na Google Play

## 1. Identidade do app
- **Pacote**: `com.slowdev.gsfdbv`
- **Nome do app (até 30 caracteres)**: `GSF Clubes - Desbravadores`
- **Categoria sugerida**: Educação (alternativa: Estilo de vida)
- **Ícone da loja**: use `assets/icon.png` (já é 1024×1024 — o Play Console redimensiona sozinho pro 512×512 que ele pede)

## 2. Descrição curta (até 80 caracteres)
```
Gestão do Clube de Desbravadores: membros, classes, presença e atividades.
```

## 3. Descrição completa (até 4000 caracteres)
```
GSF Clubes é o aplicativo de gestão do Clube de Desbravadores, feito para diretoria, secretaria, conselheiros e responsáveis acompanharem a vida do clube no dia a dia.

O que você pode fazer no app:

• Cadastro de membros e unidades, com ficha completa de cada desbravador
• Controle de presença nas reuniões
• Acompanhamento de Classes (Amigo a Guia, avançadas, Agrupadas e Líderes) e Especialidades, com progresso visual
• Investidura: acompanhe o que falta para cada membro receber suas insígnias
• Calendário de atividades e eventos do clube
• Atividades e tarefas: envie, acompanhe entregas e aprove
• Aprovações centralizadas de classes e especialidades concluídas
• Notificações sobre avisos, calendário e atividades
• Relatórios administrativos para a diretoria
• Acesso para responsáveis acompanharem seus dependentes

O app segue a Lei Geral de Proteção de Dados (LGPD): o acesso às informações é controlado por perfil (diretoria, secretaria, responsável, membro), e cada pessoa só vê o que é compatível com sua função no clube.

Feito para clubes de Desbravadores da Igreja Adventista do Sétimo Dia.
```

## 4. Ficha de privacidade
- **URL da Política de Privacidade**: https://claude.ai/code/artifact/83210828-c3f9-43b0-ba0b-3697b77afa6a
  *(lembre de deixar pública pelo menu de compartilhar do artifact antes de colar no Play Console)*

## 5. Formulário de Segurança de Dados (Data Safety) — guia rápido
Ao preencher em *Play Console → Política do app → Segurança dos dados*, declare:

| Tipo de dado | Coleta? | Obrigatório? | Finalidade |
|---|---|---|---|
| Nome | Sim | Sim | Funcionalidade do app / conta |
| E-mail | Sim | Sim | Autenticação |
| Data de nascimento | Sim | Sim | Funcionalidade do app |
| Telefone (do responsável) | Sim | Não (opcional p/ membros sem responsável) | Comunicação |
| Fotos | Sim | Não | Perfil / documentos (envio voluntário) |
| ID nacional (CPF, RG) | Sim | Não | Documentação cadastral do clube (envio voluntário) |
| **Informações de saúde** (cartão SUS, plano de saúde, ficha de saúde, carteira de vacinação, laudo médico) | **Sim** | Não | Segurança em atividades/acampamentos (envio voluntário, consentimento específico) |
| Outros documentos (comprovante de residência, autorizações de saída/viagem, antecedentes criminais) | Sim | Não | Documentação exigida conforme a função no clube (envio voluntário) |
| Histórico de app (presença, progresso) | Sim | Sim | Funcionalidade do app |

> **Atenção no formulário do Play Console**: marque a categoria **"Informações de saúde e fitness"** como coletada — isso muda o fluxo do formulário e pode acionar uma revisão adicional do Google. Responda com sinceridade; omitir isso é motivo comum de rejeição/suspensão de apps.

- **Os dados são criptografados em trânsito?** Sim (HTTPS/TLS via Supabase).
- **Você permite que o usuário peça exclusão dos dados?** Sim.
- **Dados são compartilhados com terceiros?** Não para propaganda. Supabase atua só como operador/infraestrutura (hospedagem do banco), não como terceiro que reutiliza os dados.

## 6. Classificação etária (questionário do Play Console)
Responda como um app **administrativo/utilitário sem conteúdo gerado publicamente**:
- Sem violência, sem conteúdo sexual, sem apostas.
- Tem comunicação entre usuários? Não é rede social — é notificação/aviso interno do clube, não chat público.
- Envolve dados de menores? Sim, mas cadastrados e geridos por adultos responsáveis (diretoria/responsável legal), não pela criança diretamente — deixe isso explícito se o formulário perguntar.

## 7. Público-alvo
Recomendo declarar o app como de uso geral (não "projetado para crianças"), já que quem usa o app de fato é a diretoria/secretaria/responsáveis — os desbravadores (crianças/adolescentes) são o assunto dos dados, não os usuários diretos do app. **Essa é uma decisão sua** — se parte relevante do público (ex.: os próprios adolescentes) usa o app diretamente, me avise que ajusto a orientação.

## 8. Ainda faltam (você preenche direto no Play Console)
- [ ] Capturas de tela do app (mínimo 2, celular) — posso gerar se quiser, me avise
- [ ] Imagem de destaque da loja (1024×500) — posso gerar se quiser
- [ ] Conta de desenvolvedor Google Play (você já tem)
- [ ] Formulário de classificação indicativa (preenchido interativamente no Console)
- [ ] Upload do arquivo `.aab` gerado pelo EAS Build (próximo passo)
