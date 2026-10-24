# Handoff entre agentes

Atualize este arquivo ao terminar cada sessão. Nunca escreva valores de chaves, só os nomes.

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
