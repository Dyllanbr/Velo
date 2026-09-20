# Executar casos funcionais pelo navegador

Este roteiro orienta uma sessão de execução a partir de [casos documentados](../tests/test-cases.md). Ele não substitui a suíte de regressão e não presume que um servidor MCP esteja configurado. Antes de começar, identificar a ferramenta disponível e a origem local isolada. Usar um estado inicial conferido, sem conectar a aplicação a produção.

## Pedido de execução

> Na origem local autorizada, execute somente CT01 e CT02 do documento anexado. Leia os passos e resultados esperados antes de agir. Faça uma ação por vez, obtenha uma observação nova e registre esperado, observado e resultado. Interrompa o caso se o alvo, estado inicial ou comportamento divergir; preserve a evidência em vez de ajustar a expectativa.
>
> No CT01, confira a apresentação, as seções de especificações e FAQ, a abertura e o fechamento da resposta de autonomia e as duas chamadas que levam ao configurador. No CT02, confirme azul/Aero/sem opcionais/R$ 40.000,00 antes de começar. Selecione preto, branco, Sport e Aero, verificando a imagem do veículo e a sequência de preços 40.000 → 40.000 → 40.000 → 42.000 → 40.000.
>
> Capture uma imagem real por estado relevante usando a API disponível. Confira a atualização da imagem antes de capturar. Preserve o formato original e registre nome, horário, URL, tamanho e SHA-256. Só liste um arquivo como anexado depois de salvá-lo e conferir seu conteúdo. Se a ferramenta apenas exibir a imagem, registre essa limitação; não invente um caminho de arquivo.
>
> Ao terminar, informe quais etapas passaram, falharam ou ficaram pendentes e quais evidências sustentam cada conclusão. Diferencie observação visual, estado do DOM e mensagens do console. Não crie pedidos, não execute crédito, não altere código ou regras financeiras e não avance para outros casos.

## Como registrar o resultado

Uma conclusão útil identifica data, versão do código, ambiente, ferramenta efetivamente usada, estado inicial e resultados por etapa. Um resumo de aprovação não basta sem observações correspondentes. Se a API devolver JPEG, conservar JPEG; solicitar PNG não muda o formato recebido.

Ao usar Playwright MCP de fato, registrar a conexão e as ferramentas chamadas. Ao usar outra interface de controle do navegador, identificá-la pelo nome correto. Não atribuir a execução a um editor, serviço ou pessoa que não participou. As divergências financeiras listadas nos casos permanecem fora do aceite de CT01 e CT02.
