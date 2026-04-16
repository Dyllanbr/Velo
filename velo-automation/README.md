# Automacao Web - Velo Sprint (Python + Selenium)

Projeto de automacao de testes web para o site **Velo Sprint** — um configurador de veiculo eletrico.

## Padrao de Projeto: Page Object Model (POM)

### O que e o POM?
O Page Object Model e um padrao de design para automacao de testes que cria uma camada de abstracao entre os testes e a interface do usuario. Cada pagina (ou componente significativo) do site e representada por uma classe Python.

### Como funciona?
- **Cada pagina = uma classe**: `LandingPage`, `ConfiguratorPage`, `OrderPage`, `SuccessPage`, `LookupPage`
- **Todas herdam de `BasePage`**: que contem metodos genericos (find, click, type, wait)
- **Seletores ficam nas Page Objects**: os testes nao conhecem detalhes de HTML/CSS
- **Testes usam metodos de alto nivel**: ex: `configurator.select_color("midnight-black")` em vez de `driver.find_element(...).click()`

### Beneficios
- **Manutenibilidade**: se um seletor muda, altera-se apenas a Page Object
- **Legibilidade**: testes leem como documentacao do fluxo
- **Reusabilidade**: metodos das pages sao reutilizados em multiplos testes

### Estrutura

```
velo-automation/
├── pages/
│   ├── __init__.py
│   ├── base_page.py          # Classe base com metodos genericos
│   ├── landing_page.py       # Landing page (/)
│   ├── configurator_page.py  # Configurador (/configure)
│   ├── order_page.py         # Checkout (/order)
│   ├── success_page.py       # Confirmacao (/success)
│   └── lookup_page.py        # Consulta de pedidos (/lookup)
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # Fixtures do pytest (driver Chrome)
│   ├── test_landing.py        # Testes da landing page
│   ├── test_configurator.py   # Testes do configurador
│   ├── test_checkout_flow.py  # Testes E2E do fluxo de compra
│   └── test_order_lookup.py   # Testes de consulta de pedido
├── utils/
│   ├── __init__.py
│   └── logger.py              # Configuracao de logging
├── logs/                      # Logs gerados (gitignored)
├── reports/                   # Relatorios HTML (gitignored)
├── requirements.txt           # Dependencias Python
├── pytest.ini                 # Configuracao do pytest
├── .gitignore                 # Arquivos ignorados
└── README.md                  # Este arquivo
```

## Pre-requisitos

- Python 3.10+
- Google Chrome instalado
- O site Velo Sprint rodando em `http://localhost:5173`

## Instalacao

1. Clone o repositorio:
   ```bash
   git clone https://github.com/Dyllanbr/Velo.git
   cd Velo
   ```

2. Entre no diretorio de automacao:
   ```bash
   cd velo-automation
   ```

3. Crie um ambiente virtual:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

4. Instale as dependencias:
   ```bash
   pip install -r requirements.txt
   ```

## Como rodar o site Velo (pre-requisito)

Na raiz do projeto Velo:
```bash
yarn install
yarn run dev
```
O site estara disponivel em `http://localhost:5173`

## Como executar os testes

```bash
# Rodar todos os testes
pytest

# Rodar um arquivo especifico
pytest tests/test_landing.py

# Rodar com mais detalhes
pytest -v -s

# Gerar relatorio HTML
pytest --html=reports/report.html
```

## Como verificar os logs

Os logs sao gerados automaticamente em `logs/automation.log` durante a execucao.

```bash
# Ver logs em tempo real
tail -f logs/automation.log

# Ver logs completos
cat logs/automation.log
```

Os logs incluem:
- Navegacao entre paginas
- Cliques e preenchimento de campos
- Verificacoes (assertions)
- Erros e excecoes

## Relatorio HTML

Apos a execucao, um relatorio visual e gerado em `reports/report.html`. Abra no navegador para ver o resultado detalhado de cada teste.

## Cenarios automatizados

| Teste | Descricao |
|-------|-----------|
| `test_landing_page_loads` | Verifica se a landing page carrega corretamente |
| `test_navigate_to_configurator` | Navega da landing para o configurador |
| `test_navigate_to_lookup` | Navega para consulta de pedidos |
| `test_default_configuration` | Verifica preco base do veiculo (R$ 40.000) |
| `test_select_sport_wheels` | Seleciona rodas Sport e valida preco (R$ 42.000) |
| `test_select_color` | Seleciona Midnight Black e valida selecao |
| `test_add_optionals` | Adiciona opcionais e valida preco total (R$ 52.500) |
| `test_navigate_to_checkout` | Configura e navega para checkout |
| `test_complete_purchase_flow_avista` | Fluxo completo: configurar -> checkout -> confirmacao |
| `test_checkout_form_fill_without_submit` | Preenche formulario sem submeter (sem Supabase) |
| `test_checkout_form_validation` | Valida mensagens de erro do formulario |
| `test_lookup_page_loads` | Verifica se a pagina de consulta carrega |
| `test_search_nonexistent_order` | Busca pedido inexistente |
| `test_search_empty_disabled` | Verifica botao desabilitado com campo vazio |

## Observacoes

- O site precisa estar rodando localmente antes de executar os testes
- Se o Supabase nao estiver configurado, testes que envolvem submit de pedido podem falhar (a validacao do formulario ainda funciona)
- Os testes rodam com o Chrome visivel por padrao. Para rodar headless, descomente a linha `options.add_argument("--headless")` em `conftest.py`
- O seletor principal utilizado e `[data-testid="xxx"]` — todos os elementos interativos do Velo ja possuem `data-testid`
- Para o select de loja (shadcn/ui Select), a estrategia utilizada e: clicar no trigger, aguardar o popover, e clicar na option por texto visivel
