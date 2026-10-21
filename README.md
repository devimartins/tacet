# ForjaClip — cortes virais direto no navegador (custo zero)

PWA (Android, iOS, Windows). O vídeo **nunca sobe para um servidor**: áudio, legendas e exportação rodam no aparelho (WebCodecs).

## Arquitetura (tudo no plano gratuito, sem cartão)
- **web/** — site estático (GitHub Pages / Cloudflare Pages / Netlify).
- **worker/** — Cloudflare Worker: proxy do Groq (Whisper + Llama) com limites por usuário e globais. A chave do Groq fica só aqui.
- **supabase/schema.sql** — login social, perfis, projetos (texto, cortes, estilo) e controle de uso, com RLS.
- **legacy-server/** — versão antiga com FFmpeg em servidor, para quando houver orçamento.

## Política dos 3 dias
O vídeo fica no aparelho. A conta guarda o projeto (transcrição, cortes, estilo) por 3 dias (`expires_at`). Para reabrir, escolha o mesmo arquivo de novo. Limpeza opcional com pg_cron (comentada no schema).

## Publicar
1. Supabase: crie o projeto, rode `supabase/schema.sql`, ative Google/GitHub/Azure (Microsoft) em Authentication > Providers, e coloque a URL do site em Redirect URLs. **Apple** exige conta Apple Developer paga; deixe desativado até ter receita.
2. Groq: crie uma chave gratuita.
3. Worker: `cd worker && npx wrangler secret put GROQ_KEY SUPABASE_SERVICE` (e demais variáveis do `wrangler.toml`), depois `npx wrangler deploy`. Defina `ALLOWED_ORIGIN` com o endereço do site.
4. Edite `web/config.js` (`AI`, `SB_URL`, `SB_ANON`; `GATE:true` para bloquear estilos e IA do plano pago; `ADS_CLIENT`/`ADS_SLOT` do AdSense).
5. Publique a pasta `web/`.
Sem `config.js` preenchido o app abre em modo demonstração.

## O que funciona
Upload até 350 MB no grátis e 1 GB no Pro (MP4/MOV), transcrição automática (no aparelho ou via Worker + Groq) e editável, sugestão de cortes por IA, remoção de silêncios e vícios de fala, zoom automático, linha do tempo, 12 estilos de legenda, 14 fontes livres, título de gancho e imagens sobre o vídeo, música de fundo mixada na exportação, áudios extras posicionáveis, redução de ruído, emojis e efeitos sonoros, tradução das legendas por IA, descrição com hashtags, B-roll automático (imagens CC0 do Openverse), logo da marca, assistente de ajuda, link do YouTube (grava o trecho do player oficial, só Chrome/Edge no computador), login com GitHub, projetos por 3 dias, exportação MP4 em 9:16, 4:5, 1:1 e 16:9, tema claro/escuro, fundo animado leve, SEO e consentimento LGPD para anúncios.

## Pagamento (Mercado Pago, Checkout Pro)
R$ 19,90 por mês nas 3 primeiras cobranças aprovadas e R$ 29,90 depois (`PRICE_INTRO`, `PRICE_FULL`, `INTRO_MONTHS`). Plano anual: R$ 199 por 366 dias (`PRICE_YEAR`; a referência do pagamento termina em `:y` e o webhook confere o valor pago). O Worker calcula o preço pelo histórico da tabela `payments`, cria a preferência em `/checkout` e confirma o pagamento pelo webhook `/webhook` consultando a API do Mercado Pago. Cada pagamento aprovado soma 31 dias em `profiles.pro_until`. Para ativar: secret `MP_TOKEN` no Worker e `PAY: true` em `config.js`.

## Ainda não feito
Vídeo (não só imagem) como B-roll e clipes de vídeo na linha do tempo, login Google/Microsoft/Apple (precisam de apps criados por você), correção automática de erros por IA, bloqueio de recursos Pro (`GATE`, mantido desligado até validar o pagamento), IDs do AdSense.

## Não validado
Fluxo de pagamento real (mensal e anual), B-roll, redução de ruído e áudios extras com vídeo real, codificação H.264/HEVC em aparelhos reais, arquivo de 1 GB no iPhone, pico de memória no iOS.
