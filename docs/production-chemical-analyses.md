# Análises químicas de Produção

Rota: `/producao/analises-quimicas`. Módulo nativo do SGQ com o desenho aprovado no arquivo Esboco_Analises_Quimicas_GAO.html. Estilos isolados em Shadow DOM para preservar a legibilidade em qualquer tema do Portal.

- Água, banho e enxágue em formulários modais; data, unidade, ponto e coletor obrigatórios. Banho/enxágue também identificam máquina e etapa.
- Campos não medidos ficam vazios; zero é um resultado. Valores e temperaturas são independentes por leitura. Salinidade permite ppm ou % sem conversão automática.
- Critérios são versões imutáveis por organização/unidade/tipo/origem/ponto/etapa, vigência e método. A avaliação é executada no servidor e preservada no registro. Faixas incompletas indicam avaliação parcial. Revisão técnica é independente e perde validade ao alterar medições.
- RLS exige organização GAO ativa, vínculo/perfil ativos, unidade permitida e permissão específica. Execute edita apenas os próprios registros; manage permite equipe/arquivamento; parameters publica critérios; review emite parecer. Fotos novas usam bucket privado com limite de 8 MB. Referências importadas permanecem protegidas na tabela de evidências, sem imagens publicadas no repositório.
- UUID estável e nonce tornam o reenvio idempotente. A revisão evita sobrescrever alterações feitas por outra pessoa. Gravação malsucedida mantém o modal preenchido. Caso a amostra salve e uma evidência falhe, reenviar conclui as evidências sem duplicar a amostra.
- Relatórios incluem resultados, unidades, temperatura, identificação do processo, critério utilizado, parecer e fotos. Exportação CSV compatível com Excel e impressão/PDF.
- Evolução mostra pontos medidos e tendência linear a partir de três medições comparáveis. Não mistura pontos, unidades, aplicações ou métodos. Amostra de referência sem data é excluída do gráfico.

A referência fornecida por Breynner foi cadastrada sem inventar data, responsável ou ponto. As primeiras cinco fotos foram vinculadas à referência; as outras cinco ficam identificadas como amostra a identificar. Completar o cadastro é necessário antes de tratá-la como coleta regular. Alcalinidade aguarda método/base de expressão; nenhuma faixa de qualidade foi presumida.

Validação: testes unitários e regressão de navegação/permissões/sessão; integração DOM de banho, preenchimento, falha e reenvio; transação revertida no banco para classificação parcial, zero, idempotência, revisão e arquivamento; transação revertida comprovando bloqueio de leitura/gravação para Facção; assessor de segurança sem novos achados para este módulo. Os testes transacionais não deixam amostras artificiais no histórico.
