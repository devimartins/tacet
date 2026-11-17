# Handoff entre agentes

Atualize este arquivo ao terminar cada sessão. Nunca escreva valores de chaves, só os nomes.

## Resumo consolidado do ForjaClip (26/10/2026)
Reúne o contexto de vários chats. Cole este arquivo no início de um chat novo.

**Produto e planos**
- PWA freemium em https://forjaclip.com.br: legendas animadas, cortes com IA, teleprompter, cortes do YouTube pelo link. O vídeo é processado no aparelho; só o áudio vai ao Worker (Whisper).
- Grátis: vídeos até 350 MB, anúncios (AdSense), projetos guardados por 3 dias. Pro: até 1 GB, sem anúncios; R$ 19,90 nos 3 primeiros meses e depois R$ 29,90; anual R$ 199. Pagamento por Mercado Pago (Checkout Pro + webhook), sem renovação automática, reembolso em até 7 dias.
- Dono escreve em português, sem orçamento para ferramentas pagas. Respostas e textos do app em pt-BR.

**Infraestrutura**
- Front: GitHub Pages (repo `devimartins/tacet`, branch `main`). Worker: Cloudflare `tacet-ai` (fora do repo; trechos de código ficam em `docs/`). Banco/login: Supabase (SQL em `supabase/`). E-mail: Resend.
- `supabase/promo.sql` (códigos promocionais e convites) precisa ser rodado uma vez no SQL Editor, depois de `admin.sql`.
- Whisper com `prompt` em português e retry/fallback da transcrição por link exigem copiar o código de `docs/` para o Worker e fazer deploy.

**Editor (recursos principais já implementados)**
- Legendas: estilos, fontes, animações, alinhamento esquerda/centro/direita, guias de alinhamento, edição de fonte/animação por trecho de legenda, pontuação e maiúsculas automáticas.
- Troca/remoção de fundo (MediaPipe, no aparelho) com cenários de estúdio e busca de imagem (Openverse); oferecida após o teleprompter.
- Textos livres sobre o vídeo (`Adicionar texto`: fonte, cor, fundo, tamanho, posição; fixo no vídeo todo por padrão), títulos de gancho, imagens, B-roll, logo.
- Timeline (painel lateral no desktop; botão "Exibir timeline" no celular), áudio e música extras, cor e look, zoom automático, edição automática.
- Barra do editor no celular: Estilo, Legendas, Texto, Cor, Ferramentas, Trocar fundo, Áudio, Edição automática, Exportar. Seções do painel são expansíveis (acordeão).
- Exportação com botões de compartilhar e descrição/hashtags por IA.

**Site e SEO**
- Páginas estáticas em `/ferramentas/`, `/guias/` e `/comparar/`; sitemap; dados estruturados; rodapé da landing redesenhado (cards de Ferramentas e Guias).
- Pendências do dono: enviar o sitemap no Search Console, pedir indexação, buscar backlinks.

**Não verificado em aparelhos reais**
- Fluxos no iPhone (tela cheia e adicionar à tela inicial), qualidade da remoção de fundo com pessoas reais, velocidade de exportação com fundo trocado, botões de compartilhar, edição por trecho de legenda, aparência do texto livre no vídeo exportado, tour guiado com seções recolhidas.

**Ideias em aberto**
- Arrastar o texto direto no vídeo; controle de velocidade; imagens de cenário geradas por IA (fornecidas pelo dono); minificar JS; mais guias e FAQ.

**Combinados com o dono**
- Pode fazer sem pedir aprovação e avisar ao terminar ("todas as etapas estão aprovadas"). O dono autorizou o Claude a publicar direto na `main` quando pede mudança. Não se trabalha mais com o Codex.

## Estado atual (24/10/2026)
- Tela inicial: teleprompter, "Legende seu vídeo" e "Cortes com IA", e o card "Cortes do YouTube" (Beta).
- Página `cortes-youtube.html`: transcrição automática pelo link (Worker `/transcript`, Gemini), trechos sugeridos, mini players em 9:16, legenda de prévia, edição de legenda por trecho, tela dividida para duas pessoas, tela cheia, menu lateral/inferior.
- Limites de transcrição por link (no Worker): grátis 1 h/dia, Pro 3 h/dia, teto global 7,5 h/dia. Variáveis do Worker: `FREE_DAILY_YT_SEC`, `PRO_DAILY_YT_SEC`, `GLOBAL_DAILY_YT_SEC`.
- Avatares: 16 desenhos originais em `js/avatar.js`.
- Service worker sem recarga automática de página.

## Segredos (só os nomes; os valores ficam no Worker e no Supabase)
`GEMINI_KEY`, `GEMINI_MODEL`, chaves do Groq, `MP_TOKEN` (Mercado Pago), service role do Supabase.

## Pendências conhecidas
- Teto mensal de transcrição por usuário (depende de uma função de uso no Supabase que não está no repositório).
- Verificar com um vídeo real do YouTube o corte 9:16 e a tela dividida.

