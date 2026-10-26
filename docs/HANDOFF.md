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

## Captura — teste na AWS (Claude, 25/10/2026)

**Estado: serviço instalado e testado numa instância de teste, agora PARADA. Integração NÃO publicada; `CFG.CAPTURE_API` continua vazio.** Branch: `claude/captura-infra-teste` (a partir de `codex/captura-cortes`). Nenhum arquivo de `capture-service/` ou das páginas foi alterado; os scripts de teste estão em `docs/capture-test-kit/`.

### Infraestrutura (aprovada pelo dono; Free account plan, créditos)

- EC2 `forjaclip-capture-test`, `c7i-flex.large` (2 vCPU, 4 GB), Ubuntu 24.04, sa-east-1, EBS gp3 20 GB (apagado se a instância for encerrada), IPv4 público automático, sem Elastic IP, sem par de chaves.
- Security group `forjaclip-capture-test-sg`: só SSH 22 a partir da lista `com.amazonaws.sa-east-1.ec2-instance-connect`. A regra temporária da porta 8081 (só IP do dono, para ver quadros) foi removida.
- Acesso: EC2 Instance Connect pelo console (usuário `ubuntu`). Repositório em `/opt/tacet`, imagem Docker `forjaclip-capture` (3,27 GB), testes em `/opt/test`, saídas em `/opt/out`. O user data agendou desligamento automático 8 h após o primeiro boot; isso não se repete ao religar.
- Custo do teste: ~30 min ligada ≈ US$ 0,07 (US$ 0,13067/h + IPv4 US$ 0,005/h). **Parada, só o disco cobra: ~US$ 3,04/mês (US$ 0,152/GB-mês).** Rede de saída desprezível (< 50 MB).

### Resultados

- Build Docker OK. `npm test` no container: 6/6. `/health` 200; `POST /jobs` sem token 401; origem não autorizada 403; `/render` 200.
- **Bug 1 (corrigir no serviço):** o renderer não carregava: `render.js` é módulo, o Chromium envia `Origin: http://127.0.0.1:8080`, e o `server.mjs` responde 403 porque essa origem não está em `ALLOWED_ORIGINS` → `waitForFunction` estoura em 30 s. Contorno usado só no teste: incluir `http://127.0.0.1:8080` em `ALLOWED_ORIGINS`. Correção sugerida: não aplicar a checagem de origem às rotas estáticas do renderer (ou aceitar a própria origem interna).
- **Bloqueio principal: YouTube a partir do IP da AWS.** O embed mostra "Sign in to confirm you're not a bot" e retorna erro 150 (testado com vídeo Creative Commons). O bloqueio é por IP, então o vídeo do dono deve falhar igual. Não foi contornado (sem cookies de conta, proxy ou outra rede). Sem resolver isso, a captura de YouTube em datacenter não funciona.
- Para validar o resto do pipeline, usei um substituto **de teste** do player (`docs/capture-test-kit/mockyt.js`) com vídeo sintético (flash + bipe a cada segundo). Resultados (início em 5 s):
  - A: 10 s, 9:16 recortado, legenda `classico` → OK em 30,8 s; MP4 H.264 720×1280 30 fps + AAC, duração 10,000 s, pico −22,8 dB.
  - B: 10 s, sem recorte (contain), `impacto` → OK; C: 10 s, recortado, sem legenda → OK; D: 60 s, recortado, `chama` → OK em 107,8 s, duração 60,000 s.
  - Legendas aparecem nos tempos certos (quadro inicial mostra "5s…", final "13s 14s").
  - Início: o primeiro flash cai em ~0,17–0,20 s, ou seja, o corte começa ~0,15–0,2 s **antes** do ponto pedido. Sincronia: o áudio adianta o vídeo em ~50–115 ms (cresce um pouco nos primeiros segundos do teste de 60 s). Precisa de calibração.
- **Bug 2 (corrigir no serviço):** a interface do navegador entra na gravação: abas, barra de endereço `127.0.0.1:8080/render` e o balão do Tradutor. A barra também empurra a composição, cortando a parte de baixo. `--kiosk` não resolveu com Playwright. Correção validada no teste (`harness-fix.mjs`): colocar a janela em tela cheia via CDP (`Browser.getWindowForTarget` + `Browser.setWindowBounds` com `windowState: 'fullscreen'`). Isso removeu abas e barra. O balão do Tradutor continuou mesmo com `--disable-features=Translate,TranslateUI`, `--lang=pt-BR` e `locale: 'pt-BR'`; sugestão: `translate="no"` no `<html>` e `<meta name="google" content="notranslate">` em `render.html`, depois retestar.

### Impedimentos

1. YouTube bloqueia reprodução no IP da AWS (verificação anti-robô). Decisão do dono: outra forma de origem do vídeo (ex.: arquivo enviado pelo próprio usuário) ou outra arquitetura. Não contornar as proteções do YouTube.
2. Termos do YouTube sobre gravar ou baixar conteúdo: precisam de análise antes de qualquer liberação.
3. O teste com o vídeo do dono não foi feito: o link não chegou durante a sessão, e o bloqueio por IP o impediria.
4. O teste pela API com token real (duas contas, cotas, expiração e download) não foi feito, porque não entro na conta do dono.

### Próximos passos — Codex

1. Corrigir o Bug 1 (origem nas rotas estáticas) e o Bug 2 (tela cheia via CDP + `notranslate`), com teste automatizado se possível.
2. Calibrar o deslocamento de início (~0,15–0,2 s) e a sincronia A/V (~50–115 ms) usando `gen.sh`/`verify.sh`. Verificar a deriva no fim de cortes de 60 s.
3. Decidir com o dono a origem do vídeo diante do bloqueio do YouTube antes de investir na integração.
4. Para retestar: iniciar a instância, entrar pelo Instance Connect, `cd /opt/tacet && git pull`, rebuild e rodar o kit. Parar a instância ao terminar. Se o projeto não for seguir, encerrar a instância para zerar o custo do disco.

- 25/10/2026 — Claude: instância de teste criada, testada e parada; resultados e bugs acima. Nada publicado; `main` intocada.
