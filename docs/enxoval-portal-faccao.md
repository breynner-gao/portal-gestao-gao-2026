# Portal da facção

A GAO vincula um item de OS a uma conta ativa em **Enxoval e Tecidos → Portal da facção**. Para operar, a facção entra com a própria conta em `/faccao.html`. A consulta retorna somente itens atribuídos e os registros enviados pela própria conta. As rotinas da facção não retornam preços, valores de compra nem custos unitários.

A facção registra recebimentos em metros, lotes com peças boas e refugos, inventário físico e solicitações de ajuste. O lote deve reconciliar metros destinados, incorporados, reaproveitáveis, perdidos e em processo. A perda medida exige justificativa. A fila GAO registra o parecer e o responsável pela conferência. O parecer não equivale a lançamento de estoque, recebimento operacional da produção ou autorização de pagamento.

Implante a migração `20261112193000_fabric_faction_portal.sql` antes dos arquivos web. A operação exige uma conta ativa da facção e uma OS com item atribuído pela GAO.

O portal da facção ainda precisa ser ligado à contabilização de estoques por local, à aceitação formal e ao fechamento de lote, às reservas, às devoluções, à provisão e ao financeiro. Atribuições ficam por conta e item de OS. O cadastro e o uso de um grupo de contas por empresa de facção ficam pendentes.
