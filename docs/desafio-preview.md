# Desafio: preview isolado e publicação verificável

## Estado desta entrega

Retrato da execução em **18/09/2026**, com o [PR #2 ainda em draft](https://github.com/Dyllanbr/Velo/pull/2). A integração local atual passou com 19 E2E, 51 unitários, seis guards, tipos, build e lint completo (zero erros, sete avisos). O último CI remoto conferido antes desta atualização corresponde a [`af742bc`](https://github.com/Dyllanbr/Velo/commit/af742bc). **O desafio ainda não tem evidência de isolamento remoto nem de publicação em produção.**

| Item | Estado confirmado |
| --- | --- |
| Qualidade no GitHub | `Unit and browser checks` passou na [execução 35322964915](https://github.com/Dyllanbr/Velo/actions/runs/35322964915), para `af742bc`: 51 unitários, seis guards, 12 E2E locais, tipos e build. Os sete cenários acrescentados depois foram conferidos na integração local acima. |
| Execução do PR | O [run 35322968592](https://github.com/Dyllanbr/Velo/actions/runs/35322968592) terminou com sucesso. Preview e produção foram pulados por se tratar de pull request. |
| Preview no push 35322964915 | Falhou em `Validate configuration before contacting Vercel`, com configuração incompleta. Pull, build, deploy, verificação remota e E2E real foram pulados; produção também foi pulada. O status do step não identifica sozinho qual variável faltava. |
| Vercel | Projeto `velo` criado, plano Hobby ativo; framework Vite, Node 24.x, instalação `yarn install --frozen-lockfile`, build `yarn build` e saída `dist`. As três variáveis `VITE_SUPABASE_*` de Production foram configuradas. |
| GitHub | Environments `preview` e `production` criados. Quatro Repository variables configuradas: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PRODUCTION_SUPABASE_PROJECT_REF` e `PRODUCTION_SUPABASE_URL`. Secret `PRODUCTION_SUPABASE_ANON_KEY` configurado, confirmado às 03:04:04 UTC; valor não reproduzido. |
| Token de CI | Após autorização específica, `Velo-GitHub-Actions-7dias` foi criado pelo painel, restrito ao projeto `velo`, com expiração em 25/09/2026. O GitHub confirmou o armazenamento como Repository secret `VERCEL_TOKEN`. Seu uso no deploy ainda depende da configuração de preview. |
| Supabase de preview | Ainda não existe um segundo projeto dedicado ao Velô. O painel confirmou plano Free e limite de dois projetos gratuitos ativos já atingido; a criação está desabilitada. O usuário pediu para aguardar antes de pausar o outro projeto. Branching não está disponível. Nenhum projeto foi pausado nem plano alterado. |
| Banco de produção | O schema observado corresponde ao resultado final das quatro migrações locais, mas a listagem do histórico remoto está vazia. Não houve `db push`, `migration repair`, reset ou alteração do schema nessa conferência. |

Os IDs públicos da Vercel usados na configuração são `team_pTNVD9mWcQAWzppxe16GoBd9` (Team/Org) e `prj_UHZEp71N2PnNIQMqm34i1VqMq4XD` (Project). Eles identificam os destinos; não são tokens de acesso. Valores de chaves e credenciais não são reproduzidos nesta documentação.

O relatório Playwright de testes locais do run 35308673588 foi preservado no acervo privado em `D:\Projetos\Automatiza-Ai\Evidencias\GitHub\run-35308673588\playwright-report`, antes da expiração do artefato. Esse relatório usa rede simulada e não comprova isolamento remoto. Os registros anteriores também foram mantidos.

Para concluir: viabilizar o projeto Supabase de preview, aplicar nele schema/RLS/funções, completar variáveis e secrets dos dois ambientes e executar novamente o fluxo com o token configurado. A configuração parcial da Vercel/GitHub não substitui um deploy bem-sucedido. Não registre os testes com rede simulada como evidência de isolamento remoto.

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

Crie um novo projeto vazio para preview. A região pode ser a mesma de produção. Não copie pedidos reais para esse ambiente. Aplique os arquivos existentes em `supabase/migrations` e publique todas as funções existentes em `supabase/functions`, conservando a configuração em `supabase/config.toml` e as políticas RLS.

Use a CLI já presente nas dependências. Antes de cada vínculo, confira o ref no dashboard. A senha do banco e o access token devem ser informados em variáveis de sessão, nunca escritos em comandos versionados ou em arquivos rastreados.

```powershell
# Execute somente depois de criar o projeto e conferir o seu ref.
. 'D:\Projetos\Automatiza-Ai\Iniciar-Ambiente.ps1'
$projectDir = 'D:\Projetos\Velo'
$supabaseCli = Join-Path $projectDir 'node_modules\.bin\supabase.cmd'
$previewRef = '<ref-do-projeto-preview>'
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

Esse roteiro Windows usa a CLI já instalada no projeto e verifica o vínculo salvo antes de cada `db push`. Em PowerShell, uma falha de um programa externo não interrompe necessariamente as linhas seguintes; por isso os códigos de saída são conferidos explicitamente. Os comandos acima ainda não foram executados contra um novo preview. Não execute outro `supabase link` concorrente nesse diretório durante a aplicação.

Em produção, a conferência somente de metadados encontrou os efeitos das quatro migrações: criação de `orders`/RLS/trigger (`20251221161820`), adição de `optionals` (`20251221163213`), remoção de `interior_color` (`20251221205335`) e renomeação de `exterior_color` para `color` (`20251221205414`). O histórico remoto foi listado sem versões. Isso não informa quem aplicou o schema nem por qual mecanismo; reaplicar cegamente tentaria criar objetos existentes.

Essa divergência entre schema e histórico continua pendente de reconciliação. Não foi executado `db push` ou `migration repair` em produção. Não execute reset nem limpeza de tabelas. O workflow publica o frontend e **não executa migrações de banco automaticamente**; a preparação de um preview vazio e a reconciliação do histórico de produção são etapas distintas.

Confirme nas duas plataformas que as funções usadas pelo checkout estão disponíveis. O E2E de preview agora envia `{}` para `credit-analysis` e exige HTTP 400 com `CPF é obrigatório`, antes de criar o pedido. Esse corpo alcança a validação inicial do handler local antes da chamada externa, comportamento coberto por teste. Um 401, 404 ou contrato diferente interrompe o E2E. O resultado é anexado ao relatório sem credenciais. Essa checagem mínima não substitui a comparação do código e da configuração das funções entre os dois projetos.

Políticas RLS determinam o que a chave pública pode ver: HTTP 200 com `[]` também pode significar linhas ocultas. A auditoria inicial encontrou SELECT `USING (true)`, mas a prova final deve incluir uma nova comparação de policies e a conferência do identificador sintético por leitura privilegiada, junto ao run remoto. Essa coleta será feita fora do CI com acesso existente, sem acrescentar uma credencial administrativa ao GitHub. Uma falha de permissão ou uma consulta pública vazia sem essa evidência não comprova ausência.

O workflow não consome essa auditoria externa como condição automática de promoção. A sincronização de schema/funções/RLS e a leitura privilegiada precisam ser preservadas como evidências complementares do aceite, relacionadas ao run real. Um job verde sozinho não comprova esses itens.

## Configurar Vercel

O projeto `velo` já existe no time e IDs registrados acima, com framework Vite, Node 24.x e plano Hobby ativo. As configurações remotas conferidas são instalação `yarn install --frozen-lockfile`, build `yarn build` e saída `dist`, compatíveis com `vercel.json`. O código exige que o resultado de `vercel pull` corresponda aos IDs esperados; nome/slug não substituem esses IDs.

As três variáveis abaixo já foram configuradas no escopo **Production**. O escopo **Preview** permanece dependente do novo Supabase. Complete e confira os dois escopos separadamente:

| Variável Vercel | Preview | Production |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL HTTPS do novo Supabase | `https://zbfdffxonoztoydpdlru.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | Ref do novo Supabase | `zbfdffxonoztoydpdlru` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key ou JWT `anon` de preview | Publishable key ou JWT `anon` de produção |

As três variáveis devem ter valores iguais aos respectivos valores do GitHub abaixo. O guard verifica os valores baixados da Vercel sem imprimir as chaves. Não crie outras variáveis `VITE_*` sem revisar o allowlist, pois elas são expostas ao navegador. Nunca use `service_role`, `sb_secret_*`, senha do banco ou access token como variável `VITE_*`.

O formato aceito pelo guard não garante autenticação na Edge Function. O retrato de produção registra `credit-analysis` com `verify_jwt: true`; o preflight envia `Authorization: Bearer` apenas para JWT e somente `apikey` para publishable. Para conservar esse modelo, use um JWT público `anon` do respectivo projeto, quando disponível, e confirme a resposta HTTP 400 ao corpo vazio. O uso de publishable exige antes revisar a autenticação equivalente dos dois projetos; não desative a verificação apenas para obter um teste verde.

Se Deployment Protection estiver habilitado, configure um segredo de bypass para automação e guarde-o no GitHub. O código envia esse header somente ao deploy correspondente. Mantenha a proteção habilitada; respostas 401/403 devem ser resolvidas com a configuração de automação. Configure também o escopo de produção se o deploy staged for protegido.

## Configurar GitHub

Os environments `preview` e `production` já foram criados. Estão confirmadas as quatro Repository variables listadas no estado da entrega e os secrets `PRODUCTION_SUPABASE_ANON_KEY` e `VERCEL_TOKEN`. Os refs/URLs e a chave pública de preview dependem do novo Supabase. O bypass de proteção deve ser conferido conforme a configuração dos deploys.

Os valores compartilhados abaixo podem ser **Repository variables/secrets**, acessíveis a ambos; se preferir variáveis por environment, preencha os nomes em todos os environments que os utilizam. A proteção da `main` e a exigência do check de qualidade devem ser conferidas; não são dadas como configuradas por este documento. Proteções extras de aprovação do environment de produção são opcionais, conforme o plano da conta e a política do projeto.

| Nome | Tipo | Uso |
| --- | --- | --- |
| `VERCEL_ORG_ID` | Variable | Team/Org ID da Vercel |
| `VERCEL_PROJECT_ID` | Variable | Project ID do Velo |
| `PREVIEW_SUPABASE_PROJECT_REF` | Variable | Ref do novo projeto |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Variable | `zbfdffxonoztoydpdlru` |
| `PREVIEW_SUPABASE_URL` | Variable | URL HTTPS canônica do projeto de preview |
| `PRODUCTION_SUPABASE_URL` | Variable | URL HTTPS canônica do projeto de produção |
| `PREVIEW_SUPABASE_ANON_KEY` | Secret | Chave pública de preview, apesar do nome aceita publishable key |
| `PRODUCTION_SUPABASE_ANON_KEY` | Secret | Configurado; chave pública de produção para build e consulta de ausência |
| `VERCEL_TOKEN` | Secret | Token com acesso ao projeto no time correto |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Secret, se necessário | Acesso da automação aos deploys protegidos |

Nenhuma service key é necessária. O nome “Secret” no GitHub é a forma de armazenamento; as chaves `anon`/publishable continuam sendo credenciais públicas do frontend. O GitHub mascara os valores nos logs e o guard não os escreve deliberadamente.

## Executar e comprovar

Depois de resolver as pendências de configuração, reexecute o run de push do SHA desejado na branch `feat/preview-isolado`, conferindo o commit em Actions. O run 35322964915 documenta qualidade verde e bloqueio preventivo de `af742bc`, não um preview aprovado. Se houver alterações posteriores, escolha o run do novo push autorizado. Não dependa de dispatch enquanto o workflow não estiver disponível na branch padrão. Abra a execução: todos os checks precisam passar. Guarde o relatório Playwright, a evidência JSON com o identificador único do pedido e a URL imutável do deploy. Os artefatos ficam disponíveis por sete dias; baixe a evidência necessária para a apresentação.

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
