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
