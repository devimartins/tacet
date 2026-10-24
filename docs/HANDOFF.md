# Handoff — Codex ↔ Claude — captura ForjaClip

Atualizado em 24/10/2026. Responsável por esta atualização: Codex.

## Estado atual

**Protótipo implementado parcialmente e não publicado.** A branch de trabalho é `feature/server-clip-capture`, baseada no commit `1353ff0` da `main`. A main publica automaticamente no GitHub Pages: não usar como caderno de experimentos.

A versão aqui foi obtida por clone do repositório público. O ZIP mencionado na conversa não estava disponível neste workspace.

## Escopo aprovado pela usuária

- ForjaClip já analisa transcrição e exibe sugestões por embed YouTube.
- Capturador só entra na página de sugestões, após existência dos miniplayers.
- Botão individual em área reservada do card, sem sobrepor elementos.
- Só grava quando o usuário pede download. Sem gravar antecipadamente todos os cortes.
- Reprodução e captura em navegador no servidor externo, fora da sessão do usuário.
- Capturar apenas composição do vídeo e legendas no estilo escolhido, saída 9:16.
- Progresso real, download individual e arquivos temporários.
- Não reimplementar sugestão de cortes nem alterar pagamento/IA.

## Decisões e código

- `docs/integration-proposal.patch`: proposta para o Claude aplicar em `cortes-youtube.html` e `config.js`. Adiciona `attachCapture()` após criar cards e `CAPTURE_API` vazio. **Os arquivos existentes não foram alterados nesta branch.**
- Divisão acordada: Codex mantém serviço e módulos novos; Claude mantém páginas/configuração existentes.
- `js/capture-client.js`: UI no rodapé, API, sessão, polling, cancelamento, link e proteção contra baixar snapshot antigo depois de editar.
- `js/capture-scene.js`: snapshot + desenho compartilhado de legendas/nomes. Renderer usa este módulo; o patch propõe que a prévia também o use.
- `capture-service/server.mjs`: HTTP, autenticação Supabase, autorização por dono, validação, links temporários.
- `capture-service/jobs.mjs`: fila sequencial, cotas em memória, expiração/cancelamento.
- `capture-service/worker.mjs`: Playwright + X11/PulseAudio + FFmpeg, verificação FFprobe e sinal de áudio.
- `capture-service/public/`: composição em 720×1280; mesmos estilos e geometrias da prévia.
- `capture-service/Dockerfile`: implantação Linux proposta. Ainda não construída aqui.
- `capture-service/README.md`: execução, limitações e critérios de aceitação.

## Configuração — nomes apenas

Front-end: `CFG.CAPTURE_API`, `CFG.SB_URL`, `CFG.SB_ANON`.
Serviço: `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAX_DAILY_JOBS`, `PORT`, `OUTPUT_DIR`.
Internos do container: `DISPLAY`, `PULSE_SINK`.
Não requer chave Gemini/Groq/Mercado Pago, service role, senha do usuário nem alteração no Worker tacet-ai.
Nunca colocar tokens de sessão, .env ou valores secretos neste arquivo/issues.

## Validação

Há testes automatizados de schema, fila/isolamento/cancelamento/expiração e FFmpeg com mídia sintética. Resultado local: **6 testes passaram**, incluindo mídia MP4 sintética real; syntax checks passaram; `git apply --check docs/integration-proposal.patch` passou. Testes sintéticos NÃO comprovam captura real do embed.
Não foi testado em navegador real nem publicado; ambiente Codex sem Docker, Xvfb ou PulseAudio.

## Próximas tarefas por responsável

### Codex
- Concluir checks locais, revisar diff e registrar resultados abaixo.
- Disponibilizar branch/patch sem alterar main.
- Revisar retorno do Claude em nova rodada.

### Claude no Mac
1. Ler este arquivo e README do serviço; revisar diff e `docs/integration-proposal.patch`. Aplicar/adaptar o patch nas páginas existentes sob sua responsabilidade.
2. Construir Docker e testar vídeo próprio/autorizado com áudio e contador.
3. Conferir origem do embed, imagem só do stage (sem chrome), fontes, sincronia e corte exato.
4. Corrigir/calibrar relógios FFmpeg/browser; medir início/fim e A/V. Hoje é aproximação, não precisão de frame.
5. Rever falhas de player, anúncios e UI do YouTube: a API não comprova ausência de anúncios; não declarar arquivo limpo automaticamente.
6. Validar autenticação com duas contas, alinhar acesso a estilos Pro com regra real e proteger abuso antes de ativar.
7. Selecionar com a usuária servidor persistente disponível; manter CAPTURE_API vazio até o piloto passar.
8. Atualizar este arquivo com comando, ambiente, resultado e commit. Não colocar segredos.

## Protocolo de colaboração

Usar esta branch para a troca inicial. Antes de editar: `git status`, `git fetch origin` e `git pull --ff-only` na branch correta. Se houver alterações locais, preservá-las antes de puxar.
Commits pequenos; sem force push. Evitar edição simultânea dos mesmos arquivos; indicar aqui o que está em trabalho. Issues podem guardar perguntas pontuais quando houver acesso autenticado ao GitHub.
Merge na main apenas após testes reais e decisão explícita de publicar. Acesso ao repositório não dá acesso à conversa da outra IA.

## Diário

- 24/10 — Codex: protótipo + handoff + patch para integração. 6 testes passaram; sintaxe e aplicação do patch verificadas. Captura real, deploy e custo ainda pendentes.
