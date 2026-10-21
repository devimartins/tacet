// B-roll: busca imagens de uso livre (CC0 / domínio público) no Openverse, sem chave e sem exigir crédito.
export async function findBroll(query) {
  const u = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(query) + '&license=cc0,pdm&page_size=8&mature=false&aspect_ratio=tall,square';
  const r = await fetch(u); if (!r.ok) return null; const j = await r.json();
  for (const x of (j.results || [])) {
    try { const b = await fetch(x.thumbnail, { mode: 'cors' }); if (!b.ok) continue; const img = await createImageBitmap(await b.blob()); if (img.width >= 300 && img.height >= 300) return img; } catch { /* tenta a próxima */ }
  }
  return null;
}
