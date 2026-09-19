# Preparação de pedidos com Kysely no preview

Esta suíte adicional demonstra a preparação de três cenários de consulta: aprovado, reprovado e em análise. Cada caso exclui somente sua identidade reservada e insere novamente os atributos esperados antes de consultar a interface. Duas rodadas explícitas dos mesmos três cenários devem conservar três registros pertencentes à suíte. Os registros ficam no preview para investigação; não são apagados depois do teste.

O código está separado das consultas locais com mocks e do E2E de isolamento do desafio. A semeadura de um status não comprova análise de crédito. Nenhum DELETE global, migration, mudança de RLS, workflow ou operação em produção faz parte desta prática.

## Dados e proteção

`playwright/support/preview-database.ts` reserva os códigos `VLO-QA4A01`, `VLO-QA4A02` e `VLO-QA4A03`, cada um com UUID e e-mail sintético próprios. Os três valores identificadores permanecem estáveis entre execuções. Isso é uma adaptação de ownership: a demonstração da aula mantém o número de negócio, mas gera outro UUID a cada INSERT.

Antes de qualquer exclusão, o repositório procura conflitos por UUID **ou** número **ou** e-mail. Se encontrar uma linha que não corresponda ao trio completo esperado, falha sem excluí-la. O DELETE usa igualdade dos três campos. DELETE e INSERT são uma transação; a interface só é consultada após seu commit. Uma falha no INSERT desfaz o DELETE.

Um advisory lock exclusivo da suíte é obtido em conexão dedicada e continua ativo durante a preparação e os asserts da interface. Outra execução concorrente falha antes de escrever. O lock é cooperativo: não impede que uma ferramenta externa que o ignore altere os dados. `withCleanupPreservingFailure` aguarda liberação e `db.destroy()`, preserva o erro original do caso e faz um caso bem-sucedido falhar quando a limpeza falha. Não há limpeza de dados no teardown.

O guard aceita somente o projeto preview reservado, endpoint direto `db.bcsepghyrzmabmmdinuy.supabase.co`, porta 5432, banco/usuário `postgres` e TLS com verificação de certificado. Poolers e parâmetros extras na URL são rejeitados; não existe fallback. O marcador do deployment deve confirmar preview, ref e SHA esperado antes de criar o pool. A senha PostgreSQL fica apenas no processo Node, nunca em `VITE_*`, navegador, trace ou relatório. Erros do driver são substituídos por mensagens sem conexão, parâmetros ou causa.

O navegador recebe somente a origem do app e leituras dirigidas aos três números no REST do preview. Escritas HTTP, outros destinos e redirects são bloqueados. O transporte protegido existente mantém o bypass fora da instrumentação Playwright e apenas no app; o ramo Supabase remove explicitamente esse header. A suíte não consulta produção, embora reutilize a configuração de identidade do preview que também exige os valores públicos de produção.

## Uma massa para preparar e validar

`RESERVED_ORDER_DETAILS` reúne os três cenários completos no formato de leitura da interface. Cada objeto contém a configuração do carro, os dados sintéticos do cliente, pagamento e total decimal. O preço formatado é derivado desse total ao construir a massa. O mesmo objeto é passado a `database.prepare(order)` e `orderLookup.validateOrderDetails(order)`, evitando um segundo conjunto de valores esperados no teste.

O mapper puro `toOwnedOrderInsert` transforma `PreviewOrderDetails` em `Insertable<OrdersTable>` antes de abrir a transação de escrita. Ele confere número, e-mail e status contra a reserva, obtém o UUID dessa reserva e valida a coerência do preço. Converte a cor em código com hífen, retira o sufixo ` Wheels` antes de converter rodas para minúsculas e normaliza `À Vista` para `avista`. As saídas são restritas às cores/rodas conhecidas e ao pagamento à vista deste escopo. Status como `EM_ANALISE` conservam a caixa original.

Esse é o ponto aplicado da aula sobre dados fragmentados. UUID estável, timestamps gerados pelo banco, validações de ownership e lock são adaptações explícitas de segurança do nosso ambiente. Os dados continuam sendo três cenários sintéticos Glacier Blue/Aero de 40000; não foram copiados clientes da demonstração. O tipo de interface compartilhado e os consumidores locais com mocks não foram alterados. A transformação não testa cálculo de preço nem concessão de crédito.

O baseline anterior à centralização passou lint, tipos e 64 unitários locais em 19/09/2026. Esses resultados pertencem ao código anterior. A centralização acrescenta casos de mapeamento e rejeição antes de BEGIN/DELETE; a validação local combinada com o JSON está registrada abaixo. A execução dos seis casos reais no preview continua pendente de recibo próprio. Nenhuma execução real de banco é deduzida dos unitários com transporte em memória.

## As três massas em JSON

`playwright/support/fixtures/orders.preview.json` contém somente as entradas `aprovado`, `reprovado` e `em_analise`, com os mesmos dados sintéticos. Ele é massa de teste; não substitui `playwright/support/fixtures.ts`, que injeta ações nos testes locais. O registro `RESERVED_ORDERS` permanece independente no código para conferir ownership. O JSON não contém UUID, timestamps nem `price`: o preço de apresentação continua derivado de `total_price`.

