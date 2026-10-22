// B-roll: busca imagens de uso livre (CC0 / domínio público) no Openverse, sem chave e sem exigir crédito.
const usedImg = new Set();
const STOP = new Set(['a','an','the','of','in','on','at','and','with','for','to','person','people','photo','image']);
const tok = t => String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
// Só aceita imagem cujo título/etiquetas realmente tenham a ver com a busca (evita B-roll "solto" sem relação com a fala).
export async function findBroll(query) {
  const q = tok(query); if (!q.length) return null;
  const u = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(query) + '&license=cc0,pdm&page_size=20&mature=false&aspect_ratio=tall,square';
  const r = await fetch(u); if (!r.ok) return null; const j = await r.json();
  const sc = x => { const h = new Set(tok((x.title || '') + ' ' + (x.tags || []).map(t => t.name).join(' '))); return q.filter(w => h.has(w) || [...h].some(y => y.startsWith(w) || w.startsWith(y))).length / q.length; };
  const list = (j.results || []).map(x => ({ x, s: sc(x) })).filter(o => o.s >= (q.length > 1 ? 0.5 : 1) && !usedImg.has(o.x.id)).sort((a, b) => b.s - a.s);
  for (const { x } of list.slice(0, 6)) {
    try { const b = await fetch(x.thumbnail, { mode: 'cors' }); if (!b.ok) continue; const img = await createImageBitmap(await b.blob()); if (img.width >= 300 && img.height >= 300) { usedImg.add(x.id); return img; } } catch { /* tenta a próxima */ }
  }
  return null;
}
