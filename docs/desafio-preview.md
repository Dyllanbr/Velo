# Desafio: preview isolado e publicação verificável

## Aceite no domínio público — 18/09/2026

O [resultado final do PR #2](https://github.com/Dyllanbr/Velo/pull/2) registra o aceite no domínio [velo-one-alpha.vercel.app](https://velo-one-alpha.vercel.app/) para o SHA `0e46bdd5181039960244284c5d5a5ee1101a6afe`, após o [run 35369214476](https://github.com/Dyllanbr/Velo/actions/runs/35369214476). A aplicação criou um pedido sintético à vista com um POST 201 e o consultou com GET 200. A auditoria SQL correlacionada confirmou presença em produção e ausência no preview, sem filtragem RLS ativa nas sessões de leitura. O pedido foi distinto daquele criado pelo E2E de preview. Não houve chamada de crédito nesse aceite.

A publicação posterior da main `3aeccdebce59de2957593bc1bd403fd6dd855279`, [run 35372576984](https://github.com/Dyllanbr/Velo/actions/runs/35372576984), passou os três jobs com 94 unitários, 23 testes Node, 19 E2E locais e um E2E real no preview. O [PR #3](https://github.com/Dyllanbr/Velo/pull/3) reúne a verificação dessa publicação: ausência do seu pedido de preview em produção e leitura do domínio público com o marcador novo e hashes de HTML/script iguais aos do aceite 0e46bdd. A escrita em produção não foi repetida; seu recibo permanece associado ao SHA original. Novos commits exigem seus próprios resultados de CI e evidências correspondentes.

## Fotografia histórica do primeiro promote — 18/09/2026

O [PR #2](https://github.com/Dyllanbr/Velo/pull/2) foi integrado à `main` no SHA [`98eb6bb6fa4d65f1d22e33229e72c4792561d9b5`](https://github.com/Dyllanbr/Velo/commit/98eb6bb6fa4d65f1d22e33229e72c4792561d9b5). A [execução 35367456549, tentativa 1](https://github.com/Dyllanbr/Velo/actions/runs/35367456549) concluiu os três jobs com sucesso: qualidade, preview/E2E e produção/promote. Esta seção descreve esse run e as evidências complementares preservadas; não representa monitoramento contínuo. O [PR #2 reúne o resultado final do aceite e seus recibos](https://github.com/Dyllanbr/Velo/pull/2).

| Item | Estado confirmado |
| --- | --- |
| Qualidade no GitHub | 94 unitários, 23 testes Node, 19 E2E locais (19,2 s), tipos e build aprovados. Lint: zero erros e sete avisos de Fast Refresh. São resultados do SHA da main, executados nesse run. |
| Execução de PR | O workflow executa somente qualidade em pull requests; preview e produção são pulados por condição. Um PR verde não demonstra deploy ou isolamento remoto. |
| Preview e isolamento | Pull, prepare, build, inspeção do bundle, deploy, verificação HTTP e upload de evidências passaram. Um E2E real passou (8,6 s), sem retry: pedido `VLO-P70JV8`, uma ocorrência no preview e zero em produção. Backend somente preview, duas supressões da toolbar exata e nenhum redirect/origem desconhecida registrado. |
| Ausência complementar em produção | Leitura privilegiada dirigida confirmou zero pelo número do pedido e pelo e-mail sintético da mesma execução; `row_security_active: false` naquela sessão SQL. Isso demonstra ausência no snapshot consultado, não ausência futura nem desativação do RLS da tabela. |
| Produção e promote | Novo build com variáveis Production no mesmo SHA testado, inspeção de bundle, stage, verificação HTTP e promote aprovados. A URL verificada e promovida foi `https://velo-6voj7qar4-dyllanbrs-projects.vercel.app`; o artefato de preview não foi reutilizado. |
| Vercel | Projeto `velo`, plano Hobby, Vite, Node 24.x, instalação `yarn install --frozen-lockfile`, build `yarn build`, saída `dist`. As três `VITE_SUPABASE_*` de Preview estão configuradas com `bcsepghyrzmabmmdinuy`; as três de Production foram preservadas. |
| GitHub | Environments `preview`/`production`, seis Repository variables e quatro secrets confirmados: `PREVIEW_SUPABASE_ANON_KEY`, `PRODUCTION_SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_AUTOMATION_BYPASS_SECRET`. Valores de credenciais não são reproduzidos. |
| Acesso da automação | Token temporário de sete dias, escopo da equipe `dyllanbr's projects` / All Projects, substituiu o token restrito ao projeto para permitir a leitura da equipe exigida pelo pull; expiração exibida: 25/09/2026. Bypass do projeto armazenado, com Require Log In preservado. O run da main validou os acessos de preview e produção. |
| Supabase de preview | `velo-preview`, ref `bcsepghyrzmabmmdinuy`, ativo e distinto da produção. Quatro migrations aplicadas e `credit-analysis` implantada. O projeto de preview já foi provisionado; não é necessário criar outro para repetir esta etapa. |
| Comparação dos bancos | Catálogos comparados com resultado `schema_match`: colunas, PK/constraints, índices, RLS/policies, triggers e função SQL de timestamp coincidem. Produção tem histórico de migrações vazio; preview registra quatro versões. Não houve `db push` ou `migration repair` em produção. As fontes Supabase permaneceram iguais entre a comparação e o SHA de merge; isso vincula o código, sem alegar uma nova coleta remota no instante do promote. |
| Função de crédito | Fonte de produção comparada com a local, idêntica após normalizar CRLF/LF. Preflight real no preview retornou HTTP 400 e exatamente `{"error":"CPF é obrigatório"}`, com `verify_jwt: true`. Não comprova integração externa de crédito nem substitui o E2E remoto. |

Os IDs públicos da Vercel usados na configuração são `team_pTNVD9mWcQAWzppxe16GoBd9` (Team/Org) e `prj_UHZEp71N2PnNIQMqm34i1VqMq4XD` (Project). Eles identificam os destinos; não são tokens de acesso. Valores de chaves e credenciais não são reproduzidos nesta documentação.

Metadados do run, log completo, relatórios, JSONs de isolamento/rede/preflight e auditoria privilegiada foram preservados no acervo privado em `D:\Projetos\Automatiza-Ai\Evidencias`, associados ao SHA e à tentativa. O relatório local usa rede simulada; a prova remota está no relatório de preview e na auditoria complementar. Os relógios local e GitHub não foram reconciliados: cada timestamp conserva sua origem, sem inferir uma cronologia entre serviços a partir deles.

O escopo desta fotografia termina no promote e na ausência do pedido de preview em produção. Ela **não comprova uma operação distinta de escrita e consulta da aplicação no domínio público de produção**. Consulte o [resultado do PR #2](https://github.com/Dyllanbr/Velo/pull/2) para verificar os recibos dessa etapa; ela não deve ser deduzida de um job verde ou da abertura da página inicial.

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

Políticas RLS determinam o que a chave pública pode ver: HTTP 200 com `[]` também pode significar linhas ocultas. A comparação auditada encontrou SELECT `USING (true)` nos dois projetos, e a consulta privilegiada da main confirmou ausência dos identificadores sintéticos com `row_security_active: false` naquela sessão SQL. Para cada novo aceite, preserve a comparação de policies e a leitura privilegiada dirigida ao pedido da execução, fora do CI e sem acrescentar uma credencial administrativa ao GitHub. Se as políticas mudarem, repita sua comparação. Uma falha de permissão ou uma consulta pública vazia sem prova de visibilidade não comprova ausência.

O workflow não consome essa auditoria externa como condição automática de promoção. A sincronização de schema/funções/RLS e a leitura privilegiada precisam ser preservadas como evidências complementares do aceite, relacionadas ao run real. Um job verde sozinho não comprova esses itens.

## Configurar Vercel

O projeto `velo` já existe no time e IDs registrados acima, com framework Vite, Node 24.x e plano Hobby ativo. As configurações remotas conferidas são instalação `yarn install --frozen-lockfile`, build `yarn build` e saída `dist`, compatíveis com `vercel.json`. O código exige que o resultado de `vercel pull` corresponda aos IDs esperados; nome/slug não substituem esses IDs.

As três variáveis abaixo foram configuradas em **Preview** e **Production**. No run auditado da main, os guards dos dois ambientes validaram as chaves públicas e as configurações; os dois builds e seus bundles servidos passaram na verificação. A tabela descreve a configuração requerida pelo modelo atual. Em cada nova configuração, confira tipo/role/ref da chave sem imprimir seu valor:

| Variável Vercel | Preview | Production |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://bcsepghyrzmabmmdinuy.supabase.co` | `https://zbfdffxonoztoydpdlru.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `bcsepghyrzmabmmdinuy` | `zbfdffxonoztoydpdlru` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | JWT público `anon` do preview | Chave pública `sb_publishable_*` de produção preservada na configuração |

As três variáveis devem ter valores iguais aos respectivos valores do GitHub abaixo. O guard verifica os valores baixados da Vercel sem imprimir as chaves. Não crie outras variáveis `VITE_*` sem revisar o allowlist, pois elas são expostas ao navegador. Nunca use `service_role`, `sb_secret_*`, senha do banco ou access token como variável `VITE_*`.

O nome `VITE_SUPABASE_PUBLISHABLE_KEY` aceita os dois formatos públicos. A configuração observada usa JWT `anon` em preview e `sb_publishable_*` em produção; a chave opaca não possui role/ref decodificáveis, portanto seu vínculo exige conferir URL, projeto, bundle e resposta do serviço. `credit-analysis` usa `verify_jwt: true`; o preflight envia `Authorization: Bearer` somente para JWT e apenas `apikey` para publishable. Esse preflight foi executado no preview. O aceite de produção à vista não chama a função nem comprova compatibilidade dessa chave com o caminho de crédito. Revise e teste esse contrato antes de usar financiamento real, sem desativar a verificação apenas para obter um teste verde.

Se Deployment Protection estiver habilitado, configure um segredo de bypass para automação e guarde-o no GitHub. O código envia esse header somente ao deploy correspondente. Mantenha a proteção habilitada; respostas 401/403 devem ser resolvidas com a configuração de automação. Configure também o escopo de produção se o deploy staged for protegido.

## Configurar GitHub

Na fotografia auditada, estavam configurados os environments `preview` e `production`, as seis Repository variables e os quatro secrets listados abaixo. O token temporário de equipe foi salvo em `VERCEL_TOKEN`, e o bypass do projeto em `VERCEL_AUTOMATION_BYPASS_SECRET`. Os jobs separados de preview e produção da main usaram esses acessos com sucesso. A validade de sete dias do token, com expiração exibida em 25/09/2026, exige renovação autorizada para execuções posteriores; o nome do secret não garante que a credencial continue válida.

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
| `PRODUCTION_SUPABASE_ANON_KEY` | Secret | Chave pública de produção para build e consulta de ausência; igual ao valor Vercel Production. O nome do secret não impõe formato JWT. |
| `VERCEL_TOKEN` | Secret | Token temporário autorizado da equipe / All Projects; acesso ao projeto e à leitura da equipe exigida pelo `pull` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Secret, se necessário | Acesso da automação aos deploys protegidos |

Nenhuma service key é necessária. O nome “Secret” no GitHub é a forma de armazenamento; as chaves `anon`/publishable continuam sendo credenciais públicas do frontend. O GitHub mascara os valores nos logs e o guard não os escreve deliberadamente.

Na CLI **59.15.1** fixada neste workflow, `pull` consulta os dados da equipe mesmo com `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` definidos. A tentativa 2, com token restrito ao projeto, falhou em `Download preview settings` com `Could not retrieve Project Settings`; o comportamento é compatível com a [issue oficial #17506](https://github.com/vercel/vercel/issues/17506). Acrescentar `--scope` não remove essa consulta. Com o token de equipe configurado, o pull passou na tentativa 3 com os mesmos IDs e workflow. O status HTTP interno da tentativa 2 não foi registrado, portanto não se afirma que ela comprovou o mesmo 403 do relato externo.

## Executar e comprovar

Escolha a execução pelo **SHA completo**, não pelo número de run de um retrato anterior. A referência desta fotografia é `98eb6bb6fa4d65f1d22e33229e72c4792561d9b5`, [run 35367456549, tentativa 1](https://github.com/Dyllanbr/Velo/actions/runs/35367456549), na `main`: qualidade, preview/E2E e produção/promote passaram nessa execução. Se o código ou esta documentação forem commitados e enviados depois, o novo SHA terá outro run: confira o novo push em Actions e associe as evidências a ele. Não copie os identificadores do pedido anterior como se pertencessem ao novo run, não crie commit vazio nem promova um SHA diferente do testado.

Use uma execução da branch prevista pelo workflow; um dispatch fora dessas condições não autoriza deploy. A execução de aceite precisa passar pull, prepare, build, inspeção do bundle, deploy, verificação HTTP e E2E reais; guard verde ou deploy isolado não bastam. Guarde o relatório Playwright e `isolation-evidence.json` com pedido, SHA, refs, URL imutável e horário, além dos anexos de rede e preflight. Preserve os artefatos antes dos sete dias de retenção e vincule a consulta privilegiada de ausência em produção ao mesmo pedido sintético.

O pedido de teste permanece identificado em preview como evidência. Não há limpeza destrutiva automática. Os testes não criam pedidos em produção. Se for necessário limpar preview depois da gravação, remova apenas os identificadores explicitamente registrados pela execução.

Depois do merge na `main`, a pipeline repete preview/E2E no SHA resultante do merge e só então publica produção. Confira no summary o SHA aprovado, abra o deploy Current na Vercel e inspecione a requisição Supabase no navegador: o hostname precisa ser o de produção. `/build-info.json` deve informar `environment: production` e o mesmo SHA. O workflow verifica o bundle staged por HTTP, mas a confirmação visual do domínio final faz parte da demonstração.

A conferência do bundle e do hostname comprova a configuração do destino, não uma escrita efetivamente persistida. O critério de leitura/escrita após o promote exige evidência própria de uma operação da aplicação e sua posterior consulta em produção, distinguida dos E2E que continuam restritos ao preview. Use uma identidade sintética nova e relacione pedido, deployment, SHA, consulta posterior e contagens nos dois bancos; preserve o resultado no [PR da entrega](https://github.com/Dyllanbr/Velo/pull/2). Reapresentar a evidência em vídeo não exige criar outro pedido.

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
node --test scripts/ci-guards.test.mjs scripts/verify-deployment.test.mjs
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
- Falha HTTP: o verificador informa método, caminho, status e, quando presentes e válidos, `x-vercel-error`/`x-vercel-id`. Não imprime query strings, corpos ou bypass. Somente o GET inicial de `/build-info.json`, se retornar **404 com `x-vercel-error: DEPLOYMENT_NOT_FOUND`**, admite até quatro tentativas, com pausas de 1/2/4 segundos e janela total de 15 segundos compartilhada com os requests. Cada tentativa mantém seu diagnóstico; o esgotamento falha. Essa tolerância à indisponibilidade inicial não comprova sua causa. 401/403, outros 404, falhas de rede, redirects, JSON/identidade incorretos e falhas posteriores do bundle/SPA interrompem a verificação sem retry. Nenhum redirect é seguido, e um marcador recuperado ainda precisa passar SHA, ambiente, ref e as demais checagens. Confira também o [guia oficial de diagnóstico](https://vercel.com/kb/guide/how-to-debug-404-errors).
- Toolbar da plataforma: a Vercel pode incluir `https://vercel.live/_next-live/feedback/feedback.js`, endereço da [toolbar documentada](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost/add-to-localhost). O verificador ignora somente esse `src` literal ao analisar o bundle, sem baixá-lo nem enviar o bypass para fora do deployment. Variantes com query, fragmento, credenciais, outro host/path ou URL externa desconhecida continuam bloqueadas. Todas as fontes são classificadas antes do download; exige-se pelo menos um script do próprio deployment, cujo conteúdo ainda deve passar pelos guards de ambiente. No E2E, somente o GET exato desse recurso do tipo `script` é abortado como opcional conhecido; POST, outros tipos/URLs e destinos desconhecidos continuam registrados como bloqueados. O anexo `browser-network-evidence.json` e a evidência de isolamento registram a supressão e as origens backend. A configuração da toolbar e as proteções da Vercel permanecem intactas.
- Bypass e redirects no navegador: headers sobrescritos por [`route.continue`](https://playwright.dev/docs/api/class-route#route-continue) podem acompanhar redirects. Por isso, apenas o ramo do aplicativo usa `route.fetch` com `maxRedirects: 0` e entrega a resposta com `route.fulfill`; respostas 3xx são registradas e abortadas antes de chegar ao navegador. O anexo `blocked-app-redirect.json` contém somente origem/status/ação, sem Location ou headers. As chamadas Supabase não recebem bypass.
- Vercel Preview/Production diferente do GitHub: corrigir o escopo de origem e repetir o pull/build.
- Build com URL do outro ambiente: descartar o artefato e reconstruir no escopo correto.
- Ref ou chave errada: bloquear antes de qualquer escrita; JWT `anon` é conferido por papel/ref, enquanto publishable keys opacas dependem da validação pela API real.
- Preview verde não prova produção: produção tem seu próprio build e verificação de URL no JavaScript servido.
- Testes locais simulados não substituem o E2E real e a consulta aos dois bancos.
- O E2E de isolamento usa compra à vista e faz antes um preflight vazio de `credit-analysis`. Esse preflight comprova somente presença e contrato mínimo da função de preview; sincronização de código/configuração nos dois projetos e integração externa continuam exigindo evidência própria.
- Exposição histórica: arquivos sensíveis foram removidos do rastreamento, mas o histórico anterior não foi reescrito. A revisão por padrões dos novos commits identificou apenas duas fixtures negativas já conferidas; isso não prova ausência de segredos arbitrários nem resolve uma exposição anterior. A remoção no estado atual não substitui rotação na plataforma. Não faça force-push do histórico sem planejamento.
