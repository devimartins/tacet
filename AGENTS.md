# ForjaClip — instruções para agentes (Codex, Claude e outros)

Leia também `docs/HANDOFF.md` (estado atual, decisões e tarefas de cada agente) antes de começar e atualize-o ao terminar.

## O projeto
- App web estático (PWA), sem etapa de build: HTML, CSS e JavaScript em módulos ES. Site: https://forjaclip.com.br
- Hospedagem: GitHub Pages, branch `main` (arquivo `CNAME`). Todo commit na `main` vai ao ar sozinho.
- Login e dados: Supabase (SQL em `supabase/`). IA, transcrição e pagamentos: Cloudflare Worker `tacet-ai`, **fora deste repositório** (editado no painel do Cloudflare).
- Páginas: `index.html` (app), `cortes-youtube.html` (trechos de um vídeo do YouTube), `guias/`, `termos.html`, `privacidade.html`, `direitos-autorais.html`.

## Regras
1. **Nunca** coloque senhas, tokens ou chaves secretas no código, em commits, issues ou PRs. Só valores públicos ficam em `config.js` (chave anon do Supabase, id do AdSense, site key do Turnstile). Chaves secretas são secrets do Worker e do Supabase.
2. **Não publique direto na `main`.** Trabalhe em um branch (`codex/<assunto>`) e abra um pull request. O dono revisa antes de ir ao ar.
3. Visual novo (páginas e funções) segue `brand/DESIGN-SYSTEM.md`: tokens de cor, tipografia, alvos de toque de 44 px, movimento reduzido e erros sempre com texto.
4. Toda mudança que vai ao ar aumenta o número do cache em `sw.js` (`forjaclip-vN`) e a versão em `js/app.js?v=N` no `index.html`. Leia o valor atual antes de aumentar. Ao importar um módulo alterado, atualize o `?v=` do import.
5. Mantenha o app estático e leve: sem bundler, sem dependência nova sem necessidade. Bibliotecas externas ficam em `vendor/`.
6. Textos para o usuário em português do Brasil, claros e curtos.

## Divisão de áreas (evita conflito de arquivos)
- Claude: páginas e funções já existentes (`index.html`, `cortes-youtube.html`, `js/clips.js`, `js/captions.js`, `js/app.js`).
- Codex: o sistema novo e o que for criado para ele (veja `docs/HANDOFF.md`). Para mexer em arquivo da área do outro, combine antes no handoff.

## Como testar
Não há suíte de testes. Rode `python3 -m http.server 8000` na raiz e abra `http://localhost:8000`. Confira no navegador, em 390 px de largura (celular) e em 1280 px (computador), sem erros no console.
