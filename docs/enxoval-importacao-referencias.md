# Importação de referências de tecidos e enxoval

A aba **Importação**, em **Enxoval e Tecidos**, lê o arquivo XLSX no navegador. A prévia valida as abas Tecidos, Peças, Histórico pedidos e Referências custos. Cada registro guarda a aba, a linha física na planilha, seu identificador e as colunas de origem. A comparação é feita por aba e identificador com a última versão da organização. Uma planilha com conteúdo idêntico reutiliza a versão registrada.

Para registrar ou consultar uma versão é necessária a permissão existente `textiles.inventory.manage` na organização GAO. As rotinas de banco validam esse vínculo a cada chamada. Os registros ficam em uma tabela privada para os perfis da aplicação e são acessados pelas funções de importação e consulta.

A planilha de referência tem 14 variantes de tecido, 118 fichas, 232 pedidos históricos e 8 linhas de custo. A linha de custo de origem 24 tem descrição inválida. O percal de 2,50 m e o de 2,85 m aparecem como variantes distintas, e percal sem largura fica pendente. Estoques, demandas, pedidos, preços vigentes e produção são tratados pelas telas operacionais do portal.

## Implantação

1. Aplique a migração `20261112182000_fabric_workbook_reference_import.sql` no banco do portal, que deve ter as tabelas de organização e a função `fabric_user_has_permission`.
2. Publique os arquivos web no mesmo ambiente do Portal SGQ.
3. Entre com uma conta GAO que tenha a permissão de administrar tecidos. Abra **Enxoval e Tecidos → Importação**, selecione a planilha e gere a prévia.
4. Confira pendências e conflitos. Clique em **Registrar referências** e consulte a versão em **Consultar importações**.

A importação em conferência não cria estoques, compras, pagamentos nem ordens. A homologação dos vínculos com cadastro ativo e o acesso segregado da facção requerem etapas adicionais.
