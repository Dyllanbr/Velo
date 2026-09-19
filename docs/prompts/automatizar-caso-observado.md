# Da exploração observada ao teste automatizado

Use este pedido com o [CT02 documentado](../tests/test-cases.md#ct02--alterar-cores-e-rodas-sem-acumular-preço-indevido) e seu [resultado manual](../tests/ct02-result.md). É uma adaptação própria do processo em duas fases estudado na aula de Prompt Engineering para Automação. Não presume uma conexão MCP nem substitui evidências por uma resposta do agente.

## Fase 1 — conferir o comportamento antes de escrever o teste

Identifique a versão do código, a origem local isolada e a ferramenta realmente disponível. Siga o [roteiro manual](executar-casos.md), uma ação por observação. Para CT02, registre cinco estados: azul/Aero, preto/Aero, branco/Aero, branco/Sport e branco/Aero; opcionais desmarcados em todos eles; preços 40.000 → 40.000 → 40.000 → 42.000 → 40.000.

Reaproveite um resultado anterior somente se ele identificar ambiente, versão e esses passos; confira se o código relevante mudou. O resultado CUA de 19/09/2026 contém os cinco estados e pode ser a base funcional desta aplicação. Suas imagens não foram persistidas por bloqueio do navegador; não invente anexos nem tente outro caminho para contornar esse bloqueio. Esse reaproveitamento não é uma nova execução nem demonstra Cursor/Playwright MCP.

Registre nomes acessíveis e estados do DOM efetivamente observados. Separe esses registros da leitura posterior do código. Se faltar um locator, se a interface tiver mudado ou houver divergência funcional, delimite o ponto pendente e observe-o antes de implementar; não apague o histórico para apresentar uma execução nova. Nesta fase não escreva testes nem altere o produto.

## Fase 2 — transformar somente o caso aprovado em automação

Produza um cenário dedicado em `playwright/e2e/configurator-ct02.spec.ts`, com Arrange, ações e verificações após cada transição. Importe `test` e `expect` de `../support/fixtures`: essa composição herda a guarda de rede local. O `global-setup` existente inicia Vite com Supabase fictício em `.invalid`; preserve essa configuração, a origem `127.0.0.1:4173`, o contexto novo por teste e o bloqueio de conexões externas. Este caso não cria pedido, não chama crédito e não precisa de um mock de resposta de backend.

Priorize papel e nome acessível para botões, imagem e checkboxes. Os botões de rodas incluem texto adicional no nome; confirme o nome completo ou use um prefixo específico que identifique uma única opção. O preço usa `total-price` porque o `span` atual não possui papel ou associação de label própria. Não use índices, cadeias estruturais, classes de layout ou estado ARIA inexistente para simular uma seleção.

Mantenha expectativas literais do caso, sem importar a fórmula de preço do produto. Confira preço, configuração indicada pela imagem e opcionais após cada ação. Para a imagem, distinga atributo/asset correto e carregamento de uma comparação de pixels: apenas ler `alt` não valida a aparência. A conferência visual manual continua sendo uma evidência separada.

Use asserções do Playwright com espera por condição e `await` em todas as interações. Preserve os limites existentes; não acrescente sleeps nem timeouts maiores para esconder falhas. Um pequeno checkpoint tipado dentro do arquivo é suficiente. Não refatore Feature Actions, fixtures ou produto só para esta primeira implementação; uma extração posterior pode ser revisada separadamente se houver duplicação real.

Quando a janela de execução local estiver liberada, execute o cenário com um worker e registre comando, versão, resultado, tentativas e artefatos. Uma execução headed pode documentar a prática assistida quando permitida; não declare Inspector, UI Mode ou MCP sem uso comprovado. Depois confira os consumidores existentes do configurador e as verificações de tipos/lint pertinentes.

Se falhar, preserve o resultado, diferencie problema do teste, do ambiente e do produto e corrija somente com fundamento no caso observado. Não remova verificações, mude os preços, suprima erros de rede ou repita indefinidamente até obter verde. Entregue o diff e o alcance comprovado, incluindo o que continuou pendente.
