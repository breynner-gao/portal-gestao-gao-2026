# Comprar enxoval — desenho aprovado

Aprovação: usuário aprovou o croqui interativo de Comprar enxoval e pediu implementar. Objetivo: decidir compra de peças e tecido no mesmo lugar, sem percorrer estoque, pedidos e conciliação. Preservar mapa de trocas e movimentações.

Escolha aprovada: quadro central por peça, detalhes expansíveis com necessidade, estoque considerado, programação/facção, peças compradas e saldo a cobrir. Pedidos, recebimentos, fornecedores, fichas, corte, retornos e qualidade acessíveis na própria tela/modal. Menu raso: Comprar enxoval, Mapa, Movimentações, Cadastros e Importações.

Implementação: reutilizar integrações e operações existentes. Extrair modelo puro para cálculos e apresentação para não ampliar o arquivo legado. Quantidades desconhecidas permanecem não apuradas, nunca zero. Estoque do RFID já é descontado em compraSugerida; não descontar novamente. Saldos de tecido são compartilhados entre todas as peças e OS. Preservar origem/custo por lote nos registros internos, sem expor escolha de lote no planejamento.

Compras de peças prontas precisam de registro persistente próprio (não existem hoje). Recebimentos alimentam saldo complementar identificado; confirmação de incorporação ao RFID impede dupla contagem. Se a base RFID mudar após um recebimento não confirmado, o item fica pendente de conferência na própria tela em vez de apresentar um saldo confiável inventado. Não inferir consumo físico apenas do status de corte.

Não apagar cadastros, históricos ou telas antigas: ficam acessíveis em detalhes/modais da central. Não criar compras automaticamente; usuário confirma quantidades, fornecedor e custo.
