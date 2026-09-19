# Casos de teste funcionais — Velô Sprint

**Estado: 11 casos definidos; CT02 executado separadamente, com cinco estados aprovados em ambiente local isolado.** O [resultado do CT02](ct02-result.md) registra a conferência de 19/09/2026 UTC. CT01 e CT03–CT11 permanecem planejados, sem execução atribuída a estes roteiros. As tabelas abaixo descrevem resultados esperados; cada execução deve registrar ambiente, versão, dados, evidência e resultado. Base de análise e da interface conferida: código `779d89332b8daf8e25ddb4c1345427808d954fdc`.

O escopo é o percurso do cliente: apresentação do veículo, configuração, preenchimento do pedido, decisão de crédito e consulta. Desempenho, auditoria de segurança, integração com o provedor real de crédito e perfis administrativos não fazem parte destes 11 casos. A existência de um campo de número do pedido não comprova controle de acesso.

## Preparação comum

- Registrar uma URL de teste autorizada. Os roteiros com criação de pedido e scores controlados usam ambiente local isolado com serviços simulados; não apontar esses dados para produção.
- Iniciar cada caso em um contexto de navegador novo, sem configuração persistida. Um recarregamento na mesma sessão não limpa a seleção anterior. Quando o caso pedir continuidade entre páginas, conservar esse contexto até terminar.
- Configuração básica: **Glacier Blue**, **Aero Wheels**, nenhum opcional, **R$ 40.000,00**. Sport acrescenta R$ 2.000,00; Precision Park, R$ 5.500,00; Flux Capacitor, R$ 5.000,00.
- Dados de formulário para a simulação: Nome `Cliente`, Sobrenome `Teste`, Email `qa-ctNN-ID@example.invalid` (substituir NN pelo caso e ID por identificador único da execução), Telefone `11999990000`, CPF `00000000000`, loja `Velô Paulista - Av. Paulista, 1000` e termos aceitos. O CPF serve apenas à validação de formato no ambiente simulado; não é identidade real nem massa aprovada pelo provedor externo.
- Nos CT06–CT09, preparar a resposta de crédito com o score indicado antes de abrir a página. Um CPF aleatório não garante um score. O registro de pedido simulado deve refletir os dados enviados pela aplicação, inclusive o status calculado; não devolver um status esperado fixo para mascarar erro de decisão.
- Separar os resultados de navegação/status dos itens financeiros pendentes. Não aprovar uma fórmula ambígua apenas porque a interface reproduz o código atual.

## CT01 — Acessar a apresentação e seguir para a configuração

**Objetivo:** verificar que o cliente encontra as seções principais e consegue iniciar a configuração pelos links de chamada para ação.

**Pré-condições:** contexto novo, página inicial acessível e nenhuma necessidade de login para esse percurso.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir a URL base `/`. | A página apresenta o título principal “Velô Sprint” e a chamada “Configure Agora”. |
| 2 | Percorrer a página até “Especificações Técnicas” e “Perguntas Frequentes”. | Os dois títulos e seus conteúdos estão disponíveis, sem exigir mudança de página. |
| 3 | Abrir a pergunta sobre autonomia e fechá-la. | A resposta correspondente aparece e pode ser recolhida; outra seção não substitui a pergunta selecionada. |
| 4 | Voltar ao início e acionar “Configure Agora”. | A rota passa a `/configure`, com cores, rodas e preço de venda disponíveis. |
| 5 | Voltar à página inicial, ir à seção “Pronto para o Futuro?” e acionar “Monte o Seu Agora”. | O segundo link também conduz a `/configure`. |

**Desfecho esperado:** o cliente chega ao configurador pelas duas chamadas da página inicial, sem criar pedido.

**Critérios de aceite:** títulos e seções identificáveis; FAQ utilizável; ambos os links levam ao configurador. Este caso não certifica cada especificação comercial, todos os tamanhos de tela ou ausência universal de problemas visuais.

## CT02 — Alterar cores e rodas sem acumular preço indevido

**Objetivo:** distinguir o efeito visual da cor do acréscimo financeiro das rodas Sport.

