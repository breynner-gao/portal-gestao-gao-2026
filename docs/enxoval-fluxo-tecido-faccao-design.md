# Fluxo completo de tecidos, peças e facção

## Objetivo
Concluir o processo da Rouparia/Enxoval: usar a necessidade atual de peças, calcular o tecido necessário por ficha técnica, evitar pedidos/ordens duplicados, controlar estoque e remessas à facção, registrar retorno real e apurar custo previsto, custo realizado e perda de tecido.

## Situação encontrada
- `linen-risk-panel-v150.js` calcula necessidade de peças e já exibe quantidade em facção e pedido real.
- `fabric-purchase-addon-v1.js` já tem cadastro de tecido e fornecedor, entrada por lote, compra sugerida, liberação parcial, facção e corte/rendimento.
- O complemento salva em `localStorage`; os dados não são compartilhados nem persistidos no Supabase.
- O complemento ainda não recebe automaticamente a lista de peças pendentes do painel e não fecha retorno da facção com quantidade aceita, custo efetivo por peça e perda valorizada.
- O Supabase conectado não tem tabelas para tecidos, lotes, ordens de produção ou movimentos desses estoques.

## Abordagem
Aproveitar as telas e o estilo atuais de Enxoval e Tecidos, mantendo o painel existente de necessidade de peças. Adicionar persistência no Supabase e ligar o painel ao cadastro de ficha técnica e às ordens de facção. O modelo de dados será normalizado e os movimentos de estoque serão registrados como eventos auditáveis; operações que reservam/liberam tecido e criam ordens devem ocorrer de modo transacional no banco para impedir duplicidade e concorrência.

## Fluxo
1. A necessidade atual de peças alimenta uma fila de produção, com referência e data da base.
2. A ficha técnica associa peça a tecido(s), consumo padrão em metros por peça, custo de facção/costura por unidade e aviamentos/custos adicionais opcionais.
3. O planejamento calcula tecido previsto, saldo físico utilizável, saldo já reservado e pedidos confirmados/em aberto. Só sugere comprar o saldo ainda descoberto.
4. Ao criar a ordem de produção, o banco verifica o saldo de demanda já coberto por ordens abertas e cria apenas a quantidade faltante.
5. O envio parcial ou total à facção reserva e baixa tecido do lote, mantendo origem, quantidade, custo e data.
6. O retorno registra peças produzidas, aceitas, rejeitadas, metros realmente consumidos, sobras devolvidas, valor de facção e observações.
7. O fechamento calcula custo previsto e real por peça (tecido + facção/costura + aviamentos informados), metros excedentes/perdidos e custo da perda pelo custo efetivo do lote.
8. A ordem encerrada sai da cobertura de pedidos abertos; correções são feitas por ajuste/movimento auditável, sem apagar histórico.

## Regras de cálculo
- Tecido previsto = peças planejadas × consumo padrão por peça.
- Compra sugerida = máximo(0, necessidade total não atendida − estoque físico livre − compras confirmadas ainda não recebidas), sem contar duas vezes tecido reservado a ordens.
- Demanda ainda descoberta = necessidade atual − peças cobertas por ordens não canceladas; nunca criar uma nova ordem para quantidade já coberta.
- Perda técnica em metros = máximo(0, metros consumidos − consumo padrão das peças aceitas), exibindo também o saldo/sobra devolvido separadamente.
- Custo real do tecido = valor efetivo por metro do lote × metros consumidos. Custo real por peça aceita = (tecido consumido + facção/costura + aviamentos/outros custos efetivamente lançados) ÷ peças aceitas.
- Valores estimados permanecem salvos na ordem como fotografia do planejamento; alterações futuras na ficha técnica ou nos preços não mudam ordens já abertas/fechadas.

## Segurança e compatibilidade
- Usar o projeto Supabase existente `fquzuxdqvhecijjuxbmg`, o login do Portal e a organização GAO já cadastrada.
- Tabelas expostas no schema `public` terão RLS. Só membros ativos da organização GAO poderão ler e operar custos/estoque.
- Nenhuma senha, chave secreta ou service-role key será colocada no navegador ou no GitHub.
- Dados locais legados serão oferecidos para migração/importação após a primeira leitura do banco; não serão enviados automaticamente nem sobrescreverão registros existentes.
- A tela atual de necessidade de peças e seus filtros/exportações serão preservados.

## Limite da primeira entrega
A primeira entrega cobre cadastro/ficha técnica, saldo e movimentos de tecido, ordens vinculadas à necessidade de peças, remessas/retornos à facção, prevenção de duplicidade e custos/perdas previstos e realizados. Integração automática com compras/financeiro corporativo, XML/NF-e como entrada contábil e controle de aviamentos por estoque próprio ficam fora desta etapa; os respectivos custos podem ser informados na ordem.
