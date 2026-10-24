# Handoff entre agentes

Atualize este arquivo ao terminar cada sessão. Nunca escreva valores de chaves, só os nomes.

## Estado atual (24/10/2026)
- Tela inicial: teleprompter, "Legende seu vídeo" e "Cortes de vídeo longo", e o card "Cortes a partir de um link do YouTube" (Beta).
- Página `cortes-youtube.html`: transcrição automática pelo link (Worker `/transcript`, Gemini), trechos sugeridos, mini players em 9:16, legenda de prévia, edição de legenda por trecho, tela dividida para duas pessoas, tela cheia, menu lateral/inferior.
- Limites de transcrição por link (no Worker): grátis 1 h/dia, Pro 3 h/dia, teto global 7,5 h/dia. Variáveis do Worker: `FREE_DAILY_YT_SEC`, `PRO_DAILY_YT_SEC`, `GLOBAL_DAILY_YT_SEC`.
- Avatares: 16 desenhos originais em `js/avatar.js`.
- Service worker sem recarga automática de página.

## Segredos (só os nomes; os valores ficam no Worker e no Supabase)
`GEMINI_KEY`, `GEMINI_MODEL`, chaves do Groq, `MP_TOKEN` (Mercado Pago), service role do Supabase.

## Pendências conhecidas
- Teto mensal de transcrição por usuário (depende de uma função de uso no Supabase que não está no repositório).
- Verificar com um vídeo real do YouTube o corte 9:16 e a tela dividida.

## Tarefa do Codex: sistema novo
- O que é o sistema: protótipo de captura externa da composição dos cortes sugeridos, com vídeo/legendas em 9:16; só inicia quando o usuário pede download.
- Onde entra no app: componente exclusivamente na página `cortes-youtube.html`, após criação dos miniplayers; API e gravação em servidor Linux externo. Não modifica o Worker `tacet-ai`.
- Codex: `capture-service/`, novos módulos `js/capture-client.js` e `js/capture-scene.js`, documentação/patch em `docs/`. Claude: páginas, configuração e cache existentes.
- Branch de trabalho: `codex/captura-cortes`; abrir pull request para a `main`.

## Registro
- 24/10/2026 — Claude: criou `AGENTS.md` e este arquivo.

## Captura — atualização Codex (24/10/2026)

**Estado: protótipo em rascunho, não hospedado, sem integração ativa.** A `main` e as páginas existentes não foram modificadas por este trabalho. PR ativo: https://github.com/devimartins/tacet/pull/2 — branch `codex/captura-cortes`. O PR #1 foi fechado sem merge e substituído por este.

### Escopo e divisão

O ForjaClip continua responsável por transcrição, análise e prévias. O serviço novo recebe snapshot (vídeo, início/fim, texto, estilo, posição/sincronia, visibilidade de legendas e enquadramento), enfileira captura, grava num navegador no servidor, verifica MP4 720×1280 e retorna download temporário. Botão fica no rodapé do card, sem sobreposição, e nada é gravado antes do clique.

Codex implementou o serviço, módulos novos e `docs/integration-proposal.patch`. Claude deve revisar/aplicar o patch nas páginas sob sua responsabilidade; ele não foi aplicado nesta branch. O renderer usa o mesmo motor de legendas existente. A referência de execução/limitações é `capture-service/README.md`.

### Escopo confirmado

A usuária solicitou explicitamente o serviço externo de gravação do miniplayer. A revisão bb62754 da main removeu a antiga regra 7 de AGENTS.md. Este protótipo permanece desativado até validação de uso autorizado, compatibilidade com o provedor e mensagens de privacidade.

### Configuração (nomes, nunca valores)

Site: `CFG.CAPTURE_API`, vazio até validação. Serviço: `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAX_DAILY_JOBS`, `PORT`, `OUTPUT_DIR`; container: `DISPLAY`, `PULSE_SINK`. O serviço valida o token do usuário pelo Supabase Auth. Não requer service role nem chaves de IA/pagamento.

### Testes e limites

- 6 testes locais passaram: validação, fila, isolamento, cancelamento, expiração e MP4 vertical sintético com áudio.
- Syntax checks passaram. `git apply --check docs/integration-proposal.patch` passou; revalidar caso as páginas mudem.
- Não foi executada captura real do embed: ambiente desta sessão sem Docker/Xvfb/PulseAudio. Não foi feito QA visual em 390/1280 px.
- Relógios navegador/FFmpeg precisam de calibração; falta confirmar início/fim e A/V com vídeo real.
- Anúncios/UI do YouTube podem entrar na captura. Não há detecção automática confiável implementada.
- Fila/cotas em memória, uma instância e um worker. Reinício perde tarefas. Falta alinhar regras Pro, definir infraestrutura e custo.

### Próximo passo — Claude

1. Revisar módulos e patch, integrar apenas na página de sugestões, respeitando `brand/DESIGN-SYSTEM.md`.
2. Ao integrar, reler e incrementar cache em `sw.js` e as referências `js/app.js?v=N` no `index.html`; versionar imports dos módulos modificados. Valores observados na base 8121075: cache 154 e app 169; **não presumir que continuam atuais**. Esses arquivos pertencem à área Claude e não foram alterados aqui.
3. Construir Docker e validar captura com vídeo próprio/autorizado, sincronia, legendas, enquadramentos, áudio e ausência de elementos externos.
4. Conferir origem/referer do embed, erros/anúncios, autenticação de duas contas, cotas, planos e expiração.
5. Atualizar este arquivo com resultados e commit; manter PR em rascunho até resolver bloqueadores.

### Comunicação

Cada agente lê este arquivo antes de editar e registra alterações ao terminar. Não editar simultaneamente os mesmos arquivos; sem force push. Discussões pontuais no PR; nenhuma mesclagem/publicação automática.

- 24/10/2026 — Codex: PR #2 aberto em rascunho; PR #1 substituído. Atualizações da main até bb62754 incorporadas à branch sem modificar páginas do Claude. Próxima validação: Docker + captura real.
