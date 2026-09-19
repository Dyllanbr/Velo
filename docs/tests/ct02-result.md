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
