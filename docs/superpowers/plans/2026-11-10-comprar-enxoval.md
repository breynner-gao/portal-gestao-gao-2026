# Comprar enxoval Implementation Plan

> Executar inline, com revisão final do conjunto.

**Goal:** entregar a central aprovada com cálculos, ações e persistência reais.
**Architecture:** modelo puro + renderizador da central importados pelo fluxo existente; operações existentes reutilizadas em modais. Pequena migração para pedidos/recebimentos de peças prontas com autorização e idempotência.
**Tech Stack:** módulos JS, HTML/CSS, Supabase/PostgreSQL.
**Spec:** docs/superpowers/specs/2026-11-10-comprar-enxoval-design.md

## Global Constraints
- Preservar mapa, RFID, históricos, custo/origem de lotes e permissões.
- Uma central; sem submenu de estoque dentro de outro submenu.
- Saldos compartilhados e dados faltantes nunca tratados como zero confirmado.

## Review Focus
- Trocar de base RFID depois de receber peças não duplica estoque.
- Duas peças com o mesmo tecido disputam o mesmo saldo.
- Quantidades recebidas/parciais/canceladas não geram pedido duplicado.
- Modal permanece na tela, conserva estado e mostra falha sem fechar.
- Tablet e desktop permitem expandir uma peça e concluir a ação.

## Tasks
- [x] Modelo puro: testes de necessidade líquida, pedidos prontos, estoque adicional, tecido compartilhado e vínculos incompletos.
- [x] Persistência de peças prontas: RLS, RPC com validação, idempotência, recebimentos parciais e auditoria; teste PostgreSQL sintético.
- [x] Central e integração: menu raso, linhas expansíveis, modais de compra, OS, corte/retorno, estoque, qualidade e cadastros; testes DOM.
- [x] Revisão do conjunto, suíte completa, migração, publicação e verificação do endereço real.
