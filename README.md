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

O desafio exige Supabase separados para **preview** e **produção**. O banco de produção já existe; o projeto de preview ainda precisa ser provisionado. Use um ambiente de desenvolvimento/preview para os experimentos com banco real. Os testes E2E locais usam rede simulada.

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

## Estado do desafio

O [PR #2](https://github.com/Dyllanbr/Velo/pull/2) está em draft. A implementação do commit `74c98be` passou no check de qualidade da [execução 35299625566](https://github.com/Dyllanbr/Velo/actions/runs/35299625566); o preview parou no guard de configuração, antes do deploy e do E2E real. Isso ainda não comprova isolamento remoto nem publicação em produção.

O projeto Vercel foi criado e recebeu as variáveis de produção. Restam o Supabase de preview, o token de CI e a configuração remota completa. Os detalhes e evidências estão em [docs/desafio-preview.md](docs/desafio-preview.md).

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
- **Financiamento:** 12x com juros de 2% a.m.

---

## Banco de Dados

**Tabela `orders`** — campos principais:
- `order_number` — Formato: VLO-XXXXXX
- `color`, `wheel_type`, `optionals` — Configuração
- `customer_name`, `customer_email`, `customer_cpf` — Cliente
- `payment_method`, `total_price` — Pagamento
- `status` — pending, approved, rejected, analysis

---

## Análise de Crédito

| Score | Resultado |
|-------|-----------|
| > 700 | Aprovado |
| 501-700 | Em análise |
| ≤ 500 | Reprovado |

*Se entrada ≥ 50% do total, aprova mesmo com score < 700*

---

## Fluxo Principal

```
Landing → Configurador → Checkout → Análise de Crédito → Confirmação
```

---

## Scripts

```bash
yarn dev                         # Desenvolvimento (porta padrão 5173)
yarn typecheck                   # Conferir os projetos TypeScript
node --test scripts/ci-guards.test.mjs # Testar os guards da pipeline
yarn test:unit                   # Testes unitários com Vitest
yarn playwright install chromium # Instalar navegador no cache configurado no D
yarn test:e2e                    # E2E locais com rede simulada (porta 4173)
yarn build                       # Gerar dist com as variáveis do ambiente
yarn lint                        # Análise estática com ESLint
```

`yarn test:e2e:preview` usa o deploy remoto e os dois Supabase; execute-o somente com os pré-requisitos descritos na documentação do desafio. Os checks locais não substituem essa evidência remota.
