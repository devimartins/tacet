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
- Pode fazer sem pedir aprovação e avisar ao terminar ("todas as etapas estão aprovadas"). A regra de PR em `AGENTS.md` vale para o Codex; o dono autorizou o Claude a publicar direto quando pede mudança.

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

## ⏸ Coordenação Claude ↔ Codex pausada (26/10/2026)
O dono pausou a troca entre Claude e Codex pelo GitHub (comentários nos PRs #2, #3 e #9 e tarefas neste arquivo). Até o dono retomar: não responder nem abrir PRs, comentários ou tarefas um para o outro. Os PRs abertos ficam como estão, sem merge nem fechamento.

## Tarefa do Codex: sistema novo
- O que é o sistema: _(preencher com o dono)_
- Onde entra no app (site ou Worker): _(preencher)_
- Arquivos que o Codex pode criar ou alterar: _(preencher)_
- Branch de trabalho: `codex/<assunto>`; abrir pull request para a `main`.

## Registro
- 24/10/2026 — Claude: criou `AGENTS.md` e este arquivo.

- 24/10/2026 — Claude: formato original do vídeo como padrão no editor (seletor sempre visível); botões "?" de ajuda (`js/help.js`); renomeados Início, Cortes com IA, Cortes do YouTube, Reduzir player, Cortar pausas das pontas; tour só na tela certa; vídeo de cada projeto guardado no aparelho (3 mais recentes); textos do login atualizados. Leu o PR #2 do Codex (ainda sem integração).

- 24/10/2026 — Claude: botões "?" redondos (24 px; 30 px no toque); controle de volume e atalho "Editar legendas" dentro do player do editor (`#stCtl`) e em cada card de `cortes-youtube.html` (volume único, lembrado em `forjaclip.vol`; botão de mudo também em tela cheia; lápis no card abre a edição). Testado no navegador (390, 820 e 1280 px). PR `claude/volume-legendas`: `sw.js` v160, `app.js?v=175`. O PR #3 (captura) precisa de merge da main e novo aumento de versão depois deste.

- 24/10/2026 — Claude: PR #4 mesclado. Som de forja (arquivo do dono) toca ao concluir a exportação: `sounds/forja.m4a` (AAC, para Safari/iPhone) e `sounds/forja.webm` (original, reserva); liberado no clique em "Gerar" (`unlockForja`), usa a opção "Som de forja ao concluir a exportação" (antes "Aviso sonoro"); se o áudio falhar, toca os dois tons antigos. Branch `claude/som-forja`: `sw.js` v161, `app.js?v=176`. Testado: os dois arquivos carregam e tocam no navegador; o disparo no fim de uma exportação real não foi testado aqui (sem vídeo/transcrição no sandbox).

- 25/10/2026 — Claude: SEO para busca de legendas. Novas páginas estáticas no Design System (`css/conteudo.css`): hub `/ferramentas/`, 9 ferramentas (gerador de legendas, Reels, TikTok, Shorts, YouTube pelo link, SRT/VTT, cortes com IA, remover silêncio, traduzir legenda) e 4 comparações em `/comparar/` (Submagic, Captions, Descript, VEED), cada uma com dados estruturados (WebPage, BreadcrumbList, SoftwareApplication, FAQPage). Guias migrados para o mesmo CSS e ligados às ferramentas; sitemap com 22 URLs; título e descrição da página inicial focados em "legenda automática" e bloco de links de ferramentas no fim da landing. Páginas de ferramenta sem script do AdSense (só a meta da conta), para carregar rápido. Comparações não citam preço de concorrente; mandam conferir o site oficial. Branch `claude/seo-ferramentas`: `sw.js` v171, `app.js?v=174`. Testado em 390 e 1280 px, claro e escuro, sem rolagem horizontal e sem links quebrados (fontes externas bloqueadas no sandbox). Pendências do dono: enviar o sitemap no Google Search Console, pedir indexação das páginas novas e buscar backlinks (listas de "melhores geradores de legenda", Product Hunt, diretórios de IA).

- 25/10/2026 — Claude: meta de verificação do Google Search Console no `index.html` (propriedade por prefixo de URL). `sw.js` v172, `app.js?v=175`.

- 26/10/2026 — Claude: coordenação com o Codex pelo GitHub pausada a pedido do dono (aviso no topo deste arquivo e nos PRs #2 e #9).

- 26/10/2026 — Claude: rodapé da landing redesenhado; botão "Adicionar texto" (texto livre fixo, com fonte/cor/fundo/tamanho/posição); atalhos Texto e Cor na barra do editor; transcrição por link com retry automático (502/503/504) na página e retry + modelo alternativo (`gemini-2.5-flash-lite`) em `docs/worker-transcript-cache.js` (copiar para o Worker e fazer deploy). `sw.js` v175.
