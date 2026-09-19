# CT02 — resultado da configuração de cores e rodas

**Resultado: cinco estados aprovados.** A conferência interativa ocorreu no Chrome em 19/09/2026, aproximadamente entre 02:22 e 02:25 UTC, seguindo o [CT02](test-cases.md#ct02--alterar-cores-e-rodas-sem-acumular-preço-indevido).

A interface correspondia ao commit [779d893](https://github.com/Dyllanbr/Velo/commit/779d89332b8daf8e25ddb4c1345427808d954fdc). O ambiente era local e isolado, com URL de Supabase `.invalid` e conexões externas bloqueadas. O estado inicial foi conferido antes das alterações: Glacier Blue, Aero, nenhum opcional e R$ 40.000,00. Não houve envio de pedido, análise de crédito ou acesso a banco remoto.

| Estado conferido | Seleção e imagem observadas | Preço observado | Resultado |
| --- | --- | --- | --- |
| Inicial | Glacier Blue, carro azul e rodas Aero; opcionais desmarcados | R$ 40.000,00 | Passou |
| Após selecionar Midnight Black | Carro preto, Aero preservado | R$ 40.000,00 | Passou |
| Após selecionar Lunar White | Carro branco, Aero preservado | R$ 40.000,00 | Passou |
| Após selecionar Sport | Cor branca preservada; rodas com raios finos e pinças vermelhas, seleção Sport | R$ 42.000,00 | Passou |
| Após retornar a Aero | Cor branca preservada; desenho anterior das rodas, seleção Aero | R$ 40.000,00 | Passou |

Foram conferidos os controles, seus estados acessíveis e a imagem do veículo. Um quadro ainda desatualizado após selecionar preto foi desconsiderado; a observação seguinte confirmou a atualização. A seleção de Sport foi identificada pelo nome acessível efetivo do controle. O produto não foi alterado para realizar a conferência.

Este é um registro textual, sem arquivos de captura anexados. A aprovação cobre somente os cinco estados acima. Não estabelece resultado para os outros dez casos, persistência de dados, financiamento, provedor de crédito ou aparência em produção. O servidor local foi encerrado após a conferência.

## Nova conferência em 19/09/2026 — 02:58:00 a 02:59:17 UTC

Uma nova execução interativa pelo navegador CUA confirmou os mesmos cinco estados, em outra origem local isolada: azul/Aero, preto/Aero, branco/Aero, branco/Sport e branco/Aero. Os opcionais permaneceram desmarcados. A sequência observada foi **R$ 40.000,00 → R$ 40.000,00 → R$ 40.000,00 → R$ 42.000,00 → R$ 40.000,00**, com as imagens correspondentes de cor e rodas. Código de referência da preparação: `5e66d8fd2968b63d1c38ea60a4cb51b05be99e2b`.

Os cinco estados passaram na primeira observação desta rodada, sem quadro desatualizado registrado. Foram capturadas e conferidas cinco imagens reais em JPEG na sessão, com SHA-256 dos bytes originais. **Os arquivos não foram persistidos: o navegador bloqueou o envio ao formulário local com `ERR_BLOCKED_BY_CLIENT`. Não há novas imagens anexadas.** A aprovação funcional permanece separada dessa pendência de preservação. O resultado anterior e seu limite de evidência continuam preservados acima.

Esta execução não criou pedido, não chamou o provedor de crédito e não demonstra uso de Playwright MCP no Cursor ou do Antigravity. O aceite permanece restrito às cores, rodas e preços observados.

## Automação derivada da exploração — 19/09/2026, A11

O [cenário Playwright dedicado](../../playwright/e2e/configurator-ct02.spec.ts), guiado pelo [prompt próprio de duas fases](../prompts/automatizar-caso-observado.md), passou em execução local separada das conferências manuais acima. Ele percorre os cinco estados do CT02, inclusive Lunar White, preservando opcionais desmarcados e as fixtures/guardas existentes. Não cria pedido nem chama crédito.

| Validação realizada | Resultado |
| --- | --- |
| ESLint dirigido ao novo spec | Exit 0 |
| TypeScript estrito dirigido ao spec e suas importações | Exit 0; ES2022/ESNext, resolução Bundler e DOM |
| CT02 Chromium headless | **1/1 aprovado**, um worker, uma tentativa e retry 0 |
| Duração | 2,530 s no caso; 7,509 s no relatório Playwright |
| Casos ignorados/flaky e erros globais | Zero |
| Fontes antes/depois | 19 hashes estáveis em cada etapa |

A janela do monitor foi de **03:50:43.570 a 03:51:00.811 UTC**, com OBS inativo. Playwright 1.58.2 e Node 24.14.0. A execução usou a base `df4c98c89ab09f75ee92ae1f206f4be2a29440fc` com o novo spec ainda sem commit; SHA-256 do arquivo testado: `c46fe8e25dc2199a9c500b52fed172a5b74d94339c116c6231e370b3b4e56994`. Comando: `node node_modules/playwright/cli.js test configurator-ct02.spec.ts --config <configuração privada de evidências> --project=chromium --workers=1 --retries=0`.

Os checkpoints verificam preço, opcionais desmarcados, nome/asset da imagem e carregamento. **Não comparam pixels nem afirmam um estado ARIA de seleção que o produto não oferece.** A aprovação visual manual permanece separada. Online, CT03 e a suíte inteira não foram repetidos; nenhum resultado de CI ou aceite remoto é inferido.

Logs, relatórios JSON/HTML e recibos com hashes foram preservados localmente no D. O caso aprovado não gerou attachments, pois a configuração só retém screenshot/trace em falhas. Isso não recupera as imagens manuais cuja persistência foi bloqueada. O aviso `NO_COLOR`/`FORCE_COLOR` no stderr não foi erro de teste. Nenhuma execução de Cursor MCP, Inspector ou UI Mode é atribuída a este complemento.

## Cenários separados de cores e rodas — 19/09/2026, A12

A execução A11 acima é histórica. O spec foi reorganizado em três instâncias com contexto novo e preparação aguardada antes de cada teste: cores preto/branco com Aero; rodas Sport→Aero em Glacier Blue; rodas Sport→Aero em Lunar White. As combinações e asserções anteriores foram mantidas e o caso de rodas azul foi acrescentado, mas o percurso integrado anterior de cinco estados foi distribuído entre casos. Apenas rodas azul independe de selecionar outra cor; rodas branco ainda depende da seleção de Lunar White na preparação.

| Caso executado | Resultado | Tempo do caso |
| --- | --- | --- |
| Cores: preto e branco, Aero, R$ 40.000,00 | Passou | 1,888 s |
| Rodas em azul: Sport/R$ 42.000,00 → Aero/R$ 40.000,00 | Passou | 0,858 s |
| Rodas em branco: Sport/R$ 42.000,00 → Aero/R$ 40.000,00 | Passou | 0,940 s |

Uma execução local dirigida aprovou **3/3 casos Chromium headless**, com um worker, uma tentativa por caso e retry 0. O relatório registrou **7,865 s** (7,9 s no stdout), sem skipped, flaky, unexpected ou erros globais. ESLint e TypeScript estrito do spec/importações também terminaram com saída 0. A base foi `99638759f2b2ed2d45e2bd74d3f1b2ea1ccfee80`, com o spec ainda sem commit; SHA-256 testado: `101ec178fe3819aaedc6858a468c874715a0e13ab4f7d80314bc126e657ff9ba`.

Imports, tipos e o helper de checkpoints permaneceram iguais. A execução manteve servidor local, fixtures/networkGuard, backend fictício e contexto por teste; não alterou produto, actions, CT03 ou configurações. Os checkpoints continuam verificando preço, opcionais desmarcados, nome/asset/carregamento da imagem, sem comparação de pixels ou afirmação de seleção ARIA inexistente.

Os relatórios JSON/HTML, logs e hashes foram preservados no D. A rodada não repetiu online, CT03 ou a suíte inteira, não acessou banco remoto/crédito e não gerou novas capturas de sucesso. Os aceites manuais e a limitação das imagens não persistidas permanecem históricos acima; esta validação local não prova CI, merge ou deploy.

## Ações do configurador compartilhadas — 19/09/2026, A13

A factory existente `configuratorActions` passou a concentrar seleção de cores/rodas e os checkpoints da configuração. Os três casos CT02 continuam separados, com a mesma sequência, dados e asserções; o spec delega essas operações às actions. A função assíncrona de preço preserva parâmetro `string`, visibilidade e texto, para também atender os valores dos opcionais do CT03. Fixtures, networkGuard, mocks, produto e spec CT03 não foram alterados.

Uma nova execução local dirigida aprovou **4/4 casos Chromium headless**, com um worker, uma tentativa por caso e retry 0: os três CT02 e o CT03, incluído por consumir a action compartilhada. ESLint dos dois arquivos alterados e TypeScript estrito dos dois consumidores/actions também terminaram com saída 0.

| Caso executado nesta rodada | Resultado | Tempo do caso |
| --- | --- | --- |
| CT02: cores preto/branco com Aero | Passou | 1,949 s |
| CT02: Sport→Aero em Glacier Blue | Passou | 0,863 s |
| CT02: Sport→Aero em Lunar White | Passou | 0,887 s |
| CT03: adicionar/remover opcionais e conferir resumo no checkout | Passou | 1,051 s |

O relatório Playwright registrou **9,135 s** (9,1 s no stdout), sem skipped, flaky, unexpected ou erros globais. A base foi `86339243649154831b0421f5c6c8a2fde0664b07`, com a refatoração ainda sem commit. Os 19 hashes acompanhados permaneceram estáveis antes/depois de cada etapa; logs e relatórios JSON/HTML foram preservados localmente no D.

Esta é uma aprovação nova do CT03 após a refatoração: preço **R$ 40.000,00 → R$ 45.500,00 → R$ 50.500,00 → R$ 45.000,00 → R$ 40.000,00**, estados dos dois opcionais em cada transição e resumo final Glacier Blue/carbon black/Aero sem opcionais. O cenário termina no checkout, sem enviar pedido. CT02 conserva verificações de preço, opcionais desmarcados, alt/asset/carregamento da imagem, sem comparação de pixels nem estado ARIA de seleção inventado. Não houve banco remoto ou análise de crédito; os demais testes e a suíte inteira não foram repetidos.

Os registros A11/A12 e as conferências manuais acima permanecem históricos. Esta rodada não gera capturas de sucesso, não recupera imagens bloqueadas e não demonstra CI, merge, deploy ou conclusão do curso. Integração e entrega continuam aguardando as 69 aulas e a revisão final.