## Codex
O dono decidiu (26/10/2026) não trabalhar mais com o Codex. Não há tarefas nem coordenação com ele. Os PRs #2, #3, #6 e #9 foram deixados abertos e podem ser fechados pelo dono.

## Registro
- 24/10/2026 — Claude: criou `AGENTS.md` e este arquivo.

- 24/10/2026 — Claude: formato original do vídeo como padrão no editor (seletor sempre visível); botões "?" de ajuda (`js/help.js`); renomeados Início, Cortes com IA, Cortes do YouTube, Reduzir player, Cortar pausas das pontas; tour só na tela certa; vídeo de cada projeto guardado no aparelho (3 mais recentes); textos do login atualizados. Leu o PR #2 do Codex (ainda sem integração).

- 24/10/2026 — Claude: botões "?" redondos (24 px; 30 px no toque); controle de volume e atalho "Editar legendas" dentro do player do editor (`#stCtl`) e em cada card de `cortes-youtube.html` (volume único, lembrado em `forjaclip.vol`; botão de mudo também em tela cheia; lápis no card abre a edição). Testado no navegador (390, 820 e 1280 px). PR `claude/volume-legendas`: `sw.js` v160, `app.js?v=175`. O PR #3 (captura) precisa de merge da main e novo aumento de versão depois deste.

- 24/10/2026 — Claude: PR #4 mesclado. Som de forja (arquivo do dono) toca ao concluir a exportação: `sounds/forja.m4a` (AAC, para Safari/iPhone) e `sounds/forja.webm` (original, reserva); liberado no clique em "Gerar" (`unlockForja`), usa a opção "Som de forja ao concluir a exportação" (antes "Aviso sonoro"); se o áudio falhar, toca os dois tons antigos. Branch `claude/som-forja`: `sw.js` v161, `app.js?v=176`. Testado: os dois arquivos carregam e tocam no navegador; o disparo no fim de uma exportação real não foi testado aqui (sem vídeo/transcrição no sandbox).

- 25/10/2026 — Claude: SEO para busca de legendas. Novas páginas estáticas no Design System (`css/conteudo.css`): hub `/ferramentas/`, 9 ferramentas (gerador de legendas, Reels, TikTok, Shorts, YouTube pelo link, SRT/VTT, cortes com IA, remover silêncio, traduzir legenda) e 4 comparações em `/comparar/` (Submagic, Captions, Descript, VEED), cada uma com dados estruturados (WebPage, BreadcrumbList, SoftwareApplication, FAQPage). Guias migrados para o mesmo CSS e ligados às ferramentas; sitemap com 22 URLs; título e descrição da página inicial focados em "legenda automática" e bloco de links de ferramentas no fim da landing. Páginas de ferramenta sem script do AdSense (só a meta da conta), para carregar rápido. Comparações não citam preço de concorrente; mandam conferir o site oficial. Branch `claude/seo-ferramentas`: `sw.js` v171, `app.js?v=174`. Testado em 390 e 1280 px, claro e escuro, sem rolagem horizontal e sem links quebrados (fontes externas bloqueadas no sandbox). Pendências do dono: enviar o sitemap no Google Search Console, pedir indexação das páginas novas e buscar backlinks (listas de "melhores geradores de legenda", Product Hunt, diretórios de IA).

- 25/10/2026 — Claude: meta de verificação do Google Search Console no `index.html` (propriedade por prefixo de URL). `sw.js` v172, `app.js?v=175`.

