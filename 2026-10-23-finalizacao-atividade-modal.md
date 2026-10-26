# Finalização de atividade com modal integrado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o `prompt` nativo da finalização de atividades por um modal integrado ao padrão GAO.

**Architecture:** O módulo existente `quality-activities-v2.js` continuará responsável pelo fluxo, estado local e sincronização Supabase. O modal será criado e destruído dentro do host do módulo, sem alterar banco, rotas ou outros módulos.

**Tech Stack:** JavaScript, HTML/CSS gerados pelo módulo, localStorage e REST do Supabase.

**Spec:** `docs/superpowers/specs/2026-10-23-finalizacao-atividade-modal-design.md`

## Global Constraints

- Não usar `window.prompt`, `window.alert` ou confirmação nativa para finalizar a atividade.
- Manter o cálculo de duração e o status `CONCLUIDA`.
- Manter a sincronização central e informar falha sem apagar o lançamento local.
- Não alterar programação, permissões, banco ou módulos externos.

## Review Focus

- Quantidade vazia, negativa ou não numérica deve impedir a finalização.
- Cancelamento deve manter a atividade como `EM_ANDAMENTO`.
- Dificuldade e observação devem ser opcionais e persistidas.
- Falha do Supabase deve preservar os dados locais e mostrar mensagem clara.
- Reabertura do modal deve limpar o formulário anterior e não duplicar elementos.

### Task 1: Modal de finalização e persistência

**Files:**
- Modify: `src/quality-activities-v2.js` — função `finish`, estilos do módulo e binding de eventos.
- Test: verificação sintática com `node --check` e inspeção manual do fluxo publicado.

**Interfaces:**
- Consumes: `executions()`, `calculateDuration()`, `remoteSave()`, `render()`.
- Produces: `openFinishModal(id)`, `closeFinishModal()`, `saveFinishModal()` e status `CONCLUIDA` persistido.

- [ ] **Step 1: Criar o markup do modal** com quantidade obrigatória, dificuldade, observação, cancelar e salvar/finalizar.
- [ ] **Step 2: Criar os estilos** seguindo os cartões, cores e botões do padrão GAO.
- [ ] **Step 3: Substituir `prompt` por `openFinishModal(id)`** e impedir a finalização sem quantidade válida.
- [ ] **Step 4: Implementar `saveFinishModal()`** calculando duração, gravando quantidade/observações/status e aguardando `remoteSave(EXE_KEY, list)`.
- [ ] **Step 5: Tratar falha de sincronização** mantendo o lançamento local e exibindo mensagem dentro do modal.
- [ ] **Step 6: Verificar** com `node --check src/quality-activities-v2.js` e teste manual de abrir, cancelar, salvar e concluir.

### Task 2: Empacotamento da versão

**Files:**
- Create: ZIP sequencial da versão publicada.

- [ ] **Step 1: Gerar o ZIP** com a raiz do projeto, sem `node_modules`.
- [ ] **Step 2: Testar o ZIP** com `unzip -t`.
- [ ] **Step 3: Entregar o ZIP** com instrução de publicação no Cloudflare.
