# Finalização de atividade com modal integrado

## Intenção

Substituir o `prompt` nativo do navegador usado ao finalizar uma atividade de Produção de Enxoval por um formulário visual integrado ao padrão GAO. O operador deverá informar a quantidade realizada e registrar dificuldades sem sair da tela.

## Escopo

- Ao clicar em **FINALIZAR**, abrir um modal dentro do portal.
- Campos: quantidade de peças realizada (obrigatório), dificuldade encontrada (opcional) e observação complementar (opcional).
- Botões claros: **Salvar e finalizar** e **Cancelar**.
- Validar quantidade antes de concluir.
- Manter cálculo de duração, status `CONCLUIDA` e sincronização com Supabase.
- Exibir erro de sincronização sem perder os dados locais.

## Fora do escopo

- Alterar programação, permissões, banco de dados ou telas de outros módulos.
- Alterar regras de produtividade já existentes.

## Abordagem escolhida

Modal integrado em vez de `prompt`, porque o público operacional precisa visualizar todos os campos e confirmar a conclusão em uma única etapa, com menos risco de abandonar ou salvar parcialmente.

## Critério de aceite

Ao finalizar uma atividade, nenhum alerta nativo do navegador deve aparecer. O modal deve salvar quantidade, dificuldade, observação, horário final, duração e status centralizado; cancelar deve manter a atividade em andamento.
