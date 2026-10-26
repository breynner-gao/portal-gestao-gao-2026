# Controle de lixo, faturamento e rastreabilidade ambiental

## Intenção

Criar uma área própria de lixo dentro do módulo de químicos, sem misturar lançamentos, percentuais ou históricos de lixo com relave. O recurso deve permitir medir o custo de destinação por kg de roupa lavada e validar as cobranças das duas empresas coletoras.

## Escopo aprovado

- Aba própria para painel, lançamento e histórico de lixo.
- Empresa coletora selecionada em cada registro, com preço por kg independente.
- Kg de triagem informado no lançamento como referência operacional.
- Valor calculado pelo sistema e valor cobrado na nota/manifesto.
- Conferência da diferença entre valor correto e valor cobrado.
- Controle ambiental por coleta: SEMAD ou SINIR, protocolo, data, responsável, comprovante e status.
- Indicador consolidado somente depois da validação dos lançamentos.
- Custo por kg de roupa lavada usando a mesma fonte oficial de kg lavado do químico e do relave.
- Painel do custo químico distinguindo “última base recebida” e “último custo válido”.

## Não objetivos

- Não somar lixo no percentual de relave.
- Não substituir o histórico existente de relave.
- Não apresentar uma semana antiga como período atual.
- Não aprovar faturamento sem conferência do peso, preço e evidência.

## Dados mínimos do lançamento

Data, período, empresa, responsável, kg coletado, kg de triagem, preço contratado/kg, valor cobrado, nota/manifesto, sistema ambiental, status ambiental, protocolo, data do lançamento, responsável ambiental, comprovante e observações.

## Regras

`valor calculado = kg coletado × preço contratado/kg`.

`diferença = valor cobrado − valor calculado`.

`custo de lixo/kg de roupa lavada = valor validado das duas empresas ÷ kg de roupa lavada do período`.

Os lançamentos das empresas permanecem separados; somente o indicador consolidado soma os valores já validados.

## Persistência

Usar o mesmo armazenamento remoto Supabase já empregado pelo módulo de químicos, com uma chave própria para lixo. O navegador pode manter a fila temporária existente, mas o lançamento só deve ser considerado sincronizado quando o banco confirmar.
