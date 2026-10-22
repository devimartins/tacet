# ForjaClip — Design System v1

Base: `index.html` (bloco `:root` e a camada "design system v1" no fim do `<style>`), `config.js` não participa.
Regra de ouro: **o fogo é acento, não pano de fundo.** Laranja só em CTA, progresso, seleção, foco e detalhes de brilho.

## 1. Conceito
Matéria-prima (vídeo longo) → calor (IA) → forja (seleção e edição) → resultado (corte vertical com legenda animada).
Três atributos: **potência, precisão, transformação**. Tom: software profissional de edição, escuro e limpo; nada de chamas literais em excesso, ferrugem, fumaça pesada ou martelos.

Linguagem gráfica própria: metal aquecido em degradê (carvão → aço → brasa), pontos de luz (brasas), reflexo quente só no contorno inferior de itens selecionados, linhas finas de estrutura, nebulosa escura de fundo (shader).

## 2. Cores e tokens semânticos

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0F0E0D` | `#FBF6F1` | fundo da página |
| `--s1` (surface) | `#181615` | `#FFFCF9` | painéis, cartões |
| `--in` (surface elevada) | `#211E1C` | `#FFFFFF` | campos, menus, popovers |
| `--bd` (border) | `#332E2B` | `#EADCCF` | bordas e divisórias |
| `--tx` | `#F4F2EF` | `#1D1410` | texto principal |
| `--mut` | `#A6A09B` | `#6F5E52` | texto secundário |
| `--ac` (primary/accent) | `#FF6A24` | `#C2410C` | acento, foco, seleção |
| `--amber` | `#FFB547` | `#B45309` | fim do degradê, avisos quentes |
| `--ember` | `#D94327` | `#B3261E` | brasa/vermelho, perigo suave |
| `--ok` | `#4ADE80` | `#15803D` | sucesso |
| `--warn` | `#FFB547` | `#B45309` | aviso |
| `--er` | `#FF8A80` | `#B3261E` | erro |
| `--focus` | `#FF6A24` | `#C2410C` | anel de foco (2px + 2px de respiro) |

Gradiente incandescente `--grad`: `135deg, #FF6A24 → #FFB547`. Usar em: botão primário, barra de progresso, destaque do título, borda do plano Pro. **Não** usar em fundos de seção nem em vários elementos lado a lado.

Contraste verificado (alvo WCAG AA): texto `#F4F2EF` sobre `#0F0E0D` ≈ 17:1; `--mut` ≈ 7:1; acento `#FF6A24` sobre `#0F0E0D` ≈ 7:1; texto escuro `#1A0A02` sobre o degradê do botão ≥ 8:1.

## 3. Tipografia
- **Títulos (display):** Space Grotesk 500/600/700, `letter-spacing -.03em`, `line-height 1.02–1.1`.
- **Interface e corpo:** Geist 400/500/600 (família já usada; equivalente funcional ao Inter), 15 px/1.55.
- **Números técnicos** (tempo, contadores, preços pequenos): Geist Mono 400/500 com `font-variant-numeric: tabular-nums`.
- Escala (fluida): Display `clamp(38px, 6.4vw, 84px)` · H1 `clamp(34px, 5vw, 56px)` · H2 eyebrow 12 px/.14em caixa alta · Título de cartão 22 px · Corpo 15 px · Pequeno 13 px · Micro 11 px.
- Pesos: títulos 600–650, interface 500, corpo 400. Evitar itálico fora da palavra de destaque do título.

## 4. Espaçamento, bordas e sombras
- Escala de 4 px: `--sp-1…--sp-16` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Padding: cartão 20–24 px, painel lateral 18–22 px, modal 24–32 px. Distância entre grupos de controles 12–16 px; entre seções 40–64 px.
- Largura máxima do conteúdo 1120 px (1040 px em telas menores); margens laterais 16 px (celular), 32–40 px (desktop).
- Raios: `--r-sm 8` (campos, chips pequenos) · `--r-md 12` (botões, cartões compactos) · `--r-lg 16` (cartões) · `--r-xl 24` (cartão de vidro, modal) · `--r-pill 999` (pílulas, CTAs de landing).
- Elevação: `--sh1` contato (1 px) · `--sh2` cartão em hover · `--sh3` modal/flutuante. Brilho `--glow` só em selecionado/primário, sempre baixo (≤ 40 px de blur, ≤ 45% de opacidade). Sem sombras coloridas em volume.

