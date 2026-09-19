# Validar campos do checkout sem um falso positivo

Use este complemento próprio com o [CT04](../tests/test-cases.md#ct04--impedir-envio-de-formulário-incompleto-ou-inválido) e o teste `playwright/e2e/checkout-validacao.spec.ts`. A aplicação da aula sobre prompt é fornecer um exemplo específico do contrato local e conferir sua generalização, sem copiar um template ou presumir que uma resposta do agente comprova execução.

## Primeiro, conferir o caso e a interface

Identifique versão, origem local isolada e ferramenta realmente usada. Leia o caso e o formulário antes de editar. Registre os campos, os nomes acessíveis e onde cada mensagem aparece; diferencie observação no navegador de leitura do código. Se um comportamento necessário ainda não foi observado, registre a pendência em vez de inventar uma exploração MCP.

Cada variação começa em um contexto novo, com os demais campos preenchidos e conferidos, salvo o caso intencionalmente vazio. Não transforme uma lista de passos manuais em um teste que depende dos erros deixados pelos passos anteriores. No caso de termos, um erro de CPF residual não é aceitável como prova de que somente os termos impedem o envio.

O produto atual tem `type="email"` e validação nativa habilitada. Um endereço como `sem-arroba` pode impedir o evento submit antes do schema da aplicação: observe `validity.typeMismatch`, o valor do campo e a ausência de envio, sem exigir uma frase traduzida do navegador. CPF completo na máscara comprova apenas o formato aceito pelo schema atual, não dígitos verificadores ou identidade real. Não acrescente `noValidate` nem mude regras do produto para fazer o teste passar.

## Depois, automatizar somente o contrato conferido

Preserve a composição de `../support/mock`, o `networkGuard`, a origem local e o Supabase fictício `.invalid`. Reutilize `fillCheckout` e os dados sintéticos existentes. Confira seus valores finais antes de alterar somente o campo do cenário. O controle positivo já existente em `pedidos.spec.ts` deve continuar capaz de enviar um pedido à API simulada; nenhum acesso real ao banco ou crédito é necessário.

Use o campo como âncora do erro. Hoje o controle com test ID e seu parágrafo de erro pertencem ao mesmo agrupamento em `Order.tsx`; o erro dos termos fica aninhado nesse agrupamento. Um exemplo local é:

```ts
const alert = page.getByTestId('checkout-name').locator('..').getByRole('paragraph');
await expect(alert).toHaveCount(1);
await expect(alert).toBeVisible();
await expect(alert).toHaveText('Nome deve ter pelo menos 2 caracteres');
```

O salto ao pai documenta uma dependência pequena da estrutura atual, pois o erro ainda não possui test ID ou associação ARIA própria. Não invente `aria-describedby`, não use índices nem troque isso por uma busca global do texto. Se o DOM mudar, confira novamente o vínculo. Preserve a visibilidade junto do texto e exija ausência de erros nos outros agrupamentos conhecidos. No formulário vazio, confira os sete erros; não conte parágrafos de preço ou financiamento.

Mantenha a fixture `noPosts`: observar tentativas POST em todo o contexto, inclusive requisições abortadas, anexar `post-attempts.json` e exigir lista vazia. Permanecer em `/order` ou ter uma requisição bloqueada não prova ausência de tentativa. Não simule sucesso nos negativos para ocultar um envio acidental, não adicione esperas fixas e não aumente timeouts para esconder falhas.

Quando a execução local estiver liberada, valide lint, tipos e os sete negativos mais o controle positivo, com Chromium, um worker e zero retries. Registre resultado individual, anexos, tentativas, versão e alcance real. O e-mail tem recibo de validade nativa; os demais verificam mensagem contextual e ausência de erros adicionais. Uma falha deve conservar sua evidência antes de qualquer correção. Não declare execução, MCP, UI Mode ou revisão audiovisual que não ocorreram.

Esta etapa mantém como lacuna o cenário de loja isoladamente vazia previsto no CT04; não o confunda com a loja vazia no teste de todos os campos em branco. A próxima revisão da aula sobre testes atômicos pode orientar esse complemento. Não altere código de produto, rede, fixtures ou outros casos por conta própria durante esta aplicação.
