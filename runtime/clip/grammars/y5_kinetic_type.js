CLIPS.y5_kinetic_type = (() => {
const { clamp, lerp } = U;
const PAL = [['#FFD23F', '#111111'], ['#FF5A36', '#FFFFFF'], ['#14213D', '#FFD23F'], ['#F4EFE6', '#111111']];
let pages, LIST, BG, TR, PH, PHA, GRAIN;
const accentOf = col => col[0] === '#FFD23F' || col[0] === '#F4EFE6' || col[1] === '#FFD23F' ? '#FF5A36' : '#FFD23F';
return {
  fonts: ['PuHui-Black', 'PuHui-Heavy', 'PuHui-Bold'],
  faces: ['PuHui-Black', 'PuHui-Heavy', 'PuHui-Bold'],
  safe: true, box: true,
  // framehand: one scene per page (a number page starts 0.7 s before it lands) plus the highlight; regions per page: word / sub / label
  scenes: ctx => CLIP.beats(ctx.cues, q => q.kind === 'title' ? 'title' : q.kind === 'point' ? 'item' : q.kind === 'number' ? 'number' : q.kind === 'highlight' ? 'highlight' : null)
    .map((s, i, a) => s.id.startsWith('number') ? { ...s, at: s.at - 0.7 } : s),
  regions: ctx => [...ctx.of('title', 'point', 'number').flatMap((q, i) => [{ id: CLIP.rid('word', i), label: `Page ${i + 1} word` },
      ...(q.sub ? [{ id: CLIP.rid('sub', i), label: `Page ${i + 1} line` }] : []), ...(q.data && q.data.label ? [{ id: CLIP.rid('label', i), label: `Page ${i + 1} label` }] : [])]),
    ...(ctx.of('point').length >= 2 ? [{ id: 'track', label: 'Progress track' }] : []), ...(ctx.of('highlight').length ? [{ id: 'marker', label: 'Highlighter' }] : [])],
  init(ctx) {
    const { u } = ctx, W = ctx.portrait ? ctx.box.w / 0.93 : ctx.W, pal = ctx.data.palette || PAL, g = document.createElement('canvas').getContext('2d');
    const d = ctx.data; BG = d.bg || 'dots'; TR = d.transition || 'wipe'; PH = d.image && ctx.IMG[d.image] || null; PHA = d.imageAlpha ?? 0.74;
    pages = ctx.of('title', 'point', 'number').map((q, i) => {
      const num = q.kind === 'number', nd = q.data || {};
      const text = num ? (nd.prefix || '') + TY.fmt(nd.value || 0, nd.decimals ?? 0) + (nd.suffix || '') : (q.text || '');
      const S0 = (ctx.portrait ? 250 : 300) * u;
      let f = TY.fit(g, text, W * 0.86, S0, 'PuHui-Black', { maxLines: 1, min: 0.55, soft: true });
      if (!f.ok) f = num ? TY.fit(g, text, W * 0.86, S0, 'PuHui-Black', { maxLines: 1 })
                     : TY.fit(g, text, W * 0.86, S0, 'PuHui-Black', { maxLines: 2, min: 0.3, balance: true });
      const sf = q.sub ? TY.fit(g, q.sub, W * 0.86, (ctx.portrait ? 64 : 80) * u, 'PuHui-Heavy', { maxLines: 2, min: 0.6, balance: true }) : null;
      const show = num ? q.at - 0.7 : q.at;
      return { q, i, num, nd, text, f, sf, show, col: pal[i % pal.length] };
    });
    const pts = pages.filter(p => p.q.kind === 'point'); pts.forEach((p, k) => { p.ord = k + 1; });
    LIST = pts.length >= 2 ? pts : null;
    for (const h of ctx.of('highlight')) { const w = h.data && h.data.word; if (!w) continue; const pg = [...pages].reverse().find(p => p.show <= h.at + 1e-6);
      if (pg && !pg.f.lines.some(l => l.includes(w))) console.warn(`y5 highlight at=${h.at}: "${w}" is not in the page word ("${pg.text}"; the highlighter only marks the main word — colour words in the line with data.key), so this does nothing`); }
  },
  draw(c, t, ctx) {
    const { W, H } = ctx;
    let k = -1; pages.forEach((p, i) => { if (t >= p.show - 1e-6) k = i; });
    if (!pages.length) return;
    // framehand: a page change never leaves an empty frame — the old page stays on screen until the new one has words
    const TW = 0.4, j = pages.findIndex((p, i) => i > 0 && t >= p.show - 0.14 && t < p.show - 0.14 + TW);
    if (j > 0 && !ctx.alpha) {
      const A = pages[j - 1], B = pages[j], e = MO.expoInOut(clamp((t - (B.show - 0.14)) / TW));
      if (TR === 'push' || TR === 'lift') {
        const dx = TR === 'push' ? W : 0, dy = TR === 'lift' ? H : 0;
        c.save(); c.translate(-dx * e, -dy * e); scene(c, A, t, ctx); c.restore();
        c.save(); c.translate(dx * (1 - e), dy * (1 - e)); scene(c, B, t, ctx); c.restore();
      } else if (TR === 'zoom') {
        scene(c, B, t, ctx);
        c.save(); c.globalAlpha = 1 - e; c.translate(W / 2, H / 2); c.scale(1 + 0.35 * e, 1 + 0.35 * e); c.translate(-W / 2, -H / 2); scene(c, A, t, ctx); c.restore();
      } else { // wipe: a slanted edge reveals the next page (its colour and its words), the old page stays on the other side
        const sk = H * 0.3, x = lerp(-sk - 40, W + 40, e);
        scene(c, A, t, ctx);
        c.save(); c.beginPath(); c.moveTo(-60, 0); c.lineTo(x + sk, 0); c.lineTo(x, H); c.lineTo(-60, H); c.closePath(); c.clip(); scene(c, B, t, ctx); c.restore();
        c.save(); c.strokeStyle = B.col[1]; c.globalAlpha = 0.9 * Math.sin(Math.PI * e); c.lineWidth = 14 * ctx.u; c.beginPath(); c.moveTo(x + sk, 0); c.lineTo(x, H); c.stroke(); c.restore();
      }
      track(c, B, t, ctx);
      return;
    }
    const P = pages[Math.max(0, k)];
    scene(c, P, t, ctx);
    if (k >= 0) track(c, P, t, ctx);
  },
};
function scene(c, P, t, ctx) {
  const { W, H, u } = ctx;
  if (!ctx.alpha) { c.fillStyle = P.col[0]; c.fillRect(0, 0, W, H); backdrop(c, P, t, ctx); }
  if (t < P.show - 0.14) return;
  let bump = 1; for (const q of ctx.cues) { const l = t - q.at; if (l >= 0 && l < 0.4) bump += 0.015 * Math.exp(-l * 22); }
  const [dx, dy] = CAM.drift(t, 5 * u, 2);
  CAM.with(c, { x: W / 2 + dx, y: H / 2 + dy, z: bump, r: 0.008 * Math.sin(t * 0.8) }, cc => { ghost(cc, P, t, ctx); drawPage(cc, P, t, ctx); });
}
// backgrounds by seed: dots, grid, stripes, grain, a big ghost word, or the shop's photo under a tinted scrim
function backdrop(c, P, t, ctx) {
  const { W, H, u } = ctx, fg = P.col[1];
  if (PH) {
    const z = 1.06 + 0.04 * (t / ctx.dur), iw = PH.width, ih = PH.height, sc = Math.max(W / iw, H / ih) * z, dw = iw * sc, dh = ih * sc;
    c.drawImage(PH, (W - dw) / 2 - (P.i % 2 ? 1 : -1) * t * 6 * u, (H - dh) / 2, dw, dh);
    c.save(); c.globalAlpha = PHA; c.fillStyle = P.col[0]; c.fillRect(0, 0, W, H); c.restore();
    CLIP.mark(c, 'photo', 0, 0, W, H);
    return;
  }
  if (BG === 'dots') return dots(c, t, fg, 0.07, u, W, H);
  c.save();
  if (BG === 'grid') { const g = 90 * u, o = (t * 20 * u) % g; c.globalAlpha = 0.08; c.strokeStyle = fg; c.lineWidth = 2 * u; c.beginPath();
    for (let x = -g + o; x < W + g; x += g) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = -g + o; y < H + g; y += g) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); }
  else if (BG === 'stripes') { const g = 70 * u, o = (t * 30 * u) % (g * 2); c.globalAlpha = 0.07; c.fillStyle = fg; c.translate(W / 2, H / 2); c.rotate(-0.5); for (let x = -H - W + o; x < H + W; x += g * 2) c.fillRect(x, -H - W, g, 2 * (H + W)); }
  else if (BG === 'grain') { if (!GRAIN) { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), im = g.createImageData(256, 256); let r = 7;
      for (let i = 0; i < im.data.length; i += 4) { r = (r * 16807) % 2147483647; const v = r % 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 40; } g.putImageData(im, 0, 0); GRAIN = cv; }
    c.globalAlpha = 0.5; c.fillStyle = c.createPattern(GRAIN, 'repeat'); c.translate(((t * 9) | 0) % 2 * 37, 0); c.fillRect(-40, 0, W + 80, H);
    c.restore(); c.save(); const gr = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
  else if (BG === 'bigword') { const w = ctx.data.bigword || ''; if (w) { const sz = H * 0.3; TY.text(c, w.toUpperCase(), W / 2 - t * 40 * u, H * 0.62, { size: sz, fam: 'PuHui-Black', color: fg, alpha: 0.06, align: 'center' }); } }
  c.restore();
}
function dots(c, t, col, a, u, W, H) { const g = 64 * u, ox = (t * 36 * u) % g, oy = (t * 18 * u) % g; c.save(); c.globalAlpha = a; c.fillStyle = col; for (let y = -g; y < H + g; y += g) for (let x = -g; x < W + g; x += g) { c.beginPath(); c.arc(x + ox, y + oy, 4 * u, 0, Math.PI * 2); c.fill(); } c.restore(); }
function drawPage(c, P, t, ctx) {
  const { H, u } = ctx, q = P.q, fg = ctx.alpha ? '#FFFFFF' : P.col[1], lt = ctx.lt(t, P.num ? P.show : q.at);
  const W = 2 * (ctx.box.x + ctx.box.w / 2); // centre of the safe box: every x below is measured from W / 2
  const stroke = ctx.alpha ? { stroke: '#111', strokeW: P.f.size * 0.06 } : {};
  const lines = P.num ? [P.text] : P.f.lines, size = P.f.size, lh = size * 1.08;
  const sub = q.sub, subSz = P.sf ? P.sf.size : 0, subL = P.sf ? P.sf.lines : [];
  const by0 = ctx.safe.top, by1 = H - ctx.safe.bottom - (ctx.portrait && LIST ? 220 * u : 0), cyB = ctx.portrait ? by0 + (by1 - by0) * 0.44 : (by0 + by1) / 2;
  const blockH = lines.length * lh + (sub ? subSz * (0.6 + subL.length * 1.15) : 0), y0 = cyB - blockH / 2 + size * 0.82;
  const label = q.data && q.data.label;
  if (label) TY.rise(c, label, ctx.box.x + (ctx.portrait ? 20 : 140) * u, ctx.safe.top + (ctx.portrait ? 260 : 210) * u, MO.at(lt, 0, 0.3), { size: (ctx.portrait ? 56 : 52) * u, fam: 'PuHui-Bold', color: fg, track: 6 * u, ...(ctx.alpha ? { stroke: '#111', strokeW: 6 * u } : {}) });
  const pi = pages.indexOf(P), ls = (ctx.portrait ? 56 : 52) * u;
  if (label && lt > 0) CLIP.mark(c, CLIP.rid('label', pi), ctx.box.x + (ctx.portrait ? 20 : 140) * u, ctx.safe.top + (ctx.portrait ? 260 : 210) * u - ls * 0.9, TY.width(c, label, ls, 'PuHui-Bold', 6 * u), ls * 1.1);
  const hq = ctx.of('highlight').filter(h => h.at >= (P.num ? P.show : q.at) - 1e-6).find(h => { const nx = ctx.of('title', 'point', 'number').find(z => z.at > q.at); return !nx || h.at < nx.at; });
  let hiScale = 1, knock = null;
  if (hq) {
    const hl = ctx.lt(t, hq.at), wd = hq.data && hq.data.word, found = !wd || lines.some(l => l.includes(wd));
    hiScale = hl > 0 && found ? 1 + 0.06 * MO.settle(hl, 1, 2.5, 6) : 1;
    if (hl > 0) lines.forEach((ln, i) => {
      const word = wd || ln, at = ln.indexOf(word); if (at < 0) return;
      const wPre = TY.width(c, ln.slice(0, at), size), wW = TY.width(c, word, size), wl = TY.width(c, ln, size), y = y0 + i * lh;
      // framehand: a right-to-left line (Arabic, Hebrew) starts at its right edge, so its first word is the rightmost one
      const x = CLIP.isRtl && CLIP.isRtl(ln) ? W / 2 + wl / 2 - wPre - wW : W / 2 - wl / 2 + wPre;
      // framehand: the marker is measured on the word as drawn (same scale and centre as the slammed text), so "Visit" is covered and the bar never runs into "us"
      const mb = TY.markerBox(x, y, wW, size, { scale: hiScale, ox: W / 2, oy: y - size * 0.36, pad: 10 * u });
      const mc = ctx.alpha ? '#FF5A36' : (P.col[0] === '#FFD23F' ? '#FF5A36' : '#FFD23F'), mr = [mb.x, mb.y, mb.w, mb.h, MO.at(hl, 0, 0.3)];
      TY.marker(c, ...mr, mc); CLIP.mark(c, 'marker', mr[0], mr[1], mr[2], mr[3]);
      if (mc.toLowerCase() === fg.toLowerCase()) (knock = knock || []).push({ i, mr });
    });
  }
  lines.forEach((ln, i) => {
    let s = ln; if (P.num) { const k = MO.expoOut(clamp(lt / 0.7)); s = (P.nd.prefix || '') + TY.fmt((P.nd.value || 0) * k, P.nd.decimals ?? 0) + (P.nd.suffix || ''); }
    const w = TY.width(c, s, size), x = W / 2 - w / 2, y = y0 + i * lh;
    TY.slam(c, s, x, y, lt - i * 0.08, { size, color: fg, scale: hiScale, ox: W / 2, oy: y - size * 0.36, ...stroke });
    if (lt - i * 0.08 > 0) CLIP.mark(c, CLIP.rid('word', pi), x, y - size * 0.88, w, size * 1.0);
    for (const k of (knock || []).filter(k => k.i === i)) {
      const [mx, my, mw, mh, mp] = k.mr, ww = mw * MO.expoOut(clamp(mp)), sk = mh * 0.18;
      c.save(); c.beginPath(); c.moveTo(mx + sk, my); c.lineTo(mx + ww + sk, my); c.lineTo(mx + ww, my + mh); c.lineTo(mx, my + mh); c.closePath(); c.clip();
      TY.slam(c, s, x, y, lt - i * 0.08, { size, color: P.col[0], scale: hiScale, ox: W / 2, oy: y - size * 0.36 }); c.restore();
    }
  });
  if (sub) subL.forEach((ln, k) => {
    const sw = TY.width(c, ln, subSz, 'PuHui-Heavy'), sy = y0 + (lines.length - 1) * lh + subSz * (1.7 + k * 1.15), sp = MO.at(lt, 0.35 + k * 0.08, 0.35), so = { size: subSz, fam: 'PuHui-Heavy', color: fg, ...(ctx.alpha ? { stroke: '#111', strokeW: subSz * 0.08 } : {}) };
    const key = q.data && q.data.key, ki = key ? ln.indexOf(key) : -1, x0 = W / 2 - sw / 2;
    if (sp > 0) CLIP.mark(c, CLIP.rid('sub', pi), x0, sy - subSz * 0.9, sw, subSz * 1.15);
    if (ki < 0) return TY.rise(c, ln, x0, sy, sp, so);
    const pre = ln.slice(0, ki), post = ln.slice(ki + key.length), wp = TY.width(c, pre, subSz, 'PuHui-Heavy'), wk = TY.width(c, key, subSz, 'PuHui-Heavy');
    const rtl = CLIP.isRtl && CLIP.isRtl(ln), kx = rtl ? x0 + sw - wp - wk : x0 + wp; // right to left: the words before the key sit on its right
    if (pre) TY.rise(c, pre, rtl ? x0 + sw - wp : x0, sy, sp, so); TY.rise(c, key, kx, sy, sp, { ...so, color: ctx.alpha ? '#FFD23F' : accentOf(P.col) }); if (post) TY.rise(c, post, rtl ? x0 : x0 + wp + wk, sy, sp, so);
  });
}
function ghost(c, P, t, ctx) {
  if (!LIST || !P.ord || ctx.alpha) return;
  const { W, H, u } = ctx, lt = t - P.show, k = MO.springHz(lt, 2.0, 8), sc = lerp(1.35, 1, k), s = String((P.q.data && P.q.data.num) ?? P.ord);
  const size = (ctx.portrait ? 1000 : 900) * u, x = ctx.box.x + ctx.box.w - (ctx.portrait ? 0 : 60) * u + lt * 14 * u, y = H - ctx.safe.bottom + (ctx.portrait ? -120 : 70) * u - lt * 10 * u;
  TY.text(c, s, x, y, { size, fam: 'PuHui-Black', align: 'right', color: P.col[1], alpha: 0.12 * clamp(lt / 0.08), scale: sc, ox: x - size * 0.28, oy: y - size * 0.36 });
}
function track(c, P, t, ctx) {
  if (!LIST) return;
  const { W, H, u } = ctx, n = LIST.length, k = LIST.filter(p => p.show <= t + 1e-6).length; if (k === 0) return;
  const fg = ctx.alpha ? '#FFFFFF' : P.col[1], gap = 18 * u, seg = Math.min((ctx.portrait ? 150 : 110) * u, ((ctx.portrait ? ctx.box.w * 0.9 : W * 0.4) - (n - 1) * gap) / n), tot = n * seg + (n - 1) * gap;
  const x0 = ctx.portrait ? ctx.box.x + (ctx.box.w - tot) / 2 : W - 140 * u - tot, y = ctx.portrait ? H - ctx.safe.bottom - 130 * u : ctx.safe.top + 120 * u;
  const a = MO.expoOut(clamp((t - LIST[0].show) / 0.3));
  if (a > 0.05) CLIP.mark(c, 'track', x0, y - 52 * u, tot, 66 * u);
  c.save(); c.globalAlpha = a;
  for (let i = 0; i < n; i++) { const x = x0 + i * (seg + gap), on = i < k, fill = on ? MO.expoOut(clamp((t - LIST[i].show) / 0.3)) : 0;
    c.fillStyle = fg; c.globalAlpha = a * 0.25; c.fillRect(x, y, seg, 10 * u); c.globalAlpha = a; c.fillRect(x, y, seg * fill, 10 * u);
    TY.text(c, String(i + 1).padStart(2, '0'), x, y - 20 * u, { size: (ctx.portrait ? 40 : 32) * u, fam: 'PuHui-Bold', color: fg, align: 'left', alpha: on ? 1 : 0.4, track: 2 * u, ...(ctx.alpha ? { stroke: '#111', strokeW: 5 * u } : {}) }); }
  c.restore();
}
})();
