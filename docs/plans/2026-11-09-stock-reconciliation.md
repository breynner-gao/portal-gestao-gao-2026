# Conciliação e compras na mesma tela

Implementar a solicitação aprovada: botão Conciliar nas linhas importadas e janela com alocações por lote/NF, metros reservados, consumidos e sobras. Não converter histórico em novas OS, para não duplicar cobertura de peças. Gravar uma conciliação auditada e os deltas de estoque atomicamente; reenvio idempotente e correção por diferença. Bloquear incompatibilidade de tecido, estoque negativo e atualização concorrente. Reabrir conciliação quando quantidade, entrega, corte ou peça mudar.

Compra: lista compacta de ordens; produtos em detalhes expansíveis, recebimentos/NFs dentro de cada produto, acompanhamento dentro da OC. Manter identificadores históricos e referências originais. Formulário de recebimento em janela, sem sequência de prompts ou troca de página.

Verificação: testes de cálculo de conciliação, reconciliação idempotente e saldos no banco em transação revertida; testes da apresentação e formulários; suíte existente; implantação e verificação do arquivo publicado.
