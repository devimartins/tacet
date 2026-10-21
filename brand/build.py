#!/usr/bin/env python3
"""Gera a identidade visual do ForjaClip: marca, logotipos, favicon, ícones PWA e imagem de compartilhamento.
Uso: python3 brand/build.py   (precisa de fonttools, Playwright/Chromium e a fonte Poppins instalada)"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = '/usr/share/fonts/truetype/google-fonts/'
EMBER = ['#FFC53D', '#FF6A1F', '#E5322D']   # topo -> centro -> base da chama
INK_DARK, INK_LIGHT, CREAM = '#17100D', '#1D1410', '#FFF1DE'

FLAME = 'M33 3C35 14 49 20 49 37C49 49 42 60 32 60C22 60 15 51 15 40C15 31 20 25 24 19C25 24 27 27 30 28C28 19 29 10 33 3Z'
PLAY = 'M27.5 36L41 44L27.5 52Z'

def grad(id_, x2='0.35'):
    return f'<linearGradient id="{id_}" x1="0" y1="0" x2="{x2}" y2="1"><stop offset="0" stop-color="{EMBER[0]}"/><stop offset=".45" stop-color="{EMBER[1]}"/><stop offset="1" stop-color="{EMBER[2]}"/></linearGradient>'

def mark_inner(gid, mid, fill=None):
    """Chama com o play recortado (um só vetor: funciona em uma cor e em qualquer fundo)."""
    f = fill or f'url(#{gid})'
    return (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/>'
            f'<path d="{PLAY}" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round"/></mask>'
            f'<path d="{FLAME}" fill="{f}" mask="url(#{mid})"/>')

def text_path(fontfile, text, size, tracking=0.0):
    font = TTFont(FONTS + fontfile); gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm; s = size / upm
    x = 0; ds = []
    for ch in text:
        gn = cmap[ord(ch)]; pen = SVGPathPen(gs); tp = TransformPen(pen, (s, 0, 0, -s, x, 0)); gs[gn].draw(tp)
        ds.append(pen.getCommands()); x += gs[gn].width * s + tracking * size
    return ' '.join(ds), x - tracking * size

def wordmark(size=40):
    d1, w1 = text_path('Poppins-Bold.ttf', 'Forja', size, -0.01)
    d2, w2 = text_path('Poppins-Medium.ttf', 'Clip', size, -0.01)
    return d1, w1, d2, w2, size

def logo_svg(ink, gid='g1', mid='m1', inline=False):
    """Logotipo horizontal: chama (alinhada pela base ao texto) + Forja (Poppins Bold) + Clip (Poppins Medium, gradiente)."""
    d1, w1, d2, w2, size = wordmark(40)
    k = 0.79; flame_l, flame_r = 15 * k, 49 * k      # chama recortada ao seu contorno
    mx = -(flame_l - 2); tx = (flame_r - flame_l) + 2 + 11
    base = 42
    total = tx + w1 + 2 + w2 + 2
    body = (f'<defs>{grad(gid)}{grad(gid+"t","0.8")}</defs><g transform="translate({mx},0) scale({k})">{mark_inner(gid, mid)}</g>'
            f'<path transform="translate({tx},{base})" d="{d1}" fill="{ink}"/>'
            f'<path transform="translate({tx + w1 + 2},{base})" d="{d2}" fill="url(#{gid}t)"/>')
    return total, 52, body

def write(path, s):
    with open(os.path.join(ROOT, path), 'w') as f: f.write(s)

def svg(w, h, body, vb=None, extra=''):
    vb = vb or f'0 0 {w} {h}'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" {extra}>{body}</svg>\n'

# marca isolada (gradiente) e monocromática
write('brand/mark.svg', svg(64, 64, f'<defs>{grad("g")}</defs>{mark_inner("g","m")}'))
write('brand/mark-mono.svg', svg(64, 64, mark_inner('x', 'm', fill='#111')))
write('favicon.svg', svg(64, 64, f'<defs>{grad("g")}</defs>{mark_inner("g","m")}'))
# logotipos horizontais para fundo escuro e claro
for name, ink in (('logo-on-dark', '#F4EDE6'), ('logo-on-light', INK_LIGHT)):
    w, h, body = logo_svg(ink, gid='g'+name[-4:], mid='m'+name[-4:])
    write(f'brand/{name}.svg', svg(round(w, 1), h, body))
# versão inline com currentColor (usada na interface, serve aos dois temas)
w, h, body = logo_svg('currentColor', gid='gl', mid='ml')
write('brand/logo-inline.svg.txt', svg(round(w, 1), h, body, extra='class="wm" role="img" aria-label="ForjaClip"'))

# PNGs via Chromium
from playwright.sync_api import sync_playwright
def icon_html(size, bg, scale, radius=0):
    pad = size * (1 - scale) / 2
    return (f'<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<defs>{grad("g")}<radialGradient id="r" cx=".5" cy=".62" r=".6"><stop offset="0" stop-color="#3A1A0C"/><stop offset="1" stop-color="{bg}"/></radialGradient></defs>'
            f'<rect width="{size}" height="{size}" rx="{radius}" fill="url(#r)"/>'
            f'<g transform="translate({pad},{pad + size*0.01}) scale({size*scale/64})">{mark_inner("g","m")}</g></svg></body></html>')
OG = lambda body_logo, lw: f'''<html><body style="margin:0;width:1200px;height:630px;background:radial-gradient(900px 520px at 85% 0%,rgba(255,106,31,.34),transparent 60%),radial-gradient(700px 420px at 0% 100%,rgba(229,50,45,.22),transparent 60%),#100A08;font-family:Inter,Poppins,sans-serif;color:#F4EDE6;position:relative;overflow:hidden">
<div style="position:absolute;left:84px;top:110px">{body_logo}</div>
<div style="position:absolute;left:84px;top:330px;width:1010px;font-size:54px;line-height:1.12;font-weight:700;letter-spacing:-.02em">Cortes virais e legendas animadas, direto do seu navegador.</div>
<div style="position:absolute;left:84px;top:490px;font-size:28px;color:#C9B8AA">Para Reels, TikTok e Shorts. Seu vídeo não sai do seu aparelho.</div></body></html>'''
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium'); pg = b.new_page()
    def shot(html, path, w, h, omit=False):
        pg.set_viewport_size({'width': w, 'height': h}); pg.set_content(html); pg.wait_for_timeout(150)
        pg.screenshot(path=os.path.join(ROOT, path), omit_background=omit)
    shot(icon_html(512, '#120B08', 0.70), 'icon-512.png', 512, 512)
    shot(icon_html(192, '#120B08', 0.70), 'icon-192.png', 192, 192)
    shot(icon_html(180, '#120B08', 0.72), 'apple-touch-icon.png', 180, 180)
    lw, lh, lbody = logo_svg('#F4EDE6', gid='go', mid='mo')
    big = svg(round(lw*3.2), round(lh*3.2), lbody, vb=f'0 0 {round(lw,1)} {lh}')
    shot(OG(big, lw), 'og-image.png', 1200, 630)
    b.close()
print('ok')
