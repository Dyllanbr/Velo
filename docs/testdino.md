# Relatórios Playwright no TestDino

O projeto usa `@testdino/playwright` na versão exata `2.6.2`, registrada no `yarn.lock`. O reporter envia resultados durante a execução. Os relatórios HTML e anexos locais continuam nos artefatos do GitHub Actions, com retenção de sete dias.

## Configuração

1. No TestDino, abra o projeto **Velo**, em **Settings → API Keys**, e use uma Project API key autorizada para o pipeline desse projeto.
2. No repositório **Dyllanbr/Velo**, abra **Settings → Secrets and variables → Actions → New repository secret**.
3. Use o nome `TESTDINO_TOKEN` e salve o valor da chave no campo Secret. Não coloque a chave no código, em `.env` rastreado, na descrição do PR ou em capturas de tela.

O workflow fornece esse segredo somente aos passos Playwright. Pull requests executam sem ele. Fora de pull requests, a etapa de qualidade falha se o segredo estiver ausente, antes de publicar qualquer ambiente. Localmente, o reporter é opcional: sem `TESTDINO_TOKEN`, só os reporters locais são carregados.

## Identificar as duas execuções

| Tag | Conteúdo | Destino do teste |
| --- | --- | --- |
| `local-mock` | Suíte de navegador com respostas simuladas | `http://127.0.0.1:4173` |
| `preview` | Compra e consulta reais no ambiente isolado | URL imutável retornada pelo deploy de Preview |

Ambas recebem também a tag `velo`. A URL de Preview vem da saída do deploy no mesmo workflow; não é copiada de uma execução anterior. O teste de Preview valida o marcador do build e o SHA antes da compra e anexa a identidade do pedido e as evidências de rede e preflight.

## Dados enviados

A chave é lida do ambiente pelo SDK, sem aparecer nas opções serializadas dos reporters. `artifacts: false` desativa o envio dos arquivos de screenshots, vídeos, traces e anexos pelo TestDino; `debug: false` reduz diagnósticos. O endpoint é fixado em `https://reporter.testdino.com`, e a configuração recusa o override `TESTDINO_CLI_CONFIG_PATH`.

Essas opções não tornam a execução anônima: resultados, nomes de testes, etapas, erros, stdout e metadados ainda podem ser enviados. Não imprima credenciais ou dados reais nos testes. A consulta adicional ao autor do GitHub está desativada no workflow. Os testes usam identidades sintéticas.

O bypass da Vercel é usado somente pelo transporte protegido do teste de Preview, que evita sua instrumentação em chamadas HTTP do Playwright. Ele não é incluído em metadados, opções do reporter ou variáveis `VITE_*`.

## Verificar o envio

Depois de uma execução da main, confira no projeto Velo do TestDino as duas entradas, o commit e as contagens correspondentes aos logs do GitHub. No relatório de Preview, confira a URL imutável e relacione o resultado ao `isolation-evidence.json` preservado no artefato do GitHub.

Um job verde sozinho não comprova recebimento no TestDino: falhas de autenticação, limite de uso ou transporte podem impedir a publicação do relatório sem mudar o resultado dos testes. Se uma entrada não aparecer, confira a validade/escopo da chave e os diagnósticos saneados; não recrie credenciais ou repita compras reais sem identificar a causa.

O E2E não consulta produção. A ausência do pedido lá continua sendo comprovada por auditoria SQL externa ao CI, vinculada ao mesmo número e e-mail sintéticos. TestDino organiza resultados; não substitui essa evidência de isolamento.

Referências: [reporter oficial](https://docs.testdino.com/cli/testdino-playwright-nodejs), [GitHub Actions](https://docs.testdino.com/integrations/ci-cd/github) e [Project API keys](https://docs.testdino.com/guides/generate-api-keys).