**Pré-condições:** abrir **uma sessão nova**, acessar `/configure` e manter os dois opcionais desmarcados. Não reutilizar uma sessão que já esteja em Sport.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Observar a configuração inicial sem clicar nas opções. | Glacier Blue selecionado, Aero Wheels selecionado, carro azul com rodas Aero e preço de venda **R$ 40.000,00**. |
| 2 | Selecionar **Midnight Black**. | A seleção e o carro passam para preto; Aero continua selecionado e o preço permanece **R$ 40.000,00**. |
| 3 | Selecionar **Lunar White**. | A seleção e o carro passam para branco; Aero continua selecionado e o preço permanece **R$ 40.000,00**. |
| 4 | Selecionar **Sport Wheels**, sem alterar a cor ou os opcionais. | A imagem e a seleção passam para Sport; o preço muda para **R$ 42.000,00**, um acréscimo de R$ 2.000,00. |
| 5 | Selecionar novamente **Aero Wheels**. | A imagem volta às rodas Aero; Lunar White permanece selecionado e o preço retorna a **R$ 40.000,00**. |

**Desfecho esperado:** a sessão termina com Lunar White/Aero, sem opcionais e sem acréscimo residual.

**Critérios de aceite:** sequência de preços 40.000 → 40.000 → 40.000 → 42.000 → 40.000; mudança visível de cor e rodas; nenhuma duplicação do acréscimo. A verificação de imagem deve conferir o veículo exibido, além do texto da opção.

## CT03 — Adicionar e remover opcionais antes do checkout

**Objetivo:** verificar a composição do preço e a transferência da configuração para o resumo do pedido.

**Pré-condições:** sessão nova na configuração básica; nenhum pedido criado.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Marcar “Precision Park”. | A opção fica marcada e o preço sobe de R$ 40.000,00 para **R$ 45.500,00**. |
| 2 | Marcar também “Flux Capacitor”. | Ambas ficam marcadas e o preço passa a **R$ 50.500,00**. |
| 3 | Desmarcar apenas “Precision Park”. | Só Flux Capacitor permanece; o preço fica em **R$ 45.000,00**. |
| 4 | Desmarcar “Flux Capacitor”. | Nenhum opcional selecionado; preço **R$ 40.000,00**. |
| 5 | Acionar “Monte o Seu”. | A rota passa a `/order`, com “Finalizar Pedido”, resumo Glacier Blue/Aero e total de R$ 40.000,00 na modalidade à vista. Precision Park e Flux Capacitor não aparecem como itens contratados. |

**Desfecho esperado:** checkout aberto com a configuração final, ainda sem confirmação de pedido.

**Critérios de aceite:** cada seleção altera o total apenas pelo seu valor; remoções revertem os acréscimos; configuração e resumo concordam. Este caso termina antes da gravação em banco.

## CT04 — Impedir envio de formulário incompleto ou inválido

**Objetivo:** exigir os dados pessoais, a loja e o aceite dos termos antes de registrar um pedido.

**Pré-condições:** checkout básico à vista; serviços simulados preparados para registrar tentativas de criação e de análise de crédito. Cada variação abaixo começa com todos os demais campos válidos e mantém uma única irregularidade, salvo a primeira variação, intencionalmente vazia.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Com o formulário vazio e termos desmarcados, acionar “Confirmar Pedido”. | Permanecer no checkout; surgem orientações para completar os campos e aceitar os termos. Nenhum pedido é enviado. |
| 2 | Em uma nova tentativa preparada, informar Nome `A`. Confirmar. | Mensagem “Nome deve ter pelo menos 2 caracteres”; nenhuma criação. |
| 3 | Restaurar o nome válido, informar Sobrenome `B` e confirmar. | Mensagem “Sobrenome deve ter pelo menos 2 caracteres”; nenhuma criação. |
| 4 | Restaurar o sobrenome, informar Email `sem-arroba` e confirmar. | O campo de email impede o envio por validação do navegador ou mensagem da aplicação. Não exigir uma frase nativa que varia entre navegadores. |
| 5 | Restaurar o email; deixar o telefone com dígitos insuficientes e confirmar. Depois repetir com telefone completo e CPF incompleto. | Cada tentativa permanece no formulário e indica, respectivamente, “Telefone inválido” ou “CPF inválido”. |
| 6 | Em nova tentativa com os demais campos válidos, deixar a loja sem seleção e confirmar. | Mensagem “Selecione uma loja”; nenhuma criação. |
| 7 | Selecionar a loja, desmarcar o aceite dos termos e confirmar. | Mensagem “Aceite os termos”; nenhuma criação. |

