# Velô Sprint - Configurador de Veículo Elétrico

Aplicação web em React para configuração e compra do veículo elétrico **Velô Sprint**.

## Sobre o Projeto

Uma SPA (Single Page Application) que permite:
- Personalizar cores, rodas e opcionais do veículo
- Calcular preços em tempo real
- Realizar pedidos com análise de crédito
- Consultar status de pedidos

**Especificações do Velô Sprint:** 450 km de autonomia | 0-100 km/h em 3.2s | 500 cv

---

## Stack Tecnológica

| Categoria | Tecnologias |
|-----------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Estado** | Zustand (global), React Hook Form (formulários) |
| **Validação** | Zod |
| **Data Fetching** | TanStack Query |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |

---

## Instalação

Ambiente usado nesta entrega: **Node.js 24.14.0 e Yarn 1.22.22**. No Windows, mantenha projeto, caches e temporários no disco D antes de instalar dependências:

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
npx.cmd --yes yarn@1.22.22 dev
```

Foi essa execução via `npx.cmd` que selecionou o Yarn 1.22.22 localmente, sem instalação global. O `yarn` encontrado no Windows é um shim do Corepack; sua presença não garante essa versão. Nos comandos abaixo, substitua `yarn` por `npx.cmd --yes yarn@1.22.22` nesse terminal, mantendo as variáveis de cache acima.

A porta padrão de desenvolvimento é **5173**: `http://localhost:5173`. O `vite.config.ts` não fixa uma porta; confira a URL impressa no terminal caso ela já esteja ocupada. Os E2E locais iniciam seu próprio servidor na porta 4173.

---

## Configuração do Supabase

### 1. Escolher o ambiente

O desafio usa projetos Supabase separados para **preview** e **produção**, preparados e conferidos na entrega descrita abaixo. Use o ambiente de desenvolvimento/preview para experimentos com banco real. Os testes E2E locais usam rede simulada.

