# Indicadores da Gerência de Qualidade Separados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar o módulo de indicadores da Gerência de Qualidade em lançamentos, análises complementares e painel executivo, removendo produção do escopo.

**Architecture:** Preservar os módulos operacionais existentes e substituir apenas a composição do módulo de indicadores. `src/indicators-performance-v176.mjs` ficará responsável pela navegação e painel executivo; os lançamentos continuarão nas telas de qualidade/relave/enxoval existentes; novos blocos de análise serão componentes isolados, sem painel aninhado.

**Tech Stack:** HTML, CSS existente do Portal GAO, JavaScript ES modules, Supabase já utilizado pelo Portal, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-26-indicadores-qualidade-separados-design.md`

## Global Constraints

- Produção industrial e produção da costura ficam fora do módulo da Gerência de Qualidade.
- Não calcular indicador com fonte não validada; exibir `Não apurado`.
- Não criar metas, pesos ou faixas de farol arbitrários.
- SLA de complemento atende à necessidade real e não deve ser negativado.
- Preservar histórico, evidências, responsável e data das alterações.
- Não misturar telas de análise detalhada dentro do painel executivo.

## Review Focus

- Rota `/indicadores-performance` abre diretamente o painel correto e não uma tela antiga sobreposta.
- Dados sem fonte ou sem validação aparecem como `Não apurado`, nunca como zero.
- Entrega marcada como complemento não reduz o SLA quando a necessidade real foi atendida.
- Produção não aparece em cards, fórmulas ou fontes do painel da Qualidade.
- Filtros de período, cliente e unidade não misturam resultados entre módulos.

### Task 1: Definir o contrato do painel executivo

**Files:**
- Modify: `src/indicators-performance-v176.mjs`
- Test: `tests/indicators-quality-panel.test.mjs`

**Interfaces:**
- Produces: `QUALITY_INDICATORS` com seis cartões: não conformidades, SLA, acuracidade do enxoval, relave/perdas, auditorias/planos e rotinas da Qualidade.

- [ ] Escrever testes para os seis cartões, ausência de produção, estado `Não apurado` e referência do período.
- [ ] Executar os testes e confirmar falha inicial.
- [ ] Refatorar o catálogo e a renderização do painel sem alterar as rotas operacionais.
- [ ] Executar os testes e confirmar aprovação.

### Task 2: Separar as telas de análise complementar

**Files:**
- Create: `src/quality-indicator-analysis-v1.mjs`
- Modify: `index.html`
- Test: `tests/quality-indicator-analysis.test.mjs`

**Interfaces:**
- Produces: telas independentes para relave/perdas, SLA/ocorrências, enxoval, auditorias/planos, rouparias externas, químicos/dosadores e resíduos.

- [ ] Escrever testes para a navegação independente e ausência de painel aninhado.
- [ ] Implementar a navegação e os blocos de análise com links `Ver detalhes`.
- [ ] Garantir que químicos, resíduos e enxoval permaneçam em detalhamento, sem virar cards do painel principal.
- [ ] Executar os testes.

### Task 3: Aplicar regras de validação e SLA

**Files:**
- Modify: `src/laundry-sla-regularization-v64.js`
- Modify: `src/laundry-dashboard-v97.js`
- Test: `tests/quality-indicator-rules.test.mjs`

- [ ] Escrever testes para complemento, entrega parcial justificada, entrega maior e ausência de dados.
- [ ] Implementar as regras sem bloquear a operação de entrega.
- [ ] Exibir a memória de cálculo e o status de validação.
- [ ] Executar os testes.

### Task 4: Integração visual e remoção de legado

**Files:**
- Modify: `index.html`
- Modify: `src/v614.css`
- Test: `tests/dashboard-layout.test.mjs`

- [ ] Escrever teste para uma única tela do painel, sem camadas antigas sobrepostas.
- [ ] Remover apenas scripts legados do painel de indicadores, preservando os módulos operacionais.
- [ ] Padronizar títulos, filtros, cards e botão `Ver detalhes`.
- [ ] Executar a suíte completa e verificar as rotas existentes.

### Task 5: Homologação

- [ ] Validar cards com dados reais e com ausência de dados.
- [ ] Validar filtros por período, cliente e unidade.
- [ ] Validar que produção não aparece no módulo.
- [ ] Validar SLA com complemento.
- [ ] Registrar a versão e preparar publicação somente após os testes passarem.
