# Controle de Atividades do Auxiliar de Enxoval — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Objetivo:** Adicionar ao menu Qualidade um módulo operacional simples para registrar atividades diárias, controlar tempo, consultar histórico, tratar pendências e acompanhar indicadores gerenciais.

**Arquitetura:** Um módulo isolado será carregado como uma aba dentro de `#q142`, usando o menu e o padrão visual existentes. Os registros serão mantidos inicialmente em armazenamento versionado do navegador, com vínculo opcional ao RFID e sem alteração de estoque; o formato ficará preparado para persistência posterior no Supabase.

**Tecnologia:** JavaScript nativo já utilizado no portal, renderização DOM, localStorage, rota existente de Qualidade e testes Node.

**Spec:** `../upload/Texto colado(1).txt` (Controle Operacional e Produtividade do Auxiliar de Enxoval).

## Restrições gerais

- Preserve existing quality, stock and RFID behavior.
- A productivity record must never create or alter an inventory movement.
- Do not calculate pieces/hour when effective time is missing or invalid.
- Keep the operator flow simple: launch, finalize, validate.
- Preserve audit fields and original values when editing.

## Pontos de verificação

- Uma atividade somente por quantidade deve ser salva sem inventar duração.
- Uma atividade cronometrada deve rejeitar duração negativa ou sobreposta e calcular o tempo efetivo.
- Duplo clique ou tentativa repetida não pode duplicar o lançamento.
- A referência RFID serve apenas para associação e não pode alterar estoque.
- Os filtros do histórico e do painel não podem misturar colaboradores ou datas.

### Tarefa 1: Modelo de atividade e aba operacional

**Files:**
- Create: `src/quality-activities-v1.js`
- Modify: `index.html` to load the module after `quality-management-v142.js`
- Test: `tests/quality-activities.test.mjs`

**Interfaces:**
- `window.GAOQualityActivities.mount(host)` renderiza o módulo.
- `window.GAOQualityActivities.calculateDuration(start, end, pauses)` retorna os minutos efetivos.
- `window.GAOQualityActivities.productivity(quantity, minutes)` retorna peças/hora ou `null`.

- [ ] Criar testes para duração, produtividade, proteção contra duplicidade e não alteração do estoque pelo RFID.
- [ ] Implementar registros versionados no localStorage, com auditoria e configuração dos tipos de atividade.
- [ ] Renderizar uma tela operacional objetiva: atividade, quantidade, horário/cronômetro, produto/cliente, origem/destino, RFID e observações.
- [ ] Adicionar iniciar, pausar, retomar e finalizar para atividades por tempo.
- [ ] Executar validação de sintaxe e testes.

### Tarefa 2: Histórico, atividades pendentes e fechamento diário

**Files:**
- Modify: `src/quality-activities-v1.js`
- Test: `tests/quality-activities.test.mjs`

**Interfaces:**
- `listRecords(filters)` retorna registros filtrados por data, colaborador, unidade, cliente, produto, atividade e situação.
- `closeDay(date, user)` envia o relatório diário do operador para supervisão.

- [ ] Adicionar abas de atividades em andamento, histórico e pendências.
- [ ] Adicionar correção com valor original, novo valor, usuário, data/hora e justificativa.
- [ ] Adicionar fechamento diário com quantidade por atividade, tempo, produtividade e pendências.
- [ ] Testar filtros, situação do fechamento e preservação da auditoria.

### Tarefa 3: Painel gerencial e configuração

**Files:**
- Modify: `src/quality-activities-v1.js`
- Test: `tests/quality-activities.test.mjs`

**Interfaces:**
- `buildMetrics(records)` retorna quantidade de atividades, volume por atividade, tempo produtivo, produtividade e pendências.

- [ ] Adicionar painel gerencial separado do formulário operacional.
- [ ] Adicionar filtros por período, colaborador, unidade, atividade, produto e cliente.
- [ ] Adicionar cards de atividades, peças por operação, tempo produtivo, peças/hora, pendências e divergências.
- [ ] Adicionar tabelas e barras de tendência somente com dados reais; mostrar “Não apurado” quando não houver dados.
- [ ] Adicionar configuração administrativa de atividades: ativa/inativa, quantidade/tempo e exigências de RFID, produto, origem e destino.
- [ ] Executar todos os testes e gerar o ZIP do portal.