## 5. Componentes e estados
- **Botão primário:** degradê incandescente, texto `#1A0A02`, borda 1 px branca a 35%, brilho leve; hover sobe 1–2 px e aumenta o brilho; active desce 1 px; disabled 45% de opacidade, sem brilho; loading troca o texto por "…" e mostra a barra incandescente.
- **Secundário:** superfície `--in`, borda `--bd`; hover borda `--mut`. **Terciário/fantasma:** só texto, hover com fundo `--rail-hv`.
- **Cartões/painéis:** `--s1`, borda `--bd`, raio 16; selecionado: borda `--ac` + reflexo quente no contorno inferior.
- **Cartão de vidro (flutuante):** fundo translúcido 55–60%, `backdrop-filter: blur(22px) saturate(1.4)`, borda branca a 14%, brilho interno superior. Usar em: vídeo flutuante no mobile, selos, faixa de recursos.
- **Campos e seletores:** `--in`, borda `--bd`, altura mín. 44 px; foco: borda `--ac` + anel `--ring`; erro: borda `--er` + texto (nunca só cor).
- **Navegação:** trilho lateral (desktop) e barra inferior (mobile); item atual com fundo `--rail-on`. **Abas:** pílulas segmentadas; selecionada em superfície elevada com sombra `--sh1`.
- **Modais/popovers:** `--in`, raio 24, `--sh3`, fundo desfocado, entrada `pop` 180 ms.
- **Progresso:** barra incandescente (degradê `#FFB547 → #FF6A24`, brilho de 12–14 px) tanto no claro quanto no escuro; botão da barra de tempo com brilho quente.
- **Timeline/ferramentas do editor:** faixas em `--s1`, cabeça de reprodução `--ac`, cortes em âmbar, controles a 36–44 px de altura.
- **Avisos:** toast em `--in` com ícone e texto; mensagens de erro sempre com texto explicativo e, quando possível, a ação para resolver.

## 6. Movimento
Curva única `--ease: cubic-bezier(.2,.7,.2,1)`. Durações: micro 120–150 ms (botão, hover), padrão 250 ms (estado/cartão), entrada 600–800 ms (conteúdo).
- Entrada: fade + deslocamento vertical de 16–24 px, **stagger 60–100 ms** entre elementos relacionados.
- Títulos podem revelar palavra por palavra; frases-chave acendem conforme a rolagem (cinza → branco).
- Fundo: nebulosa em shader lenta, parallax e brasas reagem à rolagem.
- Preferir CSS; JS só para efeitos que o CSS não faz (brilho que segue o cursor, brasas, rolagem). Sem bibliotecas.
- `prefers-reduced-motion`: sem animações de entrada, sem parallax, sem brasas, sem marquee. Aparelhos fracos (≤ 2 núcleos, ≤ 2 GB, economia de dados): classe `still` desliga shader e animações contínuas.

## 7. Acessibilidade
- Contraste AA em todo texto; estados nunca só por cor (ícone, texto, borda).
- Foco visível em tudo: anel de 2 px + 2 px de respiro, nunca removido.
- Alvos de toque ≥ 44 px; navegação completa por teclado; `aria-label` em botões só com ícone.
- Texto sobre nebulosa sempre com contraste ≥ AA (o shader é mantido escuro nas áreas de texto).

## 8. Tokens CSS (implementados em `index.html`)
Variáveis: `--bg --s1 --in --bd --tx --mut --ac --amber --ember --ok --warn --er --focus --grad --glow --ring`, espaçamento `--sp-*`, raios `--r-*`, sombras `--sh1 --sh2 --sh3`, movimento `--ease --dur-1 --dur-2 --dur-3`, tipografia `--font-display --font-ui --font-mono`. Nomes antigos (`--ac`, `--s1`, `--in`, `--bd`, `--tx`, `--mut`) foram **mantidos**, então nada do app existente quebra.

## 9. Referências que inspiraram (técnicas, não cópia)
midu.design (rolagem que acende texto, brilho granulado inferior), creativeartist.at (grade 2×2 com cartão destacado, selo + título centralizado), e as imagens Velocity, Mufi, Social Voice, opnr, Arounda (vidro escuro, brilho só no contorno, palavra de destaque em degradê, plano central elevado).