**Desfecho esperado:** todas as variações inválidas permanecem no checkout, sem pedido registrado e sem consulta de crédito.

**Critérios de aceite:** erro relacionado ao campo alterado e zero tentativas de POST de pedido/crédito em cada variação, inclusive requisições que o ambiente bloqueasse. CPF completo em máscara não comprova validade dos dígitos verificadores. O envio válido é tratado no CT05.

## CT05 — Confirmar um pedido básico à vista

**Objetivo:** registrar a configuração básica sem depender de análise de crédito e apresentar a confirmação correspondente.

**Pré-condições:** sessão nova, configuração básica e dados sintéticos comuns; serviço de pedido simulado disponível, refletindo o payload recebido e atribuindo apenas os metadados do registro.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Ir do configurador ao checkout e preencher todos os campos válidos. | Resumo com Glacier Blue, Aero, nenhum opcional e **R$ 40.000,00**. |
| 2 | Selecionar explicitamente “À Vista” e aceitar os termos. | A modalidade à vista fica selecionada, sem entrada ou simulação de parcelas exigidas. |
| 3 | Acionar “Confirmar Pedido” uma vez. | Durante o envio, o botão indica processamento e não permite nova submissão. É enviada uma criação de pedido; não é feita chamada de análise de crédito. |
| 4 | Aguardar a confirmação. | Rota `/success`, título **“Pedido Aprovado!”** e número no formato `VLO-` seguido de seis letras maiúsculas/dígitos. |
| 5 | Conferir número, cliente, email, loja, cor, rodas e valor da confirmação contra os dados desta tentativa. | Os campos conferidos correspondem ao pedido recém-enviado, com modalidade à vista e status APROVADO. |

**Desfecho esperado:** um pedido sintético registrado e identificado para consultas posteriores autorizadas.

**Critérios de aceite:** uma criação, zero análise de crédito, preço 40.000, confirmação e dados correspondentes. A persistência do interior e a fidelidade da loja em uma nova consulta permanecem na pendência P03; não considerar um valor incorreto como contrato aceito.

## CT06 — Encaminhar score alto para aprovação

**Objetivo:** verificar o caminho de aprovação com score acima de 700 e entrada zero.

**Pré-condições:** checkout básico, dados válidos, resposta de crédito controlada com **score 800**, entrada zero e simulação de pedido que preserve o status calculado pela aplicação.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Preencher os dados, selecionar “Financiamento” e informar `0` em “Valor da Entrada”. | Exibição de 12 parcelas e valor a financiar de R$ 40.000,00. Registrar os valores monetários apresentados, sem aprovar ainda a fórmula de parcelas. |
| 2 | Aceitar os termos e confirmar uma vez. | A aplicação solicita a análise do CPF sintético e recebe o score 800 definido na preparação. |
| 3 | Aguardar o registro e a confirmação. | Pedido enviado com status **APROVADO**, modalidade financiamento, e tela “Pedido Aprovado!”. |
| 4 | Conferir identificador, cliente e modalidade. | A confirmação corresponde a esta tentativa e informa financiamento em 12 vezes; não exibe mensagem de reprovação ou análise pendente. |

**Desfecho esperado:** decisão de aprovação identificável para o conjunto 800/entrada zero.

**Critérios de aceite:** uma chamada de crédito e uma criação; status calculado APROVADO; confirmação coerente. Parcela e total financiado ficam **pendentes de requisito em P01**, separados do resultado do fluxo. Este caso não cobre score 700/701 nem integração real com o provedor.

## CT07 — Manter score intermediário em análise

**Objetivo:** apresentar uma decisão pendente sem confundi-la com reprovação ou aprovação.

**Pré-condições:** mesmos dados válidos do financiamento básico, **score 600** controlado e entrada **zero**.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Selecionar financiamento, informar entrada zero e confirmar os dados válidos. | Análise de crédito solicitada para esta tentativa, com resposta preparada 600. |
| 2 | Aguardar o registro. | A aplicação envia status **EM_ANALISE**, sem substituí-lo por APROVADO ou REPROVADO. |
| 3 | Conferir a confirmação. | Título **“Crédito em análise”** e texto “Seu pedido foi registrado e aguarda análise de crédito.”; sem mensagem de crédito reprovado e sem promessa de prazo. |
| 4 | Registrar o número e comparar cliente/email. | O identificador pertence ao pedido desta tentativa e os dados permanecem reconhecíveis. |

