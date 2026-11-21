# Painel mensal de gastos e provisões de enxoval

Disponível em Enxoval e Tecidos > Custos. Acesso direto: `/enxoval-tecidos?tela=custos`; mês opcional `&mes=2026-11`.

O painel usa as fontes reais já carregadas e autorizadas do módulo, sem novos privilégios nem tabelas:

- Tecidos realizados: lote recebido com NF ou vínculo de recebimento de OC, quantidade × custo efetivo, com frete/encargos já incorporados. Recebimento da OC identifica o lote e não gera outro lançamento financeiro. Saldo de abertura sem NF não é considerado compra.
- Facção/aviamentos realizados: valores efetivamente informados nos retornos, na data local de São Paulo. Não presume pagamento nem custo a partir de uma OS aberta.
- Produtos prontos: preço gravado no recebimento × peças aceitas, por data de recebimento; cobertura de estoque/RFID não altera esse histórico.
- Provisões de tecidos/produtos prontos: saldo não recebido × preço do pedido. O contador de recebidos é conferido com os registros detalhados. Cotações e saldos de pedidos cancelados/encerrados não entram, mas recebimentos históricos permanecem.
- Provisão de facção/insumos: peças pendentes × custo da OS. Lotes são distribuídos pelas suas previsões, respeitando o prazo editado no grupo, entregas parciais, rejeições e retornos antigos sem lote. Saldo sem corte ou sem prazo fica em “Sem previsão”. Não soma tecido consumido como nova compra.

Mostra doze meses em tabela (cinco anteriores, selecionado e seis seguintes), detalhamento por categoria/documento e provisão dos seis meses seguintes. O gráfico inicia no primeiro mês com lançamentos do recorte. Datas vencidas continuam em sua competência original e são destacadas; não são transferidas silenciosamente para o futuro.

O orçamento mensal de compras e o custo real por peça permanecem nas suas seções, com as respectivas bases de cálculo. O total previsto do painel é realizado + provisão da competência, sem reinterpretar a coluna de orçamento de compras como pagamento.

Exportações: CSV compatível com Excel, relatório em PDF/ impressão e compartilhamento pelo WhatsApp usando o exportador existente. Textos são escapados e o CSV protege células de texto contra fórmulas.

Validação: testes de cálculo para recebimento parcial, preço efetivo, cancelamento/cotação, recebimento após cancelamento, datas por lote, retorno legado, insumos, saldo inicial, fuso e virada do ano; conciliação dos totais mensais; seleção de categoria/mês e regressões do portal. Validação com consultas agregadas no banco, sem extrair histórico integral de notas/pedidos.
