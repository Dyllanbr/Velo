# Desafio: preview isolado e publicação verificável

## Estado desta entrega

Retrato conferido em **18/09/2026 às 14:53 UTC**, com o [PR #2 ainda em draft](https://github.com/Dyllanbr/Velo/pull/2). A integração local passou com 19 E2E, 51 unitários, seis guards, tipos, build e lint completo (zero erros, sete avisos). A **tentativa 3 do run `35346344943` passou**, para [`ef2c37a9b082acba29cdf0661207bb370729e230`](https://github.com/Dyllanbr/Velo/commit/ef2c37a9b082acba29cdf0661207bb370729e230): preview publicado, verificação HTTP e E2E real aprovados. **O aceite ainda precisa da auditoria complementar de ausência em produção, das evidências preservadas e da publicação verificada de produção.**

| Item | Estado confirmado |
| --- | --- |
| Qualidade no GitHub | `Unit and browser checks` passou na [execução 35346344943](https://github.com/Dyllanbr/Velo/actions/runs/35346344943), para `ef2c37a`, incluindo lint, tipos, guards, unitários, build e E2E locais. O rerun dos jobs falhos preserva esse resultado; não o confundir com nova execução de qualidade. |
| Execução de PR | O workflow executa somente qualidade em pull requests; preview e produção são pulados por condição. Um PR verde não demonstra deploy ou isolamento remoto. |
| Preview na tentativa 3 | Pull, prepare, build, inspeção do bundle, deploy, verificação HTTP, E2E real e upload de evidências passaram. O job terminou às 14:52:51 UTC. Produção foi pulada por se tratar da branch `feat/preview-isolado`. |
| Vercel | Projeto `velo`, plano Hobby, Vite, Node 24.x, instalação `yarn install --frozen-lockfile`, build `yarn build`, saída `dist`. As três `VITE_SUPABASE_*` de Preview estão configuradas com `bcsepghyrzmabmmdinuy`; as três de Production foram preservadas. |
| GitHub | Environments `preview`/`production`, seis Repository variables e quatro secrets confirmados: `PREVIEW_SUPABASE_ANON_KEY`, `PRODUCTION_SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_AUTOMATION_BYPASS_SECRET`. Valores de credenciais não são reproduzidos. |
| Acesso da automação | Após autorização específica, o token temporário de equipe substituiu `VERCEL_TOKEN`; expiração exibida: 25/09/2026. Bypass do projeto criado e armazenado; Require Log In permanece ativo. A tentativa 3 confirmou acesso ao pull/deploy e à verificação HTTP de preview. |
| Supabase de preview | `velo-preview`, ref `bcsepghyrzmabmmdinuy`, ativo e distinto da produção. Quatro migrations aplicadas e `credit-analysis` implantada. A solução da cota foi autorizada e executada; não criar outro preview para repetir esta etapa. |
| Comparação dos bancos | Catálogos comparados com resultado `schema_match`: colunas, PK/constraints, índices, RLS/policies, triggers e função SQL de timestamp coincidem. Produção tem histórico vazio; preview registra quatro versões. Essa diferença está documentada, sem `db push` ou `migration repair` em produção. |
| Função de crédito | Fonte de produção comparada com a local, idêntica após normalizar CRLF/LF. Preflight real no preview retornou HTTP 400 e exatamente `{"error":"CPF é obrigatório"}`, com `verify_jwt: true`. Não comprova integração externa de crédito nem substitui o E2E remoto. |

Os IDs públicos da Vercel usados na configuração são `team_pTNVD9mWcQAWzppxe16GoBd9` (Team/Org) e `prj_UHZEp71N2PnNIQMqm34i1VqMq4XD` (Project). Eles identificam os destinos; não são tokens de acesso. Valores de chaves e credenciais não são reproduzidos nesta documentação.

O relatório Playwright de testes locais do run 35308673588 foi preservado no acervo privado em `D:\Projetos\Automatiza-Ai\Evidencias\GitHub\run-35308673588\playwright-report`, antes da expiração do artefato. Esse relatório usa rede simulada e não comprova isolamento remoto. Os registros anteriores também foram mantidos.

Para concluir: preservar os artefatos do preview aprovado, conferir o identificador sintético por leitura privilegiada em produção e concluir a publicação verificada na main. O E2E real passou, mas sua consulta com chave pública não substitui a auditoria complementar descrita abaixo. Os recibos sanitizados de configuração, catálogos e tentativas estão preservados no acervo privado em `D:\Projetos\Automatiza-Ai\Evidencias`; cada resultado permanece associado ao seu SHA e horário.

O projeto Supabase `zbfdffxonoztoydpdlru` é tratado como produção. O guard o bloqueia como destino de preview. Um projeto de preview diferente é obrigatório. Mudar a produção exige revisar essa constante em `scripts/ci-guards.mjs` e o guard dos testes, com a justificativa no PR.

## Por que existem dois builds

O Vite substitui `VITE_*` quando gera JavaScript. Trocar variáveis depois do build não altera o arquivo que o navegador recebeu. Assim, um bundle produzido com o banco de preview continua apontando para preview, mesmo se receber um domínio de produção. A documentação do [Vite sobre variáveis](https://vite.dev/guide/env-and-mode) explica essa substituição.

A escolha deste projeto é testar um commit em preview e reconstruir **o mesmo SHA** com as variáveis de produção. O artefato de produção é publicado sem mover o domínio (`--prod --skip-domain`), verificado por leitura e então promovido. Esse é o [fluxo de produção staged da Vercel](https://vercel.com/docs/cli/deploying-from-cli). A [documentação do build](https://vercel.com/docs/cli/build) distingue `vercel build` e `vercel build --prod`.

O fluxo em `.github/workflows/quality-and-deploy.yml` é:

1. Instalar a versão travada das dependências; executar lint, conferir os tipos TypeScript e executar testes unitários, guards, build e testes de navegador locais com rede simulada.
2. Em push na `main` ou em `feat/preview-isolado`, baixar configurações de preview e conferir projeto Vercel, URLs, refs e tipo de chave pública.
3. Construir preview, inspecionar os arquivos gerados e publicar o artefato verificado.
4. Conferir `/build-info.json`, JavaScript servido e rotas da SPA; executar os E2E reais contra a URL desse deploy.
5. Criar um pedido único em preview e demonstrar sua presença ali e sua ausência em produção usando somente leitura no banco de produção.
6. Somente na `main`, reconstruir o mesmo SHA com configurações de produção, inspecionar o bundle, publicar staged e verificar por HTTP sem criar pedidos.
7. Recusar uma `main` já ultrapassada por outro commit e promover o deploy de produção verificado.

Pull requests executam somente a qualidade local, sem credenciais. Um dispatch em outra branch também não acessa ambientes. `git.deploymentEnabled: false` em `vercel.json` desativa deploys automáticos pela integração Git que contornariam os testes; veja [Git Configuration da Vercel](https://vercel.com/docs/project-configuration/git-configuration). Deploys manuais fora deste fluxo continuam sendo responsabilidade de quem possui acesso à conta.

## Preparar os dois Supabase

O preview atual **já foi preparado**: `bcsepghyrzmabmmdinuy`. O roteiro abaixo documenta a preparação; não é necessário criar outro projeto nem reaplicá-lo como requisito para um rerun do frontend. Para um novo ambiente deliberadamente escolhido, confira seu ref, use um projeto vazio e aplique os arquivos de `supabase/migrations` e as funções de `supabase/functions`, conservando a configuração e as políticas RLS. Não copie pedidos reais para preview.

Use a CLI já presente nas dependências. Antes de cada vínculo, confira o ref no dashboard. A senha do banco e o access token devem ser informados em variáveis de sessão, nunca escritos em comandos versionados ou em arquivos rastreados.

```powershell
# Roteiro de preparação; já concluído no preview atual.
# Execute somente se houver necessidade de preparar o destino conferido.
. 'D:\Projetos\Automatiza-Ai\Iniciar-Ambiente.ps1'
$projectDir = 'D:\Projetos\Velo'
$supabaseCli = Join-Path $projectDir 'node_modules\.bin\supabase.cmd'
$previewRef = 'bcsepghyrzmabmmdinuy'
if ($previewRef -notmatch '^[a-z]{20}$') { throw 'Informe um ref válido de preview' }
if ($previewRef -eq 'zbfdffxonoztoydpdlru') { throw 'Destino de produção bloqueado' }

function Assert-PreviewLink {
  $refPath = Join-Path $projectDir 'supabase\.temp\project-ref'
  $linkedRef = (Get-Content -LiteralPath $refPath -Raw -ErrorAction Stop).Trim()
  if ($linkedRef -ne $previewRef) { throw 'Projeto vinculado difere do preview esperado' }
}

& $supabaseCli link --workdir $projectDir --project-ref $previewRef
if ($LASTEXITCODE -ne 0) { throw 'Link falhou; nenhuma migração deve ser aplicada' }
Assert-PreviewLink
& $supabaseCli db push --workdir $projectDir --linked --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Dry-run falhou; aplicação interrompida' }
# Confira as migrações listadas e então aplique no projeto de preview.
Assert-PreviewLink
& $supabaseCli db push --workdir $projectDir --linked
if ($LASTEXITCODE -ne 0) { throw 'Migração falhou; deploy de funções interrompido' }
& $supabaseCli functions deploy --workdir $projectDir --project-ref $previewRef
if ($LASTEXITCODE -ne 0) { throw 'Deploy de funções falhou; preparação incompleta' }
```

Esse roteiro Windows usa a CLI já instalada no projeto e verifica o vínculo salvo antes de cada `db push`. Em PowerShell, uma falha de um programa externo não interrompe necessariamente as linhas seguintes; por isso os códigos de saída são conferidos explicitamente. Link, dry-run, quatro migrations e deploy da função já terminaram com sucesso no preview atual. Não execute outro `supabase link` concorrente nesse diretório durante uma aplicação.

Em produção, a conferência somente de metadados encontrou os efeitos das quatro migrações: criação de `orders`/RLS/trigger (`20251221161820`), adição de `optionals` (`20251221163213`), remoção de `interior_color` (`20251221205335`) e renomeação de `exterior_color` para `color` (`20251221205414`). O histórico remoto foi listado sem versões. Isso não informa quem aplicou o schema nem por qual mecanismo; reaplicar cegamente tentaria criar objetos existentes.

Essa divergência entre schema e histórico está documentada: a comparação dos catálogos coincide, mas os históricos não são iguais. Não foi executado `db push` ou `migration repair` em produção; uma eventual reconciliação do histórico exige avaliação própria, não reaplicação automática. Não execute reset nem limpeza de tabelas. O workflow publica o frontend e **não executa migrações de banco automaticamente**.

Confirme nas duas plataformas que as funções usadas pelo checkout estão disponíveis. O E2E de preview envia `{}` para `credit-analysis` e exige HTTP 400 com exatamente `{"error":"CPF é obrigatório"}`, antes de criar o pedido. Esse corpo alcança a validação inicial do handler local antes da chamada externa, comportamento coberto por teste. Um 401, 403, 404 ou contrato diferente interrompe o E2E. O preflight separado e a suíte real já passaram no preview atual; a suíte repete a checagem em cada execução e anexa seu resultado sem credenciais. Essa checagem mínima não substitui a comparação do código e da configuração das funções entre os dois projetos.

Políticas RLS determinam o que a chave pública pode ver: HTTP 200 com `[]` também pode significar linhas ocultas. A auditoria inicial encontrou SELECT `USING (true)`, mas a prova final deve incluir uma nova comparação de policies e a conferência do identificador sintético por leitura privilegiada, junto ao run remoto. Essa coleta será feita fora do CI com acesso existente, sem acrescentar uma credencial administrativa ao GitHub. Uma falha de permissão ou uma consulta pública vazia sem essa evidência não comprova ausência.

O workflow não consome essa auditoria externa como condição automática de promoção. A sincronização de schema/funções/RLS e a leitura privilegiada precisam ser preservadas como evidências complementares do aceite, relacionadas ao run real. Um job verde sozinho não comprova esses itens.

## Configurar Vercel

O projeto `velo` já existe no time e IDs registrados acima, com framework Vite, Node 24.x e plano Hobby ativo. As configurações remotas conferidas são instalação `yarn install --frozen-lockfile`, build `yarn build` e saída `dist`, compatíveis com `vercel.json`. O código exige que o resultado de `vercel pull` corresponda aos IDs esperados; nome/slug não substituem esses IDs.

As três variáveis abaixo já foram configuradas em **Preview** e **Production**. A chave de Preview foi conferida como JWT público `anon`; os valores de Production foram preservados. A tabela descreve a configuração requerida pelo modelo de autenticação atual: antes do aceite de produção, confira também o tipo/role/ref de sua chave sem imprimir o valor. Preview passou na inspeção do bundle; o build de produção ainda precisa demonstrar que incorporou os valores de seu próprio escopo:

| Variável Vercel | Preview | Production |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://bcsepghyrzmabmmdinuy.supabase.co` | `https://zbfdffxonoztoydpdlru.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `bcsepghyrzmabmmdinuy` | `zbfdffxonoztoydpdlru` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | JWT público `anon` do preview | JWT público `anon` da produção, compatível com `verify_jwt: true` |

As três variáveis devem ter valores iguais aos respectivos valores do GitHub abaixo. O guard verifica os valores baixados da Vercel sem imprimir as chaves. Não crie outras variáveis `VITE_*` sem revisar o allowlist, pois elas são expostas ao navegador. Nunca use `service_role`, `sb_secret_*`, senha do banco ou access token como variável `VITE_*`.

**Para o modelo atual da função, configure JWT público `anon` do respectivo projeto.** O nome `VITE_SUPABASE_PUBLISHABLE_KEY` não exige uma chave `sb_publishable_*`. `credit-analysis` usa `verify_jwt: true`; o preflight envia `Authorization: Bearer` somente para JWT e apenas `apikey` para publishable. O guard aceita os dois formatos públicos, mas isso não torna publishable intercambiável com JWT nesse fluxo. Antes de trocar para publishable, revise a autenticação equivalente dos dois projetos e comprove o contrato remoto; não desative a verificação apenas para obter um teste verde.

Se Deployment Protection estiver habilitado, configure um segredo de bypass para automação e guarde-o no GitHub. O código envia esse header somente ao deploy correspondente. Mantenha a proteção habilitada; respostas 401/403 devem ser resolvidas com a configuração de automação. Configure também o escopo de produção se o deploy staged for protegido.

## Configurar GitHub

Os environments `preview` e `production`, as seis Repository variables e os quatro secrets listados abaixo estão confirmados. O novo token de equipe foi salvo em `VERCEL_TOKEN`, e `VERCEL_AUTOMATION_BYPASS_SECRET` foi adicionado após confirmação de identidade no GitHub. A tentativa 3 validou esses acessos no fluxo de preview; o fluxo de produção permanece separado.

Os valores compartilhados abaixo podem ser **Repository variables/secrets**, acessíveis a ambos; se preferir variáveis por environment, preencha os nomes em todos os environments que os utilizam. A proteção da `main` e a exigência do check de qualidade devem ser conferidas; não são dadas como configuradas por este documento. Proteções extras de aprovação do environment de produção são opcionais, conforme o plano da conta e a política do projeto.

| Nome | Tipo | Uso |
| --- | --- | --- |
| `VERCEL_ORG_ID` | Variable | Team/Org ID da Vercel |
| `VERCEL_PROJECT_ID` | Variable | Project ID do Velo |
| `PREVIEW_SUPABASE_PROJECT_REF` | Variable | `bcsepghyrzmabmmdinuy` |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Variable | `zbfdffxonoztoydpdlru` |
| `PREVIEW_SUPABASE_URL` | Variable | URL HTTPS canônica do projeto de preview |
| `PRODUCTION_SUPABASE_URL` | Variable | URL HTTPS canônica do projeto de produção |
| `PREVIEW_SUPABASE_ANON_KEY` | Secret | JWT público `anon` do preview; igual ao valor Vercel Preview |
| `PRODUCTION_SUPABASE_ANON_KEY` | Secret | JWT público `anon` da produção para build, função e consulta de ausência; igual ao valor Vercel Production |
| `VERCEL_TOKEN` | Secret | Token temporário de equipe autorizado, com acesso ao projeto e à leitura da equipe exigida pelo `pull` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Secret, se necessário | Acesso da automação aos deploys protegidos |

Nenhuma service key é necessária. O nome “Secret” no GitHub é a forma de armazenamento; as chaves `anon`/publishable continuam sendo credenciais públicas do frontend. O GitHub mascara os valores nos logs e o guard não os escreve deliberadamente.

Na CLI **59.15.1** fixada neste workflow, `pull` consulta os dados da equipe mesmo com `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` definidos. A tentativa 2, com token restrito ao projeto, falhou em `Download preview settings` com `Could not retrieve Project Settings`; o comportamento é compatível com a [issue oficial #17506](https://github.com/vercel/vercel/issues/17506). Acrescentar `--scope` não remove essa consulta. Após autorização e armazenamento do token de equipe, o pull passou na tentativa 3 com os mesmos IDs e workflow. O status HTTP interno da tentativa 2 não foi registrado, portanto não se afirma que ela comprovou o mesmo 403 do relato externo.

## Executar e comprovar

Escolha a execução pelo **SHA completo**, não pelo número de run de um retrato anterior. A referência aprovada é `ef2c37a9b082acba29cdf0661207bb370729e230`, [run 35346344943, tentativa 3](https://github.com/Dyllanbr/Velo/actions/runs/35346344943), branch `feat/preview-isolado`. A qualidade veio da primeira execução; o preview foi reexecutado na terceira. Não é necessário repetir esse run já aprovado sem uma nova razão. Se o código ou esta documentação forem commitados e enviados depois, o novo SHA terá outro run: confira o novo push em Actions e use-o para a evidência final. Não crie commit vazio nem promova um SHA diferente do testado.

Não dependa de dispatch enquanto o workflow não estiver disponível na branch padrão. A execução de aceite precisa passar pull, prepare, build, inspeção do bundle, deploy, verificação HTTP e E2E reais; guard verde ou deploy isolado não bastam. Guarde o relatório Playwright e `isolation-evidence.json` com pedido, SHA, refs, URL imutável e horário, além do resultado do preflight. Preserve os artefatos antes dos sete dias de retenção e vincule a consulta privilegiada de ausência em produção ao mesmo pedido sintético.

O pedido de teste permanece identificado em preview como evidência. Não há limpeza destrutiva automática. Os testes não criam pedidos em produção. Se for necessário limpar preview depois da gravação, remova apenas os identificadores explicitamente registrados pela execução.

Depois do merge na `main`, a pipeline repete preview/E2E no SHA resultante do merge e só então publica produção. Confira no summary o SHA aprovado, abra o deploy Current na Vercel e inspecione a requisição Supabase no navegador: o hostname precisa ser o de produção. `/build-info.json` deve informar `environment: production` e o mesmo SHA. O workflow verifica o bundle staged por HTTP, mas a confirmação visual do domínio final faz parte da demonstração.

A conferência do bundle e do hostname comprova a configuração do destino, não uma escrita efetivamente persistida. O critério de leitura/escrita após o promote precisa de evidência própria de uma operação da aplicação e sua posterior consulta em produção, distinguida dos E2E que continuam restritos ao preview. Nenhuma operação desse tipo foi realizada nesta entrega até este retrato.

Para um vídeo curto, mostre: projetos Supabase distintos; variáveis Vercel com valores de chave ocultos; execução verde e SHA; pedido único existente no preview e ausente em produção; deploy de produção apontando para seu Supabase; PR com a justificativa dos dois builds.

## Rodar localmente no disco D

Ambiente local utilizado: **Node.js 24.14.0 e Yarn 1.22.22**. A pipeline usa Node 24.x e fixa Yarn 1.22.22; a configuração da Vercel usa Node 24.x. No computador deste trabalho, `Get-Command` encontra `yarn.ps1` e `yarn.CMD` como shims do Corepack em `C:\Program Files\nodejs`; isso não confirma uma versão de Yarn já pronta para uso. A execução local usou `npx.cmd --yes yarn@1.22.22`, que seleciona a versão explicitamente sem instalação global. O Node existente é apenas executado; downloads, dependências e temporários desses comandos ficam no D com a configuração abaixo:

```powershell
Set-Location -LiteralPath 'D:\Projetos\Velo'
New-Item -ItemType Directory -Force 'D:\Projetos\.cache\tmp' | Out-Null
$env:TEMP = 'D:\Projetos\.cache\tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = 'D:\Projetos\.cache\npm'
$env:YARN_CACHE_FOLDER = 'D:\Projetos\.cache\yarn'
$env:COREPACK_HOME = 'D:\Projetos\.cache\corepack'
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:\Projetos\.cache\playwright'
npx.cmd --yes yarn@1.22.22 install --frozen-lockfile
npx.cmd --yes yarn@1.22.22 lint
npx.cmd --yes yarn@1.22.22 typecheck
node --test scripts/ci-guards.test.mjs
npx.cmd --yes yarn@1.22.22 test:unit
npx.cmd --yes yarn@1.22.22 playwright install chromium
npx.cmd --yes yarn@1.22.22 test:e2e
# Gerar o bundle com as variáveis locais e iniciar a aplicação, quando necessário:
npx.cmd --yes yarn@1.22.22 build
npx.cmd --yes yarn@1.22.22 dev
```

Nos demais exemplos locais deste documento, `yarn` pode ser substituído por `npx.cmd --yes yarn@1.22.22`, na mesma sessão configurada. Não é necessário executar `corepack enable` nem instalar Yarn globalmente no C.

A porta padrão de `yarn dev` é **5173**. O `vite.config.ts` não a fixa; se estiver ocupada, use a URL que o Vite imprimir no terminal. O E2E local usa sua própria configuração em `127.0.0.1:4173`, com `strictPort`, valores de ambiente simulados e encerramento automático do servidor. `yarn test:e2e:preview` é a suíte remota e requer todas as configurações reais descritas acima.

Os runners GitHub são Linux hospedado e usam armazenamento descartável deles, não o disco C do computador. O arquivo `public/build-info.json` é gerado pela pipeline; não precisa ser criado manualmente nem versionado. Não envie `.env`, `.vercel`, temporários Supabase, senha de banco ou relatórios que contenham credenciais para o repositório.

## Limites e diagnóstico

- Guard sem variáveis: configuração incompleta; não preencher com placeholders para forçar deploy.
- Vercel Preview/Production diferente do GitHub: corrigir o escopo de origem e repetir o pull/build.
- Build com URL do outro ambiente: descartar o artefato e reconstruir no escopo correto.
- Ref ou chave errada: bloquear antes de qualquer escrita; JWT `anon` é conferido por papel/ref, enquanto publishable keys opacas dependem da validação pela API real.
- Preview verde não prova produção: produção tem seu próprio build e verificação de URL no JavaScript servido.
- Testes locais simulados não substituem o E2E real e a consulta aos dois bancos.
- O E2E de isolamento usa compra à vista e faz antes um preflight vazio de `credit-analysis`. Esse preflight comprova somente presença e contrato mínimo da função de preview; sincronização de código/configuração nos dois projetos e integração externa continuam exigindo evidência própria.
- Um segredo que já esteve no histórico Git continua lá mesmo após a remoção no commit atual. A rotação deve ocorrer na plataforma; não force-push do histórico sem planejamento.
