# Administração: usuários e papéis

Implementar a matriz aprovada: papéis em colunas, módulos e recursos expansíveis em linhas, ações reais do catálogo em interruptores. Novos papéis começam sem permissões. Cadastro seleciona papel e escopo de unidades/clientes. Apenas o administrador atual permanece cadastrado.

Permissões do papel são materializadas em member_permissions para manter as verificações existentes no banco e nas funções. Alterações propagam atomicamente a todos os vinculados. Matriz usa revisão para impedir sobrescrita concorrente. Administrador Geral é protegido; nenhuma conta privada é codificada no repositório.

Não apresentar interruptores fictícios: recursos legados cujo backend agrupa alterações devem indicar “Administrar (criar, editar e excluir)”. A decomposição futura exige migrar também as operações correspondentes.

Executar: migração com RLS e RPC autorizada; integração admin-users; interface responsiva de usuários/matriz; testes isolados de autorização/propagação/revisão/proteção; publicação e verificação do endereço de produção. Não executar testes de escrita com contas reais.

## Validação executada
- `node --test tests/*.test.mjs` (97 testes).
- `PGLITE_MODULE=<pglite/dist/index.js> node tests/access-roles-db-check.mjs`: banco inteiramente sintético, propagação/revogação, organização, administrador protegido, revisão concorrente e RLS de criar versus atualizar/excluir.
- `LINKEDOM_MODULE=<linkedom/esm/index.js> node tests/access-roles-dom-check.mjs`: montagem da administração, interruptores protegidos, edição e envio do papel.
- Compilação TypeScript da função admin-users com esbuild, imports npm externos.

Os papéis Gestor, Cliente, Coletador, Entregador e Somente leitura são modelos sem acessos iniciais, prontos para a configuração do administrador. As 41 permissões do catálogo existente são exibidas sem prometer separação de operações que continuam agrupadas pelo backend legado. Barreiras restritivas complementam as políticas permissivas antigas em Químicos e Rouparia. Não houve criação de usuários de teste em produção.
