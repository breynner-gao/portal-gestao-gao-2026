# Indicadores da Gerência de Qualidade — Estrutura Separada

## Intenção

Reorganizar o módulo de indicadores da Gerência de Qualidade em três etapas independentes, com dados rastreáveis e sem misturar produção industrial ou produção da costura.

## Objetivos

- Criar lançamentos operacionais simples e auditáveis.
- Separar telas de lançamento, análise e painel executivo.
- Exibir somente indicadores sob responsabilidade da Qualidade no painel principal.
- Preservar histórico, evidências, responsáveis e prazos.
- Mostrar “Não apurado” quando não houver fonte validada.

## Fora de escopo

- Produção industrial.
- Produção da costura.
- Produtividade de áreas pertencentes a outros gerentes.
- Cálculo de indicadores com dados não validados.

## Etapas

### 1. Lançamentos confiáveis

Relave; peças sem condição de uso; não conformidades; inventário/enxoval; auditorias; planos de ação; responsável, prazo e evidência; correção/cancelamento com histórico.

### 2. Análises complementares

Relave e perdas; SLA e ocorrências; acuracidade/suficiência do enxoval; auditorias; planos atrasados; rouparias externas; químicos/dosadores; resíduos/lixo. Cada assunto terá sua própria tela, sem painel dentro de painel.

### 3. Painel Executivo da Qualidade

Cards de: não conformidades; SLA; acuracidade do enxoval; relave e perdas; auditorias/planos; rotinas da Qualidade. Cada card exibirá resultado, meta aprovada, referência do período, tendência, farol e validação, com botão “Ver detalhes”.

## Regras

- Metas, pesos e faixas de farol devem ser configuráveis e aprovados; não serão inventados pelo sistema.
- SLA de complemento não será negativado quando atender à necessidade real do setor.
- Zero será diferente de ausência de informação.
- Toda alteração terá usuário, data, valor anterior e valor atualizado.
- O painel executivo terá filtros por período, cliente e unidade.
- A produção permanece fora deste módulo e será marcada como não apurada aqui.

## Abordagem escolhida

Implantação em fases: primeiro os indicadores com base confiável; depois as análises complementares; por fim o painel executivo consolidado. Essa abordagem reduz risco de números misturados e permite homologação etapa por etapa.