**Desfecho esperado:** pedido em análise, com comunicação de pendência ao cliente.

**Critérios de aceite:** uma análise e uma criação, payload EM_ANALISE e mensagem correspondente. Não afirmar que alguém efetivamente realizará a análise manual. Valores financeiros estão sujeitos a P01; score 700 com entrada alta, a P02.

## CT08 — Reprovar score baixo sem entrada compensatória

**Objetivo:** verificar o caminho de reprovação quando o score é baixo e a entrada está abaixo de 50%.

**Pré-condições:** configuração básica, dados válidos, **score 400**, entrada **zero**, serviços simulados controlados.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Selecionar financiamento, manter entrada zero e confirmar. | É realizada a análise do CPF sintético com resposta 400. |
| 2 | Aguardar a resposta da aplicação. | O pedido é registrado com status **REPROVADO**; o registro da tentativa não é tratado como aprovação do crédito. |
| 3 | Conferir a tela final. | Título **“Crédito Reprovado”** e orientação para tentar pagamento à vista; ausência de título de aprovação ou de análise pendente. |
| 4 | Conferir número, cliente e email. | Os dados correspondem à tentativa reprovada. |

**Desfecho esperado:** reprovação explícita e vinculada ao pedido correto.

**Critérios de aceite:** score 400/entrada zero conduz a REPROVADO, com uma análise e uma criação. O caso não cobre a fronteira 500/501 nem entrada 49,99%; não prova disponibilidade do serviço externo.

## CT09 — Examinar a exceção de entrada de pelo menos 50%

**Objetivo:** verificar o exemplo não ambíguo de entrada alta com score baixo, preservando a pendência sobre a generalização para qualquer score.

**Pré-condições:** configuração básica de R$ 40.000,00, dados válidos e **score 400** controlado. Executar as duas variações em tentativas independentes, com emails/identificadores próprios: entrada **R$ 20.000,00** e entrada **R$ 25.000,00**.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Selecionar financiamento e informar `20000` na primeira variação ou `25000` na segunda. | Valor a financiar de R$ 20.000,00 ou R$ 15.000,00, respectivamente. Registrar as parcelas exibidas sem adotá-las como cálculo correto. |
| 2 | Confirmar os dados válidos. | O fluxo atual ainda consulta crédito; a resposta controlada é 400. “Exceção de entrada” não significa ausência dessa chamada. |
| 3 | Aguardar o registro e conferir seu status. | Para esses dois conjuntos com score 400, status **APROVADO** e título “Pedido Aprovado!”. |
| 4 | Conferir a identidade e a modalidade da confirmação. | O pedido corresponde à variação executada, sem confundir os dois registros. |

**Desfecho esperado:** o score baixo não impede aprovação nos dois exemplos de entrada indicados.

**Critérios de aceite:** 400/20.000 e 400/25.000 aprovados, com entradas e saldos corretamente diferenciados. **Não generalizar para score 700**: o requisito amplo e o operador `<700` do código divergem; essa combinação fica bloqueada para decisão de requisito em P02. Parcela/total continuam em P01. Não declarar CT09 como validação de “qualquer score”.

## CT10 — Consultar um pedido conhecido e conferir seu cartão

**Objetivo:** recuperar o pedido solicitado e confrontar os dados exibidos com uma fonte de teste independente da própria tela.

**Pré-condições:** registro sintético conhecido no serviço simulado, com número válido, status APROVADO, Glacier Blue, Aero, modalidade à vista, total R$ 40.000,00, nome/email e data previamente documentados. A massa deve vir de um registro de teste identificado; não adivinhar que um código está disponível. Separar a consulta de uma regra de decisão de crédito.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir a home e seguir “Consultar Pedido”. | Tela de consulta com campo “Número do Pedido” e botão “Buscar Pedido”. |
| 2 | Preencher o número conhecido em minúsculas, com espaços externos, e buscar. | A consulta usa o número normalizado; enquanto aguarda, o botão indica “Buscando...” e fica indisponível para nova busca. |
| 3 | Conferir o resultado após a resposta. | Um cartão do pedido solicitado é exibido. O número exato está no grupo identificado por “Pedido”, não apenas em qualquer texto da página. |
| 4 | Comparar status, cor, rodas, nome, email, data, modalidade e total com a massa preparada. | APROVADO, Glacier Blue, Aero Wheels, dados esperados, data correspondente à data da massa na configuração de fuso registrada, À Vista e R$ 40.000,00. A imagem corresponde à configuração. |
| 5 | Conferir a apresentação do status. | Texto APROVADO com apresentação verde/ícone de aprovação. O texto continua suficiente para identificar o estado sem depender apenas da cor. |

