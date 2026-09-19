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
