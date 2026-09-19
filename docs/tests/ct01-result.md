# CT01 — resultado da navegação pela apresentação

**Resultado: cinco etapas aprovadas.** A conferência interativa ocorreu em 19/09/2026, de 02:55:08 a 02:57:23 UTC, seguindo o [CT01](test-cases.md#ct01--acessar-a-apresentação-e-seguir-para-a-configuração). A execução usou controle de navegador CUA, em origem local isolada, com Supabase `.invalid` e conexões externas bloqueadas. Código de referência da preparação: `5e66d8fd2968b63d1c38ea60a4cb51b05be99e2b`.

| Etapa | Resultado observado |
| --- | --- |
| Página inicial | Título “Velô Sprint” e chamada “Configure Agora” visíveis. |
| Seções principais | “Especificações Técnicas” e “Perguntas Frequentes” conferidas. |
| FAQ de autonomia | Resposta aberta e recolhida; `aria-expanded` mudou de `true` para `false`. |
| Chamada do início | “Configure Agora” levou a `/configure`. |
| Chamada final | “Monte o Seu Agora”, na seção “Pronto para o Futuro?”, também levou a `/configure`. |

Foram capturadas e conferidas cinco imagens reais em JPEG na sessão, com SHA-256 calculado sobre os bytes originais. **Os arquivos não foram persistidos: o navegador bloqueou o envio ao formulário local com `ERR_BLOCKED_BY_CLIENT`. Não há imagens anexadas.** A aprovação funcional permanece separada dessa pendência de preservação. As capturas mostram a página inicial, especificações, FAQ e os dois destinos de navegação. A mudança de estado da FAQ foi conferida durante a interação; uma imagem isolada não demonstra as duas transições.

Não houve criação de pedido, análise de crédito ou acesso a banco remoto. A aprovação cobre as etapas acima; não certifica todas as especificações comerciais, todos os tamanhos de tela ou ausência universal de erros. Esta execução não demonstra configuração ou uso de Playwright MCP no Cursor, nem uso do Antigravity.
