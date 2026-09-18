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

O [PR #2](https://github.com/Dyllanbr/Velo/pull/2) foi integrado à `main` no SHA `98eb6bb6fa4d65f1d22e33229e72c4792561d9b5`. A [execução 35367456549, tentativa 1](https://github.com/Dyllanbr/Velo/actions/runs/35367456549) aprovou os três jobs: qualidade, preview com isolamento e produção com promote. Passaram **94 unitários, 23 testes Node, 19 E2E locais e um E2E remoto**, além de tipos e build; lint teve zero erros e sete avisos de Fast Refresh.

O E2E criou um pedido no Supabase de preview, confirmou sua leitura e sua ausência em produção; uma consulta privilegiada complementar confirmou essa ausência pelos mesmos identificadores. A pipeline reconstruiu o mesmo SHA com as variáveis de produção, verificou o deployment e o promoveu. Esta fotografia cobre essas evidências e não inclui uma operação de escrita/consulta da aplicação no domínio final de produção. Consulte o [PR #2 para o resultado final do aceite e seus recibos](https://github.com/Dyllanbr/Velo/pull/2) e [o procedimento do desafio](docs/desafio-preview.md).

---

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

`yarn test:e2e:preview` usa o deploy remoto e os dois Supabase; execute-o somente com os pré-requisitos descritos na documentação do desafio. Os checks locais não substituem essa evidência remota.
