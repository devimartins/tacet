// ===== COLE ANTES do bloco if (path === "/transcript") (fora de qualquer função, no nível do arquivo) =====
// Se o seu Worker já tem uma função que chama o Supabase com a chave de serviço (a mesma usada por use()/add_usage),
// troque o corpo de sb() para reaproveitá-la. Os nomes SUPABASE_URL e SUPABASE_SERVICE_KEY são os padrões — confira
// no painel (Settings > Variables) como os seus se chamam.
async function sb(env, path, init = {}) {
  const r = await fetch(env.SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "content-type": "application/json", ...(init.headers || {}) }
  });
  return r;
}
const ymUTC = () => new Date().toISOString().slice(0, 7);
// ===== fim =====

      if (path === "/transcript") {
        if (!env.GEMINI_KEY) return json(env, { error: "Transcrição automática ainda não está ativa." }, 503);
        const a = await req.json().catch(() => ({}));
        const m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(String(a.url || "").trim());
        if (!m) return json(env, { error: "Link do YouTube inválido." }, 400);
        const from = Math.max(0, Math.floor(Number(a.from) || 0)), len = Math.min(600, Math.max(5, Math.floor(Number(a.len) || 600)));
        const ctxT = typeof a.ctx === "string" ? a.ctx.replace(/\s+/g, " ").slice(-500) : "";
        if (from > 14400) return json(env, { error: "Vídeo longo demais." }, 413);
        const plan = adm ? "admin" : pl === "pro" ? "pro" : "free";
        const vid = m[1], mon = ymUTC();
        const logEv = (cached) => sb(env, "yt_events", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ user_id: uid, month: mon, plan, seconds: len, cached }) }).catch(() => {});
        // 1) Cache: já transcrito por alguém? Não gasta cota nem Gemini.
        try {
          const cr = await sb(env, `transcript_cache?video_id=eq.${vid}&from_s=eq.${from}&len_s=eq.${len}&select=segments,positions`);
          const row = cr.ok ? (await cr.json())[0] : null;
          if (row && Array.isArray(row.segments) && row.segments.length) {
            await Promise.all([logEv(true), sb(env, "rpc/hit_transcript", { method: "POST", body: JSON.stringify({ p_video: vid, p_from: from, p_len: len }) })]).catch(() => {});
            return json(env, { segments: row.segments, positions: row.positions || {}, cached: true });
          }
        } catch {}
        const capY = adm ? 1e9 : pl === "pro" ? num(env.PRO_DAILY_YT_SEC, 14400) : num(env.FREE_DAILY_YT_SEC, 3600);
        if (!await use(env, uid, "yt", len, capY)) return json(env, { error: "Você atingiu o limite diário de transcrição por link. Volte amanhã." }, 429);
        if (!await use(env, GLOBAL, "yt", len, num(env.GLOBAL_DAILY_YT_SEC, 27000))) {
          await use(env, uid, "yt", -len, capY);
          return json(env, { error: "O serviço gratuito atingiu o limite de hoje. Tente amanhã." }, 429);
        }
        // 2) Teto mensal por pessoa (além do diário). Pro: 40 h; grátis: 3 h; admin sem teto.
        const capM = adm ? 2e9 : pl === "pro" ? num(env.PRO_MONTHLY_YT_SEC, 144000) : num(env.FREE_MONTHLY_YT_SEC, 10800);
        const monOk = async (amt) => { const r = await sb(env, "rpc/add_yt_month", { method: "POST", body: JSON.stringify({ p_user: uid, p_month: mon, p_sec: amt, p_cap: capM }) }); return r.ok ? (await r.json()) === true : true; };
        if (!await monOk(len)) {
          await use(env, uid, "yt", -len, capY); await use(env, GLOBAL, "yt", -len, 1e9);
          return json(env, { error: pl === "pro" ? "Você atingiu o limite mensal de transcrição do plano Pro. Ele renova no próximo mês." : "Você atingiu o limite mensal de transcrição do plano grátis. Assine o Pro para transcrever mais." }, 429);
        }
        const undoY = async () => { await use(env, uid, "yt", -len, capY); await use(env, GLOBAL, "yt", -len, 1e9); await monOk(-len); };
        const TP = 'Transcribe the speech of this video segment exactly as spoken, in the original language. Return only JSON {"segments":[{"t":"MM:SS","text":"..."}],"positions":{"<speaker label>":0}}. Rules: one segment per sentence (or per short phrase), each starting exactly where that sentence begins; t is the start time counted from the beginning of this segment (00:00); text is the verbatim speech with punctuation and normal capitalization; never summarize or translate; when more than one person speaks, begin the text with a short label and a colon, "Voz A:" and "Voz B:", using the same label for the same person throughout; with a single speaker add no label; ignore music and sound effects. positions: for each label you used (use "solo" for a single speaker), the horizontal position of that person in the video frame as a number from 0 (left edge) to 100 (right edge), where that person usually appears while speaking; omit the person if not visible. If there is no speech return {"segments":[],"positions":{}}.' + (ctxT ? ' Context from the end of the previous part of the video; keep the same speaker labels for the same people: ' + ctxT : "");
        let g = null;
        // Gemini às vezes responde 503 (sobrecarga) ou 429: tenta de novo e, se continuar, usa um modelo alternativo.
        const models = [...new Set([env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash-lite"])];
        outer: for (const model of models) {
          for (let att = 0; att < 3; att++) {
            for (const low of [true, false]) {
              g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: "POST",
                headers: { "x-goog-api-key": env.GEMINI_KEY, "content-type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ fileData: { fileUri: "https://www.youtube.com/watch?v=" + m[1] }, videoMetadata: { startOffset: from + "s", endOffset: from + len + "s" } }, { text: TP }] }],
                  generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 16000, ...low ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {} }
                })
              });
              if (g.status !== 400) break;
            }
            if (g.ok || ![429, 500, 502, 503, 504].includes(g.status)) break outer;
            await new Promise(r => setTimeout(r, 1500 * (att + 1)));
          }
        }
        if (!g.ok) {
          await undoY();
          const em = (await g.text()).slice(0, 160);
          return json(env, { error: g.status === 429 ? "A transcrição automática está ocupada. Tente de novo em instantes." : /private|unlisted|not.*public|permission/i.test(em) ? "O vídeo precisa ser público (não privado nem não listado)." : (g.status === 503 || g.status >= 500 ? "O serviço de transcrição do Google está sobrecarregado agora. Toque em Tentar de novo em instantes." : "Falha na transcrição automática (" + g.status + ").") }, g.status === 429 ? 429 : 502);
        }
        let segs = [], posn = {};
        try {
          const o = JSON.parse((await g.json()).candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          if (Array.isArray(o.segments)) segs = o.segments;
          if (o.positions && typeof o.positions === "object") for (const [pk, pv] of Object.entries(o.positions).slice(0, 6)) { const pn = Number(pv); if (Number.isFinite(pn)) posn[String(pk).replace(/:$/, "").slice(0, 30)] = Math.max(0, Math.min(100, Math.round(pn))); }
        } catch {
        }
        const toS = (t) => String(t).split(":").map(Number).reduce((x, y) => x * 60 + (y || 0), 0);
        const out = segs.map((x) => ({ s: from + toS(x.t), text: String(x.text || "").trim().slice(0, 600) })).filter((x) => Number.isFinite(x.s) && x.s < from + len + 5 && x.text).slice(0, 400);
        if (!out.length) { await undoY(); return json(env, { segments: out, positions: posn }); }
        // 3) Guarda no cache e registra o custo real.
        await Promise.all([
          sb(env, "transcript_cache", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ video_id: vid, from_s: from, len_s: len, segments: out, positions: posn, model: env.GEMINI_MODEL || "gemini-2.5-flash" }) }),
          logEv(false)
        ]).catch(() => {});
        return json(env, { segments: out, positions: posn });
      }