**Desfecho esperado:** consulta do registro correto com os campos deste escopo conferidos.

**Critérios de aceite:** número contextual, dados e preço exatos; ausência de cartão de outro pedido. Variações com registros REPROVADO e EM_ANALISE devem usar seus próprios dados: vermelho/reprovação e âmbar/relógio com “Aguardando análise de crédito.”, respectivamente. Um snapshot de texto não comprova cor ou desenho do ícone. A correspondência integral de interior, loja, opcionais e parcelas fica limitada por P03; não aceitar campos perdidos como valores corretos.

## CT11 — Tratar busca sem resultado e impedir busca vazia

**Objetivo:** orientar a correção de um número inexistente ou inválido e impedir submissão sem conteúdo útil.

**Pré-condições:** ambiente simulado com um pedido conhecido para a preparação e outro número no formato `VLO-ABC123` explicitamente configurado como ausente; nenhum número aleatório deve ser presumido inexistente.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir `/lookup` com campo vazio. | “Buscar Pedido” desabilitado; nenhum pedido apresentado ou consulta enviada. |
| 2 | Preencher somente três espaços. | O botão continua desabilitado. Verificar o estado, sem forçar um clique. |
| 3 | Substituir pelo número conhecido e consultar para preparar um resultado anterior. | O cartão desse pedido é exibido. |
| 4 | Substituir pelo número definido como ausente e buscar. | O cartão anterior é retirado; após a resposta vazia, aparece “Pedido não encontrado” e “Verifique o número do pedido e tente novamente”. |
| 5 | Substituir por `codigo-invalido` e buscar, com resposta vazia preparada para esse valor. | A orientação de não encontrado permanece pertinente; nenhum pedido ou dado de cliente é exibido. A UI atual não faz bloqueio prévio por formato do código. |
| 6 | Limpar o campo. | O botão volta a ficar desabilitado e nenhuma nova consulta é enviada por essa limpeza. |

**Desfecho esperado:** busca sem registro correspondente apresenta orientação, sem manter os dados do sucesso anterior.

**Critérios de aceite:** vazio/espaços não submetem; buscas preparadas como ausentes não mostram cartão de cliente; heading e orientação legíveis. Conferência do X e da apresentação de erro exige observação específica, além de texto/ARIA; não inferir uma auditoria de confidencialidade a partir deste caso.

## Pendências que impedem conclusões mais amplas

| ID | Divergência ou limitação | Tratamento antes de um aceite mais amplo |
| --- | --- | --- |
| **P01 — juros e totais** | A descrição funcional fala em 2% compostos ao mês. O checkout calcula `(saldo / 12) * 1.02`, enquanto `calculateInstallment` no store usa prestação constante com taxa mensal 0,02 em 12 períodos. O “Total” do resumo do checkout financiado também representa o saldo financiado acrescido do fator, enquanto o pedido soma a entrada a esse total. | Definir com a fonte de requisito a fórmula, o significado de cada total e o arredondamento. Até lá, registrar valores como observados; não aprovar o cálculo nem alterar a regra para fazer um caso passar. |
| **P02 — score 700 e entrada** | A regra ampla de entrada ≥50% ignoraria o score; o código aplica a exceção apenas com `score < 700`. Assim, score 700 com entrada de 50% cai em EM_ANALISE no código atual. | Resolver a prioridade e os operadores. Planejar depois 500/501, 700/701 e entradas abaixo/igual/acima de 50%; nenhum desses pontos está validado por exemplos 400/600/800. |
| **P03 — fidelidade após persistência** | O mapper de pedidos fixa o interior em `cream`, não persiste a loja e não reconstrói a parcela. A consulta não apresenta lista de opcionais, embora os dados de opcionais existam no registro. | Não transformar interior incorreto, loja vazia ou parcela ausente em expectativa correta. Definir o contrato de persistência/apresentação e tratar separadamente a correção necessária. |

Os critérios deste documento descrevem um alvo de verificação, não a certificação de que os 11 percursos já passaram. Execuções anteriores de specs automatizados, por si sós, não preenchem o resultado destes roteiros manuais ou suas variações.