O suporte importa `testData` com `with { type: 'json' }`. `reservedOrderDetailsFromJson` verifica chaves, tipos e campos obrigatórios, associa cada chave ao status reservado e reutiliza o mapper antes de exportar a coleção. Dados inválidos falham antes de qualquer Pool, com mensagem sem payload. Asserções TypeScript não substituem essas verificações. Um arquivo ausente ou JSON sintaticamente inválido falha no próprio carregador de módulos, antes de o guard de dados executar; não há fallback ou cenário ignorado.

O atributo informa o formato ao runtime ESM. `--resolveJsonModule` tem outra função: permitir resolução e inferência estática pelo TypeScript. A checagem dirigida abaixo o declara explicitamente; executar Playwright não substitui essa checagem. As duas aprovações 6/6 vistas na aula pertencem à demonstração do professor, não comprovam execução desta suíte.

## Validação local registrada

Em 19/09/2026, entre 08:37:05 e 08:37:20 UTC, a versão com centralização e massa JSON concluiu lint dirigido e TSC estrito com `--resolveJsonModule`, ambos com saída 0. O Vitest aprovou **117/117 casos** em um arquivo, sem falhas, skips ou todo, com um worker e retry 0. O relatório informa 842 ms de duração do Vitest, dos quais 42 ms nos testes; o processo monitorado dessa etapa durou 3,337 s.

A execução ocorreu com OBS inativo e sem processos de mídia detectados nas amostras. Package e lockfile permaneceram inalterados. Os unitários usam transporte PostgreSQL em memória: não houve conexão SQL real, execução de navegador ou E2E remoto. Os seis casos de duas rodadas no preview continuam pendentes; o baseline histórico de 64 aprovados permanece separado deste resultado combinado.

## Configuração e execução dirigida

Dependências de desenvolvimento instaladas em 19/09/2026 às 07:52 UTC, com versões exatas no package/lock: `kysely@0.28.14`, `pg@8.20.0`, `@types/pg@8.20.0`. O baseline anterior às mudanças de centralização/JSON concluiu lint, tipos e 64/64 unitários às 08:09 UTC. A validação local combinada foi concluída posteriormente, às 08:37 UTC, conforme o registro acima; instalação e unitários não comprovam acesso real ao banco.

Além da configuração existente de `playwright.preview.config.ts`, fornecer ao processo:

- `E2E_PREVIEW_DATABASE_ALLOWED=true` e `E2E_PREVIEW_ALLOWED=true`;
- `TEST_DATABASE_URL` por ambiente privado, somente para o endpoint autorizado;
- refs, URLs e chaves públicas preview/produção exigidas por `previewSettings`;
- `E2E_BASE_URL`, `E2E_EXPECTED_SHA` do app realmente publicado e bypass somente se a proteção do deployment exigir.

Não carregar `.env` geral nem registrar essas variáveis. Variáveis `PG*` herdadas e `NODE_TLS_REJECT_UNAUTHORIZED=0` fazem o guard recusar a execução; preparar um ambiente privado limpo, sem alterar a configuração global da máquina. O SHA do app pode ser diferente do commit dos testes: ambos precisam ser identificados no recibo, sem atribuir um deploy novo a esta execução.

Com dependências disponíveis e ambiente privado preparado, o comando dirigido é:

```powershell
node .\node_modules\@playwright\test\cli.js test --config playwright.database.config.ts --workers=1 --retries=0
```

São **seis instâncias**, três status em cada uma de duas rodadas, sem retry automático. Ao final de cada rodada, o conjunto dos registros reservados deve ser exatamente os três esperados; não se exige que a tabela inteira tenha apenas três linhas, pois outras evidências devem permanecer intactas. Na segunda rodada, cada preparação deve excluir exatamente uma linha própria antes de inseri-la de novo.

A validação de tipos deve incluir esses arquivos explicitamente: o `tsconfig.node.json` atual cobre Vite, não toda a suíte. Exemplo de checagem dirigida, sem modificar o tsconfig do produto:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --skipLibCheck --lib ES2022,DOM,DOM.Iterable --allowSyntheticDefaultImports playwright.database.config.ts playwright/database/consulta.spec.ts playwright/support/preview-database.ts src/lib/preview-database.test.ts
```

As execuções locais devem usar TEMP, caches e relatórios no D e ocorrer na janela de recursos liberada. O recibo deve distinguir checagens locais dos seis casos reais, identificar app/testes, registrar contagens e retenção, sem valores de credenciais. Esta preparação não autoriza merge, deploy ou entrega antes da conclusão das 69 aulas e da revisão final.

## Referências

O [contrato de conexão/destroy do Kysely](https://kysely-org.github.io/kysely-apidoc/classes/Kysely.html#connection), o [pool do node-postgres](https://node-postgres.com/apis/pool) e os [advisory locks do PostgreSQL](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS) sustentam o lifecycle e a exclusão cooperativa. A [documentação SSL do pg](https://node-postgres.com/features/ssl) explica por que opções de conexão não devem substituir silenciosamente a configuração TLS explícita.
