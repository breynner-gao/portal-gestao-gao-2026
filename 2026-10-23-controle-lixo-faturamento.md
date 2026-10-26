# Plano: controle de lixo, faturamento e rastreabilidade ambiental

## Arquivos

- `src/chemicals-relave-v123.js`: abas, formulários, cálculos, histórico e painel de lixo.
- `src/chemicals-supabase-persistence-v106.js`: persistência remota da nova chave de lixo.
- `src/branding-quality-v615.js`: semântica correta do período do custo e card de lixo com fonte/competência.
- `index.html`: versionamento dos scripts e build.
- `tests/waste-control.test.mjs`: regras de cálculo, separação e status ambiental.

## Tarefas

1. Criar testes falhando para cálculo por empresa, consolidação apenas de lançamentos validados, diferença de faturamento e estado ambiental independente do relave.
2. Adicionar a chave remota do lixo ao sincronizador Supabase, sem alterar a chave do relave.
3. Adicionar as abas “Painel de lixo”, “Novo lixo” e “Histórico de lixo” no mesmo módulo, com seleção da empresa e campos de faturamento/ambientais.
4. Adicionar edição e exclusão do histórico de lixo com confirmação de sincronização.
5. Corrigir o cartão químico para exibir explicitamente base recebida, último custo válido e atraso, sem chamar período antigo de atual.
6. Atualizar os números de versão, executar testes e checagem de sintaxe, e empacotar um ZIP novo.