### 2. Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_PROJECT_ID="seu_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_chave_anon_publica"
VITE_SUPABASE_URL="https://seu_project_id.supabase.co"
```

Use apenas a chave pública do ambiente escolhido. As variáveis `VITE_*` são incorporadas ao JavaScript no build. Não versione `.env` nem coloque credenciais administrativas nessas variáveis.

### 3. Banco, funções e deploy

A CLI Supabase já está nas dependências. O schema de produção corresponde ao resultado das quatro migrações locais, mas seu histórico de migrações está vazio. Nenhum `db push` ou `migration repair` foi executado em produção; não reaplique as migrações existentes sem reconciliar esse histórico.

Consulte [o procedimento e o estado do desafio](docs/desafio-preview.md) para configurar os dois ambientes e publicar pelo fluxo de CI/CD.

## Entrega auditada em 18/09/2026

A aplicação está publicada em [velo-one-alpha.vercel.app](https://velo-one-alpha.vercel.app/). O [PR #2](https://github.com/Dyllanbr/Velo/pull/2) reúne o aceite do desafio e os recibos; [o procedimento](docs/desafio-preview.md) explica a separação de ambientes e os limites das verificações.

O aceite no domínio público foi realizado no SHA `0e46bdd5181039960244284c5d5a5ee1101a6afe`, após a [execução 35369214476](https://github.com/Dyllanbr/Velo/actions/runs/35369214476). Um pedido sintético à vista foi criado pela aplicação com POST 201 e consultado com GET 200. Consultas SQL dirigidas confirmaram o registro em produção e sua ausência no preview. Esse aceite não chamou a análise de crédito nem usou o pedido do E2E de preview.

Após as práticas do [PR #3](https://github.com/Dyllanbr/Velo/pull/3), a [execução 35372576984](https://github.com/Dyllanbr/Velo/actions/runs/35372576984) validou e publicou a main `3aeccdebce59de2957593bc1bd403fd6dd855279`: **94 unitários, 23 testes Node, 19 E2E locais e um E2E real no preview**, além de tipos/build; lint com zero erros e sete avisos de Fast Refresh. A ausência do novo pedido de preview em produção foi confirmada também por leitura privilegiada. A leitura posterior do domínio público conferiu o novo marcador e os mesmos hashes de HTML/script do aceite anterior, sem repetir a escrita em produção. Esses resultados são retratos dos SHAs indicados, não uma aprovação automática de commits posteriores.

---

## Validação da main em 20/09/2026

O [PR #11](https://github.com/Dyllanbr/Velo/pull/11) foi integrado na main `63696673f034a37a5e0898169552b34b969a8cde`. A [execução 35481291413](https://github.com/Dyllanbr/Velo/actions/runs/35481291413) concluiu os três jobs de qualidade, Preview e produção com sucesso: **329 testes Vitest, 23 testes Node, 29 E2E locais com mocks e um E2E real de isolamento no Preview**, sem retries nos E2E. Tipos e build passaram; lint terminou com **zero erros e sete avisos de Fast Refresh**. Produção foi reconstruída com suas próprias variáveis, verificada e promovida no SHA testado.

No mesmo SHA, o [domínio público](https://velo-one-alpha.vercel.app/) concluiu um aceite à vista em 20/09/2026 às 01:40 UTC: criação com POST 201 e consulta com GET 200. Consultas SQL dirigidas por número e e-mail confirmaram um registro em produção e nenhum no Preview, com visibilidade privilegiada dos registros, sem alterar as políticas RLS. Não houve chamada à análise de crédito.

Em uma execução separada, os testes `6ac6cbe` contra o app Preview `45cf098` aprovaram **seis consultas SQL e duas compras à vista**, com um worker e retry zero. A segunda rodada substituiu somente os registros reservados; ficaram três pedidos de consulta e o último pedido próprio de compra. O [procedimento Kysely](docs/pratica-kysely-preview.md) detalha o escopo e a configuração TLS. Esses oito casos não foram executados contra o app `6369667` e não comprovam a integração externa de crédito.

## Estrutura Principal

```
src/
├── pages/           # Páginas da aplicação
├── components/      # Componentes React
│   ├── configurator/   # Configurador do carro
│   ├── landing/        # Landing page
│   └── ui/             # Componentes shadcn/ui
├── store/           # Estado global (Zustand)
├── hooks/           # Hooks customizados
└── integrations/    # Cliente Supabase
```

---

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Landing page |
| `/configure` | Configurador do veículo |
| `/order` | Checkout/Pedido |
| `/success` | Confirmação do pedido |
| `/lookup` | Consulta de pedidos |

---

## Modelo de Preços

- **Preço base:** R$ 40.000
- **Rodas Sport:** +R$ 2.000
- **Precision Park:** +R$ 5.500
- **Flux Capacitor:** +R$ 5.000
- **Financiamento no checkout atual:** 12 parcelas de `(max(0, preço - entrada) / 12) × 1,02`. O total é a entrada somada às 12 parcelas.

Há uma divergência conhecida: o [checkout](src/pages/Order.tsx) aplica o fator 1,02 uma única vez sobre o saldo, enquanto o helper `calculateInstallment` no [store](src/store/configuratorStore.ts) usa uma fórmula de prestação constante com taxa de 2% por período, em 12 períodos. Esse helper não é chamado pelo checkout. A regra financeira precisa ser reconciliada com os requisitos antes de apresentar uma fórmula como definitiva.

---

## Banco de Dados

**Tabela `orders`** — campos principais:
- `order_number` — Gerado pelo cliente como VLO- seguido de seis letras maiúsculas/números; o banco exige unicidade, mas não valida esse formato
- `color`, `wheel_type`, `optionals` — Configuração
- `customer_name`, `customer_email`, `customer_cpf` — Cliente
- `payment_method`, `total_price` — Pagamento
- `status` — O fluxo da aplicação grava `APROVADO`, `REPROVADO` ou `EM_ANALISE`. A coluna é `TEXT`, sem restrição desses valores, e a migração inicial ainda define o default histórico `pending`

Entrada e valor da parcela não são persistidos separadamente no modelo atual. No financiamento, `total_price` recebe a entrada somada às parcelas calculadas pelo checkout. A parcela aparece na confirmação imediata porque é acrescentada ao objeto em memória; uma nova consulta não a recupera do banco.

---

## Análise de Crédito

A análise é solicitada apenas no financiamento. A Edge Function obtém o score, e o checkout decide o status nesta ordem:

| Condição, em ordem de avaliação | Status |
|--------------------------------|--------|
| Entrada ≥ 50% e score < 700 | `APROVADO` |
| Score > 700 | `APROVADO` |
| Score entre 501 e 700, inclusive | `EM_ANALISE` |
| Demais casos | `REPROVADO` |

Score exatamente 700 fica `EM_ANALISE`, inclusive com entrada de pelo menos 50%. Em falha da consulta ou resposta sem score numérico, o fluxo mostra erro e não cria o pedido.

A [função de crédito](supabase/functions/credit-analysis/index.ts) aceita uma URL configurada e possui um fallback UAT. O Bearer gerado no código é um token aleatório de simulação; a integração externa ainda depende de contrato e autenticação válidos. Os testes com respostas simuladas e o preflight de corpo vazio não comprovam uma consulta real ao provedor.

A [confirmação](src/pages/Success.tsx) distingue os três resultados: aprovação, reprovação e crédito em análise. O estado `EM_ANALISE` usa relógio, apresentação neutra e mensagem de que o pedido aguarda análise; não é apresentado como reprovação. Os testes locais percorrem o checkout com scores simulados 800, 400 e 600, conferindo o status enviado e a mensagem resultante sem alterar as regras de decisão.

A [consulta](src/pages/OrderLookup.tsx) também distingue os três resultados e preserva seus códigos visíveis. `EM_ANALISE` mostra relógio e mensagem de espera. Valores históricos desconhecidos, como `pending`, mantêm o texto recebido e uma indicação neutra para consultar o atendimento, sem serem convertidos em aprovação ou reprovação. Quatro cenários locais verificam a leitura e a apresentação; eles não comprovam persistência no banco remoto.

---

## Fluxo Principal

```
Landing → Configurador → Checkout
                           ├─ À vista → Criar pedido → Confirmação
                           └─ Financiamento → Consultar score → Decidir status
                                                                └─ Criar pedido → Confirmação
```

---

## Scripts

```bash
yarn dev                         # Desenvolvimento (porta padrão 5173)
yarn typecheck                   # Conferir os projetos TypeScript
node --test scripts/ci-guards.test.mjs scripts/verify-deployment.test.mjs # Guards e verificador
yarn test:unit                   # Testes unitários com Vitest
yarn playwright install chromium # Instalar navegador no cache configurado no D
yarn test:e2e                    # E2E locais com rede simulada (porta 4173)
yarn build                       # Gerar dist com as variáveis do ambiente
yarn lint                        # Análise estática com ESLint
```

`yarn test:e2e:preview` usa o deploy remoto e somente o Supabase de preview; execute-o com os pré-requisitos descritos na documentação do desafio. A ausência do pedido em produção é conferida por auditoria externa, separada dos E2E. Os checks locais não substituem essas evidências remotas.

Os relatórios Playwright podem ser enviados ao projeto Velo no TestDino com `TESTDINO_TOKEN`, conforme o [guia de integração](docs/testdino.md). Pull requests executam sem esse segredo; os relatórios HTML permanecem disponíveis nos artefatos do GitHub Actions.
