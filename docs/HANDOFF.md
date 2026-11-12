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