- 26/10/2026 — Claude: coordenação com o Codex pelo GitHub pausada a pedido do dono (aviso no topo deste arquivo e nos PRs #2 e #9).

- 26/10/2026 — Claude: rodapé da landing redesenhado; botão "Adicionar texto" (texto livre fixo, com fonte/cor/fundo/tamanho/posição); atalhos Texto e Cor na barra do editor; transcrição por link com retry automático (502/503/504) na página e retry + modelo alternativo (`gemini-2.5-flash-lite`) em `docs/worker-transcript-cache.js` (copiar para o Worker e fazer deploy). `sw.js` v175.

- 27/10/2026 — Claude: teleprompter no iPhone. Novo `js/recorder.js`: gravador próprio com WebCodecs (H.264 + AAC) a partir do canvas já composto, gerando MP4 comum (com índice) em vez do MP4 fragmentado do MediaRecorder do iOS; cai no MediaRecorder se o aparelho não tiver os codificadores. `js/remux.js` conserta MP4 fragmentado antigo ao abrir; `media.js` com plano B para decodificar áudio (decodeAudioData). Botões de formato (vertical/horizontal) e zoom no teleprompter. Testado só no Chromium do sandbox (sem H.264/AAC): pipeline validado com VP9/Opus e fallback; **o caminho H.264/AAC precisa de confirmação no iPhone**. `sw.js` v184, `app.js?v=188`, `teleprompter.js?v=22`.

- 10/11/2026 — Claude: exportação travava perto do fim (ex.: 93% num vídeo de 10 s, Chrome no Windows). Causa provável: em `js/render.js` o código esperava `dec.flush()` antes de processar os quadros já entregues; o decodificador por hardware só libera os últimos quadros quando os anteriores são fechados, então o flush nunca terminava. Agora a fila é esvaziada durante o flush; se o decodificador ficar 20 s sem entregar quadros, recomeça em software; se o codificador parar 30 s, mostra erro em vez de travar. `render.js?v=9`, `app.js?v=204`, `sw.js` v200. Não testado em aparelho real (sem WebCodecs aqui); falta o dono confirmar no Windows.

- 10/11/2026 — Claude: auditoria da exportação + registro automático de erros.
  - `js/render.js`: todas as esperas por codificador/decodificador têm limite de tempo e conferem erro (antes, um codec que falhava deixava a tela parada para sempre); o progresso conta a partir de cada quadro decodificado; se a geração falhar ou for cancelada, fecha decodificador, codificador e quadros abertos (antes ficavam presos e a exportação seguinte podia travar); cancelar não aparece mais como "Falha ao gerar o vídeo: Geração cancelada."; áudio original ilegível com música/efeitos agora dá erro claro em vez de travar; `enc.flush()` com limite de 60 s.
  - `js/media.js` (transcrição) e `js/brollvideo.js`: mesmas esperas com limite.
  - Janela Exportar: botão "Cancelar geração"; reabrir a janela durante a geração mostra o progresso.
  - Registro de erros: `js/errlog.js` grava na tabela `app_errors` do Supabase (só inserção pela chave anon; leitura só pela função `admin_errors`). Captura erros não tratados dos nossos arquivos e falhas de abrir vídeo, transcrição, cortes por IA e exportação (com codec, resolução, efeitos ligados e % em que parou). Máx. 15 por aba, sem repetir mensagem, ignora anúncios/extensões. Painel do criador ganhou "Erros dos usuários (7 dias)". Registros com mais de 30 dias são apagados ao abrir o painel. Política de privacidade atualizada.
  - `supabase/errors.sql` aplicado no projeto Supabase `tacet` pelo conector (10/11); testado: anon insere e não lê; `admin_errors` funciona para o admin.
  - Testado no Chrome headless com vídeo H.264 + AAC de 10 s: exportação normal ok (299 quadros), cancelamento ok, decodificador que trava 1x recomeça em software e conclui, travamento permanente e codificador parado viram mensagem de erro. Mistura de áudio (música/efeitos) não testada: o Chrome do Linux não codifica AAC.
  - Versões: `sw.js` v201, `app.js?v=205`, `render.js?v=10`, `media.js?v=10`, `remux.js?v=5`, `brollvideo.js?v=5`, `errlog.js?v=1`.

- 10/11/2026 — Claude: o dono conectou o Supabase e o Cloudflare ao Claude. Supabase: o Claude roda SQL e migrações direto no projeto `tacet` (ubxzdibckvbquuevhvap); não precisa mais pedir ao dono. Cloudflare (conector "Workers Bindings", obsoleto): o Claude lê o código do Worker `tacet-ai`, mas não faz deploy por ele.

- 10/11/2026 — Claude: auditoria do Supabase (login, plano Pro, projetos).
  - `promo.sql` nunca tinha sido aplicado (códigos promocionais e "Liberar Pro em lote" do painel não funcionavam). Corrigida uma brecha antes de aplicar: o Supabase dá EXECUTE a `authenticated` em toda função nova, e o `revoke` só tirava de `public, anon`, então qualquer usuário logado poderia chamar `_add_pro` e se dar Pro. Agora revoga também de `authenticated`; `admin_grant_bulk` ganhou `#variable_conflict use_column`. Aplicado pelo conector e testado (usuário comum bloqueado; admin cria código e libera Pro em lote).
  - `new_user()` (gatilho) não pode mais ser chamado pela API.
  - Conferido: `profiles` só tem SELECT do próprio usuário (ninguém muda o próprio plano); `payments`, `usage`, `admins`, `alert_log` sem policies (só o Worker com a service key); `projects` protegido pelo gatilho `guard_project` (não dá para esticar o prazo de 3 dias nem trocar o dono).
  - `js/app.js`: com 20 projetos guardados (ou qualquer falha ao criar o projeto) o vídeo agora abre e dá para editar e exportar, só sem salvar na nuvem (antes a edição era bloqueada). Falhas ao criar/salvar projeto vão para o registro de erros. O vídeo só é copiado em bytes para o IndexedDB no iPhone/iPad (nos outros aparelhos a cópia ocupava a memória do vídeo inteiro); conexões do IndexedDB são fechadas.
  - `transcripts.sql` (cache de transcrição por link) continua sem aplicar: depende de publicar `docs/worker-transcript-cache.js` no Worker.
  - Versões: `sw.js` v202, `app.js?v=206`.

- 10/11/2026 — Claude: Worker `tacet-ai` publicado pela API do Cloudflare (conector "Cloudflare API"; o deploy pelo Claude funciona). Versão anterior, para voltar atrás: `fe8bd9d5-58b1-4620-8e75-cf12c4fbd95b` (painel do Worker > Deployments > Rollback). Versão nova: `b02c3cc0-1618-4c22-a9d0-4c23868b7a73`. Segredos, variáveis e o cron `*/30 * * * *` mantidos (a publicação troca só o código).
  - Webhook: pagamento com status `refunded` ou `charged_back` (estorno/contestação direto no Mercado Pago) marca `refunded_at` e tira os 31 ou 366 dias daquele pagamento do `pro_until` (nunca para antes de agora). O reembolso pelo app continua igual e não é descontado duas vezes.
  - `/transcript` (cortes do YouTube pelo link): cache por vídeo + início + duração em `transcript_cache`; trecho já transcrito volta na hora, sem gastar a cota do usuário nem o Gemini. Cada pedido vai para `yt_events` (métricas: `select * from yt_metrics();`). O teto mensal do rascunho em `docs/` NÃO foi ativado (só os limites diários de sempre).
  - Removida a rota morta `/transcript-antigo`.
  - `supabase/transcripts.sql` aplicado (tabelas `transcript_cache`, `yt_events`, `app_params`, funções `hit_transcript`, `yt_metrics`; `yt_monthly`/`add_yt_month` não foram criadas).
  - Não deu para chamar o Worker daqui (rede bloqueada); a publicação passou na validação do Cloudflare e não há "issues" registradas. Conferir no app: transcrever um link do YouTube duas vezes (a segunda deve ser instantânea).

- 10/11/2026 — Claude: teto mensal da transcrição por link ativado (pedido do dono). Grátis 3 h/mês (`FREE_MONTHLY_YT_SEC`, padrão 10800), Pro 40 h/mês (`PRO_MONTHLY_YT_SEC`, padrão 144000), admin sem teto; só conta transcrição real (cache não conta); renova no dia 1º (mês UTC). Tabela `yt_monthly` + função `add_yt_month` criadas no Supabase. Worker versão `83e22579-b7b2-4b2b-9158-da67c7f9f1d9` (anterior: `b02c3cc0-1618-4c22-a9d0-4c23868b7a73`). `cortes-youtube.html`: mensagem própria para o limite mensal; FAQ do `index.html` lista os limites. `sw.js` v203.

- 10/11/2026 — Claude: auditoria do teleprompter (`js/teleprompter.js` v31, `js/recorder.js` v8).
  - Memória: em gravação longa (45 s+) com o gravador próprio funcionando, a gravação reserva do MediaRecorder é desligada (antes o vídeo ficava duas vezes na memória e gravações de vários minutos podiam travar o celular). O áudio guardado para a transcrição já sai em 16 kHz (1/3 da memória); `extractFromPcm` já aceitava qualquer taxa.
  - Cancelar durante a contagem 3-2-1 não inicia mais a gravação depois de fechado (antes a câmera podia ligar de novo escondida). Fechar durante a gravação não reabre a câmera.
  - "Cancelar" durante a gravação pede um segundo toque (em até 3 s) para não perder o vídeo sem querer.
  - Câmera ou microfone desligado no meio (outro app, tela bloqueada, fone desconectado): encerra e guarda o que já foi gravado.
  - O bloqueio de tela apagada (wake lock) é pedido de novo ao voltar para o app.
  - Codificadores sempre fechados ao parar (com erro ou não); erro de JS corrigido quando se tocava em "Iniciar TP" antes de a câmera terminar de ativar.
  - Testado no Chrome headless com câmera/microfone falsos: gravar → usar no editor (com áudio 16 kHz anexado), cancelar na contagem, cancelar com 1 e 2 toques. O gravador próprio (H.264+AAC) não roda no Chrome do Linux (sem AAC); lá cai na reserva, como esperado.
  - `sw.js` v204, `app.js?v=207`.

- 12/11/2026 — Claude: cortes sugeridos refeitos (pedido do dono após teste com vídeo de 1 GB: cortes genéricos, ~25-30 s, sem enquadrar quem fala, sem legenda na prévia).
  - Causa das sugestões genéricas: a IA de cortes (Groq) bateu no limite de uso (429) e o app caiu calado na seleção local (`localClips`), que só pontua palavras. Ela também lia o vídeo em janelas de 8 min.
  - Worker: rota nova `/clips-v2` (versão `7a76d3ac-0b88-414d-99c9-5196ca1928e2`) usa o Gemini (`GEMINI_CLIPS_MODEL` ou `GEMINI_MODEL`, padrão gemini-2.5-flash; reserva flash-lite) com a transcrição INTEIRA; nota 0-100 = 0,35 gancho + 0,25 fechamento + 0,30 valor + 0,10 interesse; recebe `min`, `max`, `count`, `topic`. A rota antiga `/clips` (Groq) continua para versões antigas em cache.
  - `js/clips.js` v5: `suggestClipsFull`, `allLines`, `LENS` (Automático 20-75 s, 15-30, 30-60, 60-90), `snap`/`localClips` respeitam a faixa.
  - Janela "Cortes sugeridos": Duração, Tema (opcional), Enquadramento e "Refazer sugestões" (mantém aprovados e manuais). Se a IA falhar, aparece o aviso com o motivo (antes era silencioso). Cartão mostra "Nota N", tema e Gancho/Fechamento/Valor/Interesse; seleção local aparece como "Automático".
  - Enquadramento em quem fala: `js/speaker.js` (MediaPipe Face Detection "full range", arquivos novos em `vendor/face/`). Analisa só os trechos dos cortes, 3 quadros/s, em segundo plano (melhores notas primeiro); vídeo largo é procurado em duas metades sobrepostas (acha rostos pequenos). Quem fala = movimento da boca descontado o da cabeça, só nos momentos com fala; troca de pessoa com corte seco na pausa entre falas, plano mínimo de 1,6 s. Resultado em `clip.frame` (salvo no projeto). Layouts em `S.style.layout`: `follow` (padrão), `split` (duas pessoas empilhadas, `splitRects`), `center`. Vale nas prévias, no editor e na exportação (`render.js` v11: `opts.split`). `facetrack.js` passou a usar o mesmo detector.
  - Prévias dos cortes agora desenhadas em canvas: enquadramento + legendas no estilo escolhido.
  - Testado no Chrome headless com vídeo sintético de duas pessoas (rostos grandes e pequenos): trocas exatas nas pausas (8 s e 16 s); exportação "seguir" e "dividida" conferidas por imagem; seleção de cortes com resposta simulada respeitando cada faixa. NÃO testado: a resposta real do Gemini na `/clips-v2` (rede bloqueada aqui) e vídeos reais de podcast.
  - Versões: `sw.js` v205, `app.js?v=208`, `render.js?v=11`, `clips.js?v=5`, `speaker.js?v=1`.

- 12/11/2026 — Claude: auditoria de responsividade (index com todas as telas e janelas, cortes-youtube, guias, termos, privacidade, direitos autorais) em 360, 390, 768, 1024, 1280 e 1920 px, com script no Chrome headless. Nenhum estouro horizontal nem erro de JS. Corrigido: botão de Ajuda (#bot) tapava "Mais opções"/"Exibir timeline" no editor até 1099 px (agora fica no canto de cima, 44 px); alvos de toque de 44 px: "x" das janelas (.dx), "?" de ajuda (.hq, área de toque ampliada só em tela de toque), seletor de formato (#ratio), campos e selects dentro das janelas, botões da barra do celular (.mb). `sw.js` v206. Sobra: no tablet em pé (768 px) o editor não ocupa a altura toda (faixa vazia abaixo da barra de ferramentas).

- 12/11/2026 — Claude: primeira experiência (itens 1 a 3 da auditoria de UI/UX, aprovados pelo dono).
  - "Testar sem cadastro" (botão no topo da página de apresentação e na janela de login): abre a tela inicial em modo teste (`S.guest`, `LIVE = false`), com barra "Modo teste: nada é enviado nem salvo · Criar conta grátis". Legenda um vídeo de até 3 min (`GUEST_MAX`) com a transcrição no aparelho (Whisper via transformers.js, que já existia para o modo sem servidor); cortes viram seleção automática local. Teleprompter e Cortes do YouTube pedem conta. "Criar conta" recarrega a página já com o login aberto (`sessionStorage fc.login`).
  - Login deixou de ficar no meio da página de apresentação: virou janela por cima (classe `body.lgOpen`), aberta por qualquer link `#login`; fecha no ✕, no Esc ou clicando fora; foco vai para o e-mail. O CSS antigo que liga a página de apresentação ao `#login` visível continua valendo.
  - Aviso de tela cheia: uma vez só (localStorage `fc.fstip`) e só em tela de toque. Tour: não começa sozinho; na primeira visita aparece um convite "Fazer o tour" (avisos com botão ficam 10 s).
  - Corrigido: o "x" das janelas continuava com 36 px (a regra `dialog .dx` vencia); agora 44 px.
  - Testado no Chrome headless (390 e 1280 px): login fechado ao carregar, abre no "Começar grátis" com foco no e-mail, Esc fecha; modo teste abre a tela inicial e o editor com um vídeo de 10 s; nenhum estouro horizontal nem erro de JS. O download do modelo de voz é bloqueado aqui; no navegador do usuário baixa (~80 MB na primeira vez).
  - `sw.js` v207, `app.js?v=209`.

- 12/11/2026 — Claude: itens 4 a 9 da auditoria de UI/UX.
  - Tela inicial: título "O que vamos criar hoje?" no mesmo estilo do título da página de apresentação (antes herdava o h2 em maiúsculas e cor apagada); "Cortes com IA" é o primeiro cartão, maior e com borda de destaque; quem tem projetos vê "Seus projetos" logo abaixo do título (`#recent`), quem não tem vê primeiro os caminhos para começar.
  - Espera de vídeos longos: "Etapa 1 de 2 · Transcrevendo (parte n de N) · faltam cerca de X min", "Etapa 2 de 2 · A IA está lendo o vídeo inteiro…"; porcentagem no título da aba; vídeo com mais de 4 min mostra "Pode usar outras abas…" e o botão "Avise-me quando terminar" (notificação do navegador); ao terminar com a aba em segundo plano, o título vira "✓ Pronto · …" e sai a notificação (se permitida).
  - Barra de ferramentas do celular: "Exportar" fica sempre visível no fim (sticky), com sombra indicando que há mais ferramentas para arrastar.
  - Esferas decorativas da página de apresentação menores, fora da coluna de texto e escondidas abaixo de 1180 px; `html,body{overflow-x:clip}`. A frase que "acende" ao rolar não fica mais borrada (só muda a cor).
  - Barra do modo teste escondida no editor do celular (ocupava altura da prévia).
  - Testado no Chrome headless em 6 larguras: sem rolagem lateral, sem erro de JS. `sw.js` v208, `app.js?v=210`.

- 13/11/2026 — Claude: transcrição por link do YouTube falhando (iPhone, 4 tentativas) e projeto abrindo escuro.
  - Causa (log de diagnóstico no Worker): `GEMINI_MODEL` = `gemini-3.8-flash` no plano GRATUITO do Google (20 pedidos/dia por modelo, cota esgotada) e a reserva `gemini-2.5-flash-lite` foi aposentada para contas novas (404). Toda falha virava 502.
  - Worker versão `df76e8c1-983c-45bd-a889-fd830ad20d96`: `gemModels()` com cadeia de modelos atuais (GEMINI_MODEL, gemini-3.5-flash, gemini-flash-latest, gemini-3.5-flash-lite, gemini-flash-lite-latest, gemini-3.1-flash-lite); 404 ou 429 de cota diária passa para o próximo modelo (cada um tem cota própria); mensagem clara quando a cota diária de todos acaba; `/clips-v2` sem `thinkingBudget` (o Gemini 3 não aceita) e com log do erro. Diagnóstico temporário removido.
  - Uso diário "yt" zerado para 13/11 (uma tentativa cancelada pelo iPhone tinha ficado contada).
  - Projeto aberto em outro aparelho: o vídeo nunca vai para o servidor (só a legenda e os cortes). Agora, ao abrir, o vídeo do projeto anterior é descarregado (antes ficava a tela preta), e a prévia explica que o vídeo ficou no aparelho de origem e pede o mesmo arquivo; a lista de projetos mostra "vídeo neste aparelho" ou "vídeo em outro aparelho" (`vstore.has`). Texto do aviso na prévia maior (era 11 px no celular).
  - `cortes-youtube.html` agora carrega `js/errlog.js` e registra falhas de transcrição.
  - Os projetos de 10 a 12/11 sumiram porque foram excluídos pelo botão "Excluir selecionados" (DELETE às 01:12 UTC de 13/11 nos logs do Supabase).
  - Recomendação pendente com o dono: ativar o faturamento no Google AI Studio (plano pago) — o gratuito não sustenta um SaaS.
  - `sw.js` v209, `app.js?v=211`.

- 13/11/2026 — Claude: mais cota grátis de IA sem perder precisão nos cortes (aprovado pelo dono).
  - Worker versão `9ca4fa3c-51c9-4bc7-bea3-c63605ca7932` (anterior para rollback: `df76e8c1-983c-45bd-a889-fd830ad20d96`). Ganhou a binding `AI` (Workers AI); variáveis e segredos mantidos (`keep_bindings`), cron */30 conferido.
  - Transcrição por link (`/transcript`): `ytModels()` começa pelos Flash-Lite (gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-flash-lite-latest; cerca de 500 pedidos/dia grátis contra 20 do Flash) e cai para a lista do Flash. Variável opcional `GEMINI_YT_MODEL` força o primeiro.
  - Escolha dos cortes (`/clips-v2`): continua no Flash primeiro (é onde a qualidade pesa). Resultado guardado em `clips_cache` (SHA-256 da transcrição + opções; `supabase/clips_cache.sql`, aplicado): mesma transcrição e opções devolvem na hora sem gastar cota; "Refazer sugestões" manda `fresh: true` e grava a análise nova.
  - Transcrição de arquivos (`/transcribe`): se a Groq responder 429/5xx, usa o mesmo modelo (`@cf/openai/whisper-large-v3-turbo`) na Cloudflare, cota grátis de cerca de 3,5 h/dia; se também falhar, o app já cai para a transcrição no aparelho (Whisper base). NÃO testado com fala real (sem acesso de rede ao Worker daqui).
  - Descartado: pedir ao Gemini o vídeo inteiro numa chamada só. Um vídeo de 1 h passa de 300 mil tokens mesmo em baixa resolução, acima do limite por minuto do plano grátis (250 mil); o fluxo em partes de 10 min com cache por trecho continua.
  - `sw.js` v210, `app.js?v=212`, `clips.js?v=6`.

- 15/11/2026 — Claude: Cortes do YouTube ganhou "Baixar corte (MP4)" em cada cartão, a pedido do dono (que assumiu o risco com as regras do YouTube; a tela não deve ter anúncios). `js/tabcap.js`: captura de aba do navegador (getDisplayMedia + Element Capture/`restrictTo`, reserva `cropTo`) grava em tempo real o mini player em tela cheia (vídeo, som da aba e legenda) num canvas 1080x1920 e gera MP4 com `js/recorder.js` (reserva: MediaRecorder). O usuário vê só a barra de progresso. Limites: só Chrome/Edge de computador (não existe no celular nem no Safari/Firefox); o navegador sempre pede permissão para compartilhar a guia, com áudio; a guia precisa ficar visível; leva o tempo do corte; nitidez depende da altura da janela. **Não testado**: o sandbox não inicia captura de aba nem acessa o YouTube; falta teste real do dono. `sw.js` v211.

- 15/11/2026 — Claude: Cortes do YouTube, transcrição mais rápida e enquadramento por momento.
  - **Velocidade**: medido em `yt_events`, cada bloco de 10 min levava ~45 s e os blocos iam um por vez (1 h de vídeo ≈ 4,5 min). Agora o bloco 0 vai sozinho (define os rótulos "Voz A/B") e os demais em paralelo, até 4 de uma vez (1 h ≈ 3 rodadas). A página repete sozinha quando o Worker responde "ocupada" (429) ou 502/503/504. "Tentar de novo" refaz só os blocos que faltam (`A.parts`).
  - **Worker `tacet-ai`** (versão `c2eda66d`, anterior `9ca4fa3c`; publicado pela API com `PUT .../content`, variáveis, segredos e cron mantidos): `/transcript` aceita `v: 2` e `who`; o prompt pede `x` por frase (posição horizontal, 0 a 100, do rosto de quem fala naquele quadro; `null` se não aparece) e `who` (descrição curta de cada voz, repassada aos outros blocos no lugar do `ctx`); amostra 1 quadro a cada 2 s (`videoMetadata.fps: 0.5`) e, nos modelos que não são Lite, `thinkingLevel: low`; se a API recusar (400) desce de variante e lembra a que funcionou (`YT_VAR`). Com `v: 2` o cache só serve blocos que já têm `x`; os antigos são refeitos e substituídos (`merge-duplicates`).
  - **Supabase**: coluna `transcript_cache.who jsonb` (migração `transcript_cache_who`, também em `supabase/transcripts.sql`).
  - **Enquadramento**: `shotsOf()` agrupa frases seguidas com o rosto no mesmo lugar em "planos" e o recorte muda só quando o plano muda (troca de câmera ou de pessoa), inclusive com uma pessoa só. Sem `x` (transcrição colada ou cache antigo) continua a posição fixa por pessoa. "Acompanhar quem fala" fica disponível e marcado sempre que há `x`.
  - Textos da página, do FAQ e de `ferramentas/legenda-do-youtube-pelo-link.html` deixaram de dizer que nada é gravado.
  - **Testado** só com Worker e YouTube simulados (390 e 1280 px, claro e escuro, sem erros no console): paralelismo, retomada e troca de recorte. **Não testado**: a resposta real do Gemini (se aceita `fps`, a qualidade do `x`, o tempo por bloco) e o limite por minuto com 4 blocos em paralelo. Conferir em `yt_events` e em `transcript_cache.segments` depois do primeiro uso real. `sw.js` v212, `app.js?v=213`.

## 16/11/2026 — Cortes do YouTube no celular + extras (sw v213)
- Pesquisa: getDisplayMedia não existe no Safari/Chrome do celular (caniuse/MDN), então o MP4 por captura de aba só sai no Chrome/Edge do computador. VDClip, Submagic e Captions baixam o vídeo nos servidores deles; isso NÃO foi implementado aqui (baixar o YouTube no servidor contorna a proteção do YouTube).
- Em qualquer aparelho: "Baixar legendas (.srt)" (tempo relativo ao início do corte, frases em linhas de até 8 palavras) e "Texto para publicar" (Worker /assist task=describe: título, descrição, hashtags; precisa de login) com "Copiar tudo".
- Sem captura de aba (celular): botão MP4 some; aparece "Enviar para o computador" (Web Share ou copia o link ?u=) e aviso explicando o motivo.
- Não testado em aparelho real; testado com Playwright (desktop 1280 e 390 com getDisplayMedia removido).

## 16/11/2026 — Cortes do YouTube virou recurso Pro (sw v214)
- Página cortes-youtube.html: `planOf()` (profiles.plan/pro_until + is_admin; respeita CFG.GATE) e `paywall()`; quem não é Pro vê o painel #pay e o formulário some. `ask()` envia `src:'yt'`.
- Worker tacet-ai (publicado pela API): /transcript exige Pro (402 code paid); /clips-v2 exige Pro só com `src:'yt'`; cortes com IA do editor (/clips-v2 sem src e rota antiga) ficaram grátis, com o limite diário LLM_DAILY_CALLS. Admin continua liberado.
- Textos: selo PRO na home, lista do plano, FAQ, ferramentas/cortes-com-ia, legenda-para-shorts e legenda-do-youtube-pelo-link.
- Download do YouTube em servidor (como clipto/ytdown/VDClip) NÃO foi implementado, por decisão do assistente: exige burlar a proteção do YouTube.

## 16/11/2026 — Cortes com IA (editor) e Teleprompter (sw v215, app.js v214)
- Cortes do YouTube: NÃO alterado nesta entrega.
- Tela "Cortes sugeridos" (#cuts): ordenar (nota / ordem do vídeo / mais curtos), nota mínima, "Gerar aprovados/todos" em fila (`cutsBatch`, usa `renderOne` um por vez, barra geral e Cancelar), "Baixar todos" (`cutsZipAll`: no celular abre a folha de compartilhamento com os MP4; no computador gera um .zip sem compressão via js/zip.js com MP4 + .srt + texto de publicação). Em cada cartão: Gerar/Baixar MP4, Legendas .srt (`cutSrt`, tempo relativo ao corte) e Texto para publicar (`cutPub`, guarda em `c.pub`).
- Limite conhecido: se "Remover silêncios" estiver ligado, o .srt do corte segue o tempo original e pode desalinhar do MP4 exportado.
- Teleprompter: removido o botão "Ativar câmera e microfone" (o pedido de permissão acontece em "Iniciar TP", dentro do toque). O cartão de câmera só aparece quando já está liberada (prévia + nível do microfone) ou bloqueada (botão "Como liberar"). Novos: contador de palavras e duração estimada, "Limpar", botão principal fixo no rodapé, largura máxima de 760 px no computador, foco visível.
- Testado com Playwright (390 e 1280, claro/escuro, câmera falsa). Não testado: fila de geração com vídeo real e teleprompter em iPhone real.

## 16/11/2026 — Indicação de amigos e avaliações (sw v216, app.js v215)
- Banco: supabase/social.sql (JÁ aplicado no projeto como migration `social_referrals_reviews`). Tabelas ref_codes, referrals, reviews (RLS ligado, sem policies; tudo por função).
- Indicação: link `https://forjaclip.com.br/?r=<código>`; app.js guarda o código em localStorage (`forjaclip.ref`) e chama `ref_claim` no primeiro login (só conta criada há até 7 dias e sem pagamento). Worker tacet-ai chama `ref_reward` depois do pagamento aprovado (1º pagamento do amigo → +7 dias para quem indicou, teto de 24 por 365 dias) e `ref_unreward` nos dois caminhos de reembolso. Cartão #inv na home (copiar, compartilhar, contador).
- Avaliações: diálogo #rev (1 a 5 estrelas, comentário até 600, nome exibido), `review_save` exige conta com projeto ou pagamento; editar volta para "pending". Convite automático depois do 2º vídeo gerado (no máximo 1 a cada 30 dias). Página inicial pública: #revPub via `reviews_public` (só aprovadas; some se não houver nenhuma). Moderação no Painel do criador ("Avaliações aguardando aprovação": Aprovar/Rejeitar) + totais de indicação.
- Termos: novo parágrafo "Indicações e avaliações".
- Não testado com contas reais: o prêmio no webhook do Mercado Pago e o fluxo completo de aprovação. Testado com Playwright e funções simuladas (390/1280, claro/escuro).

## 17/11/2026 — Cortes com IA não seguiam quem fala (sw v217, app.js v216)
- Causa: o formato padrão do editor era "Original do vídeo" (desde 24/10). Com vídeo 16:9 e saída 16:9, `needsCrop()` é falso e `frameCuts()` nunca roda; os cartões, porém, desenhavam sempre 9:16 do centro. Os cortes também saíam em 1920×1080 (ver app_errors 8 e 9).
- Correção: `enterEdit` usa 9:16 em projeto de cortes (`isCutsProj`) e "Original" só em "Legende seu vídeo"; escolha manual do formato fica em `S.style.ratioPick` e sempre vale. `setRatio` e o seletor de enquadramento reabrem a análise (`frameCuts`) e redesenham os cartões. Cartões seguem a proporção real (`--car`). Aviso `#cutsFmt` explica quando nada é recortado (formato igual ao vídeo ou "fundo desfocado"), com botão que resolve.
- Lote: se o navegador recolher o codificador ("Codec reclaimed due to inactivity", aba em segundo plano) ou o decodificador travar, espera a aba voltar e tenta o corte mais uma vez.
- Ligações novas (#revOpen, #cutsBar…) protegidas: página antiga em cache com app.js novo derrubava o app (app_errors 7, iPhone).
- Testado: speaker.js com vídeo sintético de duas câmeras lado a lado (achou as duas pessoas em x 0,21 e 0,79); aviso e troca de formato no Playwright 390/1280. Não testado com o vídeo real do usuário.
