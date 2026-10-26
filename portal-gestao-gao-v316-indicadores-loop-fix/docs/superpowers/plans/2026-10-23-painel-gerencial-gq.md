# Painel Gerencial GQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o resumo inicial genérico pelo painel gerencial fiel ao croqui aprovado.

**Architecture:** Manter o portal e os módulos existentes. Alterar apenas a composição do painel inicial em `src/branding-quality-v615.js`, preservando a leitura das fontes persistidas já existentes e sem criar uma segunda tela.

**Tech Stack:** HTML/CSS/JavaScript estático, Supabase REST e bases oficiais publicadas.

**Spec:** Croqui aprovado em 23/10/2026, com os blocos Químico, Relave, Lixo, Rouparia Entrega, Rouparia Coleta, Enxoval e Produção de enxoval.

## Global Constraints

- Não usar `localStorage` como fonte do painel gerencial.
- Não criar indicador Blue.
- Não renomear Relave para outro indicador.
- Não misturar Produção de enxoval com Movimentação de enxoval.
- Preservar os demais módulos do portal.

## Review Focus

- Todos os sete blocos aparecem com o nome correto.
- Relave e Lixo são cartões independentes.
- Rouparia Entrega e Rouparia Coleta possuem os três campos definidos no croqui.
- Enxoval mostra envio para mercado e envio para depósito.
- Produção de enxoval mostra SLA por hora.

### Task 1: Painel inicial fiel ao croqui

**Files:**
- Modify: `src/branding-quality-v615.js`
- Test: `tests/dashboard-layout.test.mjs`

**Interfaces:**
- Consumes: fontes oficiais já disponíveis no portal.
- Produces: seção `.gao-summary-home` com os sete blocos e seus subindicadores.

- [ ] Testar a presença dos rótulos aprovados e ausência dos rótulos proibidos.
- [ ] Alterar o HTML do painel inicial.
- [ ] Ajustar CSS para sete blocos em linha responsiva.
- [ ] Validar sintaxe e teste automatizado.
- [ ] Gerar ZIP versionado após a validação.
