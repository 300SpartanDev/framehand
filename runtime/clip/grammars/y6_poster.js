// framehand: y6 — a warm, local-business poster that builds itself. Three print styles drawn entirely in code
// (no stock pictures): "riso" (risograph shop poster: grain paper, halftone, offset ink), "chalk" (café menu board:
// slate, chalk type, hand-drawn rings) and "kraft" (market stall: kraft paper, rubber stamps, tape labels).
// The offer opens the film as the hero (visible in the first frames, settled by 1 s), then the shop name, the
// lines and the call to action pin themselves around it. A photo (data.image) is shown large — taped print or
// full-bleed under a readable scrim. Everything stays inside ctx.box (the phone-safe area in 9:16).
// cues: offer (text, sub) · title (text = shop name, sub = small line) · point (text) · cta (text, sub)
CLIPS.y6_poster = (() => {
const { clamp, lerp, rng } = U;
const STYLE = {
  riso: { bg: '#F3EBDD', ink: '#1B1B1B', accent: '#FF4B3E', accent2: '#2D5BFF', display: 'Anton', body: 'ArchivoBlack', small: 'ArchivoBlack', shape: 'burst' },
  chalk: { bg: '#1E2A25', ink: '#F4F1E8', accent: '#FFD45C', accent2: '#FF9DB8', display: 'Kalam-700', body: 'Kalam-700', small: 'Caveat-600', shape: 'ring' },
  kraft: { bg: '#C9A57A', ink: '#203063', accent: '#B3261E', accent2: '#203063', display: 'AlfaSlabOne', body: 'ArchivoBlack', small: 'ArchivoBlack', shape: 'stamp' },
};
let S, L, items, photo, cache, hero;
// a right-to-left button points left (the arrow sits at the end of the line, which is its left side)
const arrowFor = (t) => (/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(t || '') ? '←' : '→');
const font = (size, fam) => `${size}px "${fam}"`;
const tex = (key, w, h, fn) => { const k = key + w + 'x' + h; if (!cache[k]) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h); cache[k] = cv; } return cache[k]; };
// chalk / stamp ink: a colour with speckled holes, used as a fill pattern so letters look rubbed or stamped
function grit(c, color, holes, seed) {
  const cv = tex(`grit${color}${holes}${seed}`, 256, 256, (g, w, h) => { g.fillStyle = color; g.fillRect(0, 0, w, h); const r = rng(seed); g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600 * holes; i++) { g.globalAlpha = 0.25 + r() * 0.75; const s = r() < 0.92 ? 1 + r() * 1.6 : 2 + r() * 4; g.fillRect(r() * w, r() * h, s, s); } });
  return c.createPattern(cv, 'repeat');
}
function background(c, ctx, t) {
  const { W, H, u } = ctx;
  if (ctx.alpha) return;
  const bg = tex(`bg-${S.style}-${S.bg}-${S.deco}`, W, H, (g) => {
    g.fillStyle = S.bg; g.fillRect(0, 0, W, H);
    const r = rng(S.seed + 3), im = g.getImageData(0, 0, W, H), d = im.data, amt = S.style === 'chalk' ? 9 : 14;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
    if (S.style === 'chalk') { // old chalk smudges and a wooden frame
      for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, rr = (80 + r() * 260) * u, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 30 * u; g.lineCap = 'round'; for (let i = 0; i < 9; i++) { g.beginPath(); const y = r() * H; g.moveTo(-50, y); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 200 * u, W * 0.7, y + (r() - 0.5) * 200 * u, W + 50, y + (r() - 0.5) * 120 * u); g.stroke(); }
      const fw = 30 * u; g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, W, fw); g.fillRect(0, H - fw, W, fw); g.fillRect(0, 0, fw, H); g.fillRect(W - fw, 0, fw, H);
      g.strokeStyle = 'rgba(30,18,8,0.35)'; g.lineWidth = 1.2 * u; for (let i = 0; i < 40; i++) { const o = r() * fw; g.beginPath(); g.moveTo(0, o); g.lineTo(W, o + (r() - 0.5) * 6); g.stroke(); g.beginPath(); g.moveTo(0, H - o); g.lineTo(W, H - o); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 4 * u; g.strokeRect(fw, fw, W - 2 * fw, H - 2 * fw);
    } else if (S.style === 'kraft') {
      const tile = CL.paperTile('fhkraft' + S.bg, S.bg, { amt: 16, fibers: 520, fiberCol: [92, 62, 30] }); g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, W, H);
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7); v.addColorStop(0, 'rgba(60,35,10,0)'); v.addColorStop(1, 'rgba(60,35,10,0.32)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    } else { // riso: a halftone field and a colour block, printed slightly off-register
      const cx = S.deco === 'corner' ? W * 0.05 : W * 0.92, cy = S.deco === 'corner' ? H * 0.94 : H * 0.1, R = Math.max(W, H) * 0.55, cell = 22 * u;
      g.fillStyle = S.accent2; g.globalAlpha = 0.22;
      for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) { const dd = Math.hypot(x - cx, y - cy) / R; if (dd < 1) { g.beginPath(); g.arc(x + (y / cell % 2) * cell / 2, y, cell * 0.42 * (1 - dd), 0, Math.PI * 2); g.fill(); } }
      g.globalAlpha = 1;
      if (S.deco === 'stripes') { g.save(); g.globalAlpha = 0.1; g.fillStyle = S.accent; g.translate(W / 2, H / 2); g.rotate(-0.5); for (let x = -W * 2; x < W * 2; x += 90 * u) g.fillRect(x, -H * 2, 34 * u, H * 4); g.restore(); }
    }
    if (ctx.portrait && !S.onPhoto) floor(g, ctx, r);
  });
  c.drawImage(bg, 0, 0);
  if (S.style === 'riso' && S.deco === 'rays' && hero) { // slow sunburst behind the offer
    const o = hero.slot, n = 22; c.save(); c.globalAlpha = 0.08; c.fillStyle = S.accent; c.translate(o.x, o.y); c.rotate(t * 0.08);
    for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, Math.max(W, H), (i / n) * Math.PI * 2, ((i + 0.5) / n) * Math.PI * 2); c.closePath(); c.fill(); } c.restore();
  }
}
// 9:16: the strip under the safe box (where the app's caption and buttons sit) gets a picture-only ground, so the
// frame looks full without putting any words where the phone covers them
function floor(g, ctx, r) {
  const { W, H, u, box: B } = ctx, y0 = B.y + B.h + 40 * u;
  if (y0 > H - 60 * u) return;
  g.save();
  if (S.style === 'riso') {
    const wave = (yy, amp, ph) => { g.beginPath(); g.moveTo(-20, H + 20); g.lineTo(-20, yy); for (let x = -20; x <= W + 20; x += 20 * u) g.lineTo(x, yy + Math.sin(x / (W / 3) + ph) * amp); g.lineTo(W + 20, H + 20); g.closePath(); };
    g.globalAlpha = 0.9; g.fillStyle = S.ink; wave(y0 + 70 * u + 10 * u, 26 * u, 0.6); g.fill();
    g.fillStyle = S.accent2; wave(y0 + 70 * u, 26 * u, 0.6); g.fill();
    g.globalAlpha = 0.35; g.fillStyle = S.paper; const cell = 26 * u;
    for (let y = y0 + 120 * u; y < H; y += cell) for (let x = 0; x < W; x += cell) { const k = (y - y0) / (H - y0); g.beginPath(); g.arc(x + (y / cell % 2) * cell / 2, y, cell * 0.36 * (1 - k * 0.7), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.85; g.fillStyle = S.accent; wave(y0 + 260 * u, 18 * u, 2.1); g.fill();
  } else if (S.style === 'kraft') { // a gingham market-table cloth with a scalloped edge
    const top = y0 + 60 * u, sc = 46 * u;
    g.beginPath(); g.moveTo(-10, H + 10); g.lineTo(-10, top); for (let x = -10; x < W + sc; x += sc) g.arc(x + sc / 2, top, sc / 2, Math.PI, 0, true); g.lineTo(W + 10, H + 10); g.closePath();
    g.fillStyle = '#F4ECDD'; g.fill(); g.save(); g.clip();
    const cell = 54 * u; g.fillStyle = S.accent; g.globalAlpha = 0.42;
    for (let x = 0; x < W; x += cell * 2) g.fillRect(x, top - sc, cell, H);
    for (let y = top; y < H; y += cell * 2) g.fillRect(0, y, W, cell);
    g.restore();
    g.globalAlpha = 0.25; g.strokeStyle = '#000'; g.lineWidth = 3 * u; g.beginPath(); for (let x = -10; x < W + sc; x += sc) g.arc(x + sc / 2, top, sc / 2, Math.PI, 0, true); g.stroke();
  } else { // chalk: the chalk tray and a few doodles
    g.globalAlpha = 0.55; g.strokeStyle = S.ink; g.lineWidth = 5 * u; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const x = W * (0.08 + i * 0.14) + (r() - 0.5) * 40 * u, y = y0 + (80 + r() * 160) * u, s2 = (16 + r() * 18) * u;
      g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 0.8; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * s2, y + Math.sin(a) * s2); } g.closePath(); g.stroke(); }
    g.globalAlpha = 0.4; g.lineWidth = 7 * u; g.strokeStyle = S.accent; g.beginPath(); g.moveTo(W * 0.06, y0 + 300 * u); for (let x = W * 0.06; x < W * 0.94; x += 30 * u) g.lineTo(x, y0 + 300 * u + Math.sin(x / (40 * u)) * 12 * u); g.stroke();
    const ty = H - 30 * u - 46 * u; g.globalAlpha = 1; g.fillStyle = '#5a3d22'; g.fillRect(30 * u, ty, W - 60 * u, 46 * u); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(30 * u, ty, W - 60 * u, 8 * u);
    g.fillStyle = '#f1eee6'; g.fillRect(W * 0.62, ty - 16 * u, 90 * u, 18 * u); g.fillStyle = S.accent; g.fillRect(W * 0.74, ty - 14 * u, 70 * u, 16 * u);
  }
  g.restore();
}
function drawPhoto(c, ctx, t) {
  if (!photo) return;
  const { W, H, u } = ctx, im = photo.im;
  if (photo.mode === 'bleed') {
    const s = Math.max(W / im.width, H / im.height) * (1.04 + 0.03 * clamp(t / ctx.dur)), w = im.width * s, h = im.height * s;
    c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.35, 'rgba(0,0,0,0.30)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    CLIP.mark(c, 'photo', 0, 0, W, H);
    return;
  }
  const p = MO.expoOut(clamp((t - photo.at) / 0.6)); if (p <= 0) return;
  const r = photo.rect, f = Math.max(r.w / im.width, r.h / im.height), sw = r.w / f, sh = r.h / f;
  c.save(); c.translate(r.x + r.w / 2, r.y + r.h / 2 + (1 - p) * 80 * u); c.rotate(photo.rot * p + (1 - p) * 0.12); c.globalAlpha = clamp(p * 2);
  const b = 16 * u; c.shadowColor = 'rgba(30,20,10,0.35)'; c.shadowBlur = 26 * u; c.shadowOffsetY = 10 * u;
  c.fillStyle = '#faf7f0'; c.fillRect(-r.w / 2 - b, -r.h / 2 - b, r.w + 2 * b, r.h + 2 * b); c.shadowColor = 'transparent';
  c.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, -r.w / 2, -r.h / 2, r.w, r.h);
  CL.tape(c, -r.w / 2 + 50 * u, -r.h / 2 - b, -0.5, 130 * u); CL.tape(c, r.w / 2 - 50 * u, -r.h / 2 - b, 0.45, 130 * u);
  CLIP.mark(c, 'photo', -r.w / 2 - b, -r.h / 2 - b, r.w + 2 * b, r.h + 2 * b);
  c.restore();
}
// offer shapes
function star(c, R, n = 16, inner = 0.84) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? R * inner : R; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
function drawOffer(c, ctx, it, t) {
  const { u } = ctx, lt = t - it.q.at; if (lt < 0) return;
  const pop = MO.backOut(clamp(lt / 0.38), 2.0), settle = hero ? MO.expoInOut(clamp((t - hero.t0) / 0.7)) : 1;
  const o = { x: lerp(it.hero.x, it.slot.x, settle), y: lerp(it.hero.y, it.slot.y, settle), r: lerp(it.hero.r, it.slot.r, settle) };
  const wob = 0.03 * Math.sin(t * 1.3) * clamp(lt), rot = lerp(it.hero.rot, it.slot.rot, settle) + wob;
  c.save(); c.translate(o.x, o.y); c.rotate(rot); c.scale(pop, pop);
  const R = o.r, k = R / it.r0;
  if (S.shape === 'burst') {
    c.save(); c.translate(10 * u, 12 * u); star(c, R); c.fillStyle = S.ink; c.fill(); c.restore();
    star(c, R); c.fillStyle = S.accent; c.fill();
  } else if (S.shape === 'ring') {
    const pts = DG.hand(DG.ellipsePts(0, 0, R, R * 0.86, -2.2, 1.12, 64), { amp: 3 * u, seed: 5 }), L0 = DG.cum(pts);
    c.save(); c.strokeStyle = grit(c, S.accent, 1.2, 11); c.lineWidth = 12 * u; c.lineCap = 'round'; DG.drawPartial(c, pts, L0, L0[L0.length - 1] * clamp(lt / 0.45)); c.restore();
  } else if (S.shape === 'ticket') { // a cream ticket with a punched notch on each side
    const rw = R * 1.9, rh = R * 1.12;
    c.save(); c.fillStyle = '#F7F3EA'; roundRect(c, -rw / 2, -rh / 2, rw, rh, 14 * u); c.fill();
    c.strokeStyle = grit(c, S.stampInk, 1.2, 19); c.lineWidth = 4 * u; c.stroke();
    c.fillStyle = S.bg; c.beginPath(); c.arc(-rw / 2, 0, 16 * u, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(rw / 2, 0, 16 * u, 0, Math.PI * 2); c.fill(); c.restore();
  } else if (S.shape === 'tape') { // a strip of tape, darker at the torn ends
    const rw = R * 2.25, rh = R * 0.92;
    c.save(); c.fillStyle = 'rgba(255,236,170,0.94)'; roundRect(c, -rw / 2, -rh / 2, rw, rh, 3 * u); c.fill();
    c.globalAlpha = 0.22; c.fillStyle = '#000'; c.fillRect(-rw / 2, -rh / 2, rw * 0.07, rh); c.fillRect(rw / 2 - rw * 0.07, -rh / 2, rw * 0.07, rh); c.restore();
  } else { // rubber stamp: double ring, grunge ink
    c.save(); c.strokeStyle = grit(c, S.stampInk, 1.6, 23); c.lineWidth = 12 * u; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke(); c.lineWidth = 5 * u; c.beginPath(); c.arc(0, 0, R * 0.86, 0, Math.PI * 2); c.stroke();
    c.fillStyle = grit(c, S.stampInk, 1.6, 23); for (const a of [Math.PI, 0]) { c.save(); c.rotate(a); c.beginPath(); c.arc(0, -R * 0.93, 7 * u, 0, Math.PI * 2); c.fill(); c.restore(); } c.restore();
  }
  const fg = S.shape === 'burst' ? S.paper : S.shape === 'ticket' || S.shape === 'tape' ? '#1B1B1B' : S.shape === 'ring' ? grit(c, S.ink, 0.6, 7) : grit(c, S.stampInk, 1.6, 23);
  const sz = it.f.size * k, lh = sz * 1.0, n = it.f.lines.length, subSz = it.sf ? it.sf.size * k : 0, m = it.sf ? it.sf.lines.length : 0;
  const tot = (n - 1) * lh + sz * 0.78 + (m ? subSz * 1.45 + (m - 1) * subSz * 1.2 : 0);
  let y = -tot / 2 + sz * 0.78;
  it.f.lines.forEach((ln, i) => TY.text(c, ln, 0, y + i * lh, { size: sz, fam: S.display, color: fg, align: 'center' }));
  y += (n - 1) * lh + subSz * 1.45;
  if (it.sf) it.sf.lines.forEach((ln, i) => TY.text(c, ln, 0, y + i * subSz * 1.2, { size: subSz, fam: S.small, color: fg, align: 'center' }));
  CLIP.mark(c, 'offer', -R, -R, R * 2, R * 2);
  c.restore();
}
function drawTitle(c, ctx, it, t) {
  const { u } = ctx, lt = t - it.q.at; if (lt < 0) return;
  const { x, y, w, align } = it, sz = it.f.size, lh = sz * 1.02, fg = S.onPhoto ? '#FFFFFF' : S.ink;
  if (it.eyebrow) TY.text(c, it.eyebrow, align === 'center' ? x + w / 2 : x, y - 18 * u, { size: it.ebSize, fam: S.small, color: S.style === 'riso' ? S.accent : S.style === 'chalk' ? S.accent2 : S.accent, align, track: 4 * u, alpha: clamp(lt / 0.3) });
  const ax = align === 'center' ? x + w / 2 : x;
  it.f.lines.forEach((ln, i) => {
    const yy = y + sz * 0.86 + i * lh, p = clamp((lt - i * 0.1) / 0.42);
    if (S.style === 'kraft') { // stamped: thunk in from big, grunge ink, a box around it
      const sc = lerp(1.35, 1, MO.expoOut(p)); TY.text(c, ln, ax, yy, { size: sz, fam: S.display, color: S.onPhoto ? '#fff' : grit(c, S.ink, 1.2, 31 + i), align, alpha: clamp(p * 3), scale: sc, ox: ax, oy: yy - sz * 0.35 });
    } else if (S.style === 'chalk') { // written left to right; the mask is taller than the ascenders so a finished word is not cropped
      const tw = TY.width(c, ln, sz, S.display), x0 = align === 'center' ? ax - tw / 2 : ax; c.save(); c.beginPath(); c.rect(x0 - 24 * u, yy - sz * 1.5, (tw + 48 * u) * MO.cubicOut(p), sz * 2.15); c.clip();
      TY.text(c, ln, ax, yy, { size: sz, fam: S.display, color: grit(c, S.onPhoto ? '#ffffff' : S.ink, 0.7, 13 + i), align }); c.restore();
    } else { // riso: rises out of a slot, printed off-register
      const e = MO.expoOut(p), dy = (1 - e) * sz * 0.9; c.save(); c.beginPath(); c.rect(x - 40 * u, yy - sz * 1.45, w + 80 * u, sz * 2.0); c.clip();
      if (!S.onPhoto) TY.text(c, ln, ax + 5 * u, yy + dy + 5 * u, { size: sz, fam: S.display, color: S.accent2, align, alpha: 0.85 });
      TY.text(c, ln, ax, yy + dy, { size: sz, fam: S.display, color: fg, align }); c.restore();
    }
  });
  if (S.style === 'kraft' && !S.onPhoto) { const p = clamp((lt - 0.15) / 0.35); if (p > 0) { c.save(); c.globalAlpha = p; c.strokeStyle = grit(c, S.ink, 1.2, 41); c.lineWidth = 6 * u; const hh = it.f.lines.length * lh + 30 * u; const bw = it.tw + 60 * u, bx = align === 'center' ? ax - bw / 2 : x - 30 * u; c.strokeRect(bx, y - 4 * u, bw, hh); c.lineWidth = 2.5 * u; c.strokeRect(bx + 10 * u, y + 6 * u, bw - 20 * u, hh - 20 * u); c.restore(); } }
  if (it.sub) TY.text(c, it.sub, ax, y + it.f.lines.length * lh + it.subSize * 1.2, { size: it.subSize, fam: S.small, color: fg, align, alpha: clamp((lt - 0.3) / 0.3) });
  CLIP.mark(c, 'title', x, y, w, it.h);
}
function drawPoint(c, ctx, it, t, i) {
  const { u } = ctx, lt = t - it.q.at; if (lt < 0) return;
  const p = MO.expoOut(clamp(lt / 0.45)), { x, y, w, h } = it, sz = it.size;
  const lines = it.lines && it.lines.length ? it.lines : [it.text];
  const lh = sz * 1.15;
  const y0 = lines.length === 1 ? y + h * 0.68 : y + (h - lh * (lines.length - 1)) / 2 + sz * 0.35;
  c.save(); c.translate((1 - p) * -60 * u, 0); c.globalAlpha = clamp(p * 2);
  if (S.style === 'riso') {
    const tw = Math.min(w, it.tw + 70 * u); c.fillStyle = S.accent2; roundRect(c, x + 6 * u, y + 6 * u, tw, h, Math.min(h / 2, 28 * u)); c.fill();
    c.fillStyle = S.onPhoto ? 'rgba(255,255,255,0.95)' : S.ink; roundRect(c, x, y, tw, h, Math.min(h / 2, 28 * u)); c.fill();
    lines.forEach((ln, li) => TY.text(c, ln, x + 35 * u, y0 + li * lh, { size: sz, fam: S.body, color: S.onPhoto ? S.ink : S.paper, align: 'left' }));
  } else if (S.style === 'chalk') {
    TY.text(c, '–', x, y0, { size: sz, fam: S.body, color: grit(c, S.accent2, 0.8, 3), align: 'left' });
    lines.forEach((ln, li) => TY.text(c, ln, x + sz * 0.8, y0 + li * lh, { size: sz, fam: S.body, color: grit(c, S.onPhoto ? '#ffffff' : S.ink, 0.7, 17 + i), align: 'left' }));
  } else {
    const tw = Math.min(w, it.tw + 60 * u); c.save(); c.translate(x, y); c.rotate(it.rot); c.shadowColor = 'rgba(40,25,10,0.3)'; c.shadowBlur = 8 * u; c.shadowOffsetY = 4 * u;
    c.fillStyle = '#F7F3EA'; CL.tornRect(c, tw, h, 9 + i * 5, 3 * u); c.fill(); c.shadowColor = 'transparent';
    lines.forEach((ln, li) => TY.text(c, ln, 30 * u, (lines.length === 1 ? h * 0.68 : (h - lh * (lines.length - 1)) / 2 + sz * 0.35) + li * lh, { size: sz, fam: S.body, color: S.ink, align: 'left' })); c.restore();
  }
  c.restore();
  CLIP.mark(c, CLIP.rid('point', i), x, y, w, h);
}
function drawCta(c, ctx, it, t) {
  const { u } = ctx, lt = t - it.q.at; if (lt < 0) return;
  const p = MO.backOut(clamp(lt / 0.4), 1.6), { x, y, w, h } = it, sz = it.size, cx = x + w / 2;
  const pulse = 1 + 0.025 * Math.sin(Math.max(0, lt - 0.5) * 5);
  c.save(); c.translate(cx, y + h / 2); c.scale(p * pulse, p * pulse); c.translate(-cx, -(y + h / 2));
  if (S.style === 'riso') {
    c.fillStyle = S.ink; roundRect(c, x + 8 * u, y + 8 * u, w, h, 14 * u); c.fill(); c.fillStyle = S.accent; roundRect(c, x, y, w, h, 14 * u); c.fill();
    TY.text(c, it.text + '  ' + arrowFor(it.text), cx, y + h * 0.66, { size: sz, fam: S.body, color: S.paper, align: 'center' });
  } else if (S.style === 'chalk') {
    const pts = DG.hand(rect(x, y, w, h), { amp: 2.5 * u, seed: 9 }), L0 = DG.cum(pts);
    c.strokeStyle = grit(c, S.accent, 1, 5); c.lineWidth = 7 * u; c.lineCap = 'round'; DG.drawPartial(c, pts, L0, L0[L0.length - 1] * clamp(lt / 0.5));
    TY.text(c, it.text, cx, y + h * 0.68, { size: sz, fam: S.body, color: grit(c, S.accent, 0.7, 6), align: 'center' });
  } else { // a price tag on a string. On a photo the ink is flipped to white, so the tag stays dark and the words stay cream.
    const tag = S.onPhoto ? '#1B1B1B' : S.ink;
    c.fillStyle = tag; c.beginPath(); c.moveTo(x + h * 0.45, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x + h * 0.45, y + h); c.lineTo(x, y + h / 2); c.closePath(); c.fill();
    c.fillStyle = S.onPhoto ? '#F7F3EA' : S.bg; c.beginPath(); c.arc(x + h * 0.42, y + h / 2, 9 * u, 0, Math.PI * 2); c.fill();
    TY.text(c, it.text, cx + h * 0.2, y + h * 0.66, { size: sz, fam: S.body, color: '#F7F3EA', align: 'center' });
  }
  if (it.sub) TY.text(c, it.sub, cx, y + h + it.subSize * 1.35, { size: it.subSize, fam: S.small, color: S.onPhoto ? '#fff' : S.style === 'chalk' ? grit(c, S.ink, 0.6, 8) : S.ink, align: 'center', alpha: clamp((lt - 0.3) / 0.3) });
  c.restore();
  CLIP.mark(c, 'cta', x, y, w, h);
}
const rect = (x, y, w, h) => { const P = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]], out = []; for (let i = 0; i < 4; i++) for (let k = 0; k < 14; k++) out.push([lerp(P[i][0], P[i + 1][0], k / 14), lerp(P[i][1], P[i + 1][1], k / 14)]); out.push(P[4]); return out; };
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

return {
  fonts: [], // Latin display faces with their own accented letters (č ć š ž đ é ü…)
  faces: ['Anton', 'ArchivoBlack', 'AlfaSlabOne', 'Kalam-700', 'Caveat-600'],
  safe: true, box: true,
  scenes: ctx => CLIP.beats(ctx.cues, q => ({ offer: 'offer', title: 'name', point: 'line', cta: 'cta' })[q.kind] || null),
  regions: ctx => [...ctx.of('offer').length ? [{ id: 'offer', label: 'Offer sticker' }] : [], ...ctx.of('title').length ? [{ id: 'title', label: 'Shop name' }] : [],
    ...ctx.of('point').map((q, i) => ({ id: CLIP.rid('point', i), label: `Line ${i + 1}` })), ...ctx.of('cta').length ? [{ id: 'cta', label: 'Call to action' }] : [], ...(ctx.data.image ? [{ id: 'photo', label: 'Photo' }] : [])],
  init(ctx) {
    cache = {}; hero = null; photo = null;
    const { W, H, u, portrait, box: B } = ctx, d = ctx.data, base = STYLE[d.style] || STYLE.riso;
    S = { ...base, ...(d.palette || {}), style: STYLE[d.style] ? d.style : 'riso', deco: d.deco || 'corner', seed: Number(d.seed) || 7 };
    S.paper = S.style === 'riso' ? S.bg : '#F7F3EA';
    S.shape = d.shape || base.shape;
    // a stamp is printed in one ink: if the accent is too pale on this paper (yellow on cream) the stamp uses the ink colour
    const lumOf = (h) => { const x = String(h || '#000').replace('#', ''); const f = (i) => { const v = parseInt(x.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4); };
    const ratio = (a, b) => (Math.max(lumOf(a), lumOf(b)) + 0.05) / (Math.min(lumOf(a), lumOf(b)) + 0.05);
    S.stampInk = ratio(S.accent, S.bg) >= 2.6 ? S.accent : S.accent2 && ratio(S.accent2, S.bg) >= 2.6 ? S.accent2 : S.ink;
    const g = document.createElement('canvas').getContext('2d');
    const im = d.image && ctx.IMG[d.image];
    const mode = im ? (d.photoMode === 'bleed' ? 'bleed' : 'print') : null;
    S.onPhoto = mode === 'bleed';
    if (S.onPhoto && S.style !== 'chalk') S.ink = '#FFFFFF';
    const offerQ = ctx.of('offer')[0], titleQ = ctx.of('title')[0], pts = ctx.of('point').slice(0, 3), ctaQ = ctx.of('cta')[0];
    items = { points: [] };
    const align = d.align === 'center' || portrait ? 'center' : 'left';
    // ---- slots (fractions of the safe box) ----
    let photoR = null, titleR, offerSlot, ptsR, ctaR;
    if (portrait) {
      // the corner logo sits in the top of the safe box (~110 px). The shop name starts below it.
      const nameTop = B.y + (d.eyebrow ? 148 : 110) * u;
      if (mode === 'print') { photoR = { x: B.x + B.w * 0.06, y: B.y + B.h * 0.02, w: B.w * 0.88, h: B.h * 0.36 }; titleR = { x: B.x, y: B.y + B.h * 0.42, w: B.w, h: B.h * 0.17 }; offerSlot = { x: B.x + B.w * 0.78, y: B.y + B.h * 0.36, r: B.w * 0.2, rot: 0.16 }; ptsR = { x: B.x + B.w * 0.08, y: B.y + B.h * 0.62, w: B.w * 0.84, h: B.h * 0.22 }; }
      else { titleR = { x: B.x, y: nameTop, w: B.w, h: B.h * 0.22 }; offerSlot = { x: B.x + B.w / 2, y: B.y + B.h * 0.46, r: Math.min(B.w * 0.36, B.h * 0.16), rot: -0.12 }; ptsR = { x: B.x + B.w * 0.08, y: B.y + B.h * 0.64, w: B.w * 0.84, h: B.h * 0.2 }; }
      ctaR = { x: B.x + B.w * 0.1, y: B.y + B.h * 0.87, w: B.w * 0.8, h: Math.min(120 * u, B.h * 0.085) };
    } else {
      const colW = B.w * (mode === 'print' ? 0.5 : 0.56);
      titleR = { x: B.x + B.w * 0.05, y: B.y + B.h * 0.08, w: colW, h: B.h * 0.3 };
      ptsR = { x: B.x + B.w * 0.05, y: B.y + B.h * 0.44, w: colW, h: B.h * 0.3 };
      ctaR = { x: B.x + B.w * 0.05, y: B.y + B.h * 0.8, w: Math.min(colW, 640 * u), h: 110 * u };
      if (mode === 'print') { photoR = { x: B.x + B.w * 0.6, y: B.y + B.h * 0.1, w: B.w * 0.34, h: B.h * 0.66 }; offerSlot = { x: B.x + B.w * 0.62, y: B.y + B.h * 0.76, r: B.h * 0.17, rot: -0.14 }; }
      else offerSlot = { x: B.x + B.w * 0.8, y: B.y + B.h * 0.48, r: Math.min(B.h * 0.3, B.w * 0.17), rot: -0.12 };
    }
    if (mode) photo = { im, mode, rect: photoR, at: 0.12, rot: -0.025 };
    // ---- the offer: hero first, then its slot ----
    if (offerQ) {
      const heroR = portrait ? Math.min(B.w * 0.46, B.h * 0.24) : Math.min(B.h * 0.4, B.w * 0.26);
      const it = { q: offerQ, slot: offerSlot, hero: { x: B.x + B.w / 2, y: B.y + B.h * (portrait ? 0.42 : 0.5), r: heroR, rot: -0.06 }, r0: heroR };
      const inner = heroR * (S.shape === 'burst' ? 1.3 : 1.25);
      // the words must sit inside the shape: main + small line together fill at most ~1.25 R of height
      if (offerQ.sub) it.sf = TY.fit(g, offerQ.sub, inner * 0.86, heroR * 0.2, S.small, { maxLines: 2, min: 0.5, balance: true });
      const subH = it.sf ? it.sf.size * 1.25 * it.sf.lines.length : 0;
      it.f = TY.fit(g, offerQ.text || '', inner, heroR * (offerQ.sub ? 0.5 : 0.62), S.display, { maxLines: offerQ.sub ? 2 : 3, min: 0.25, balance: true });
      const mainH = it.f.lines.length * it.f.size;
      if (mainH + subH > heroR * 1.3) { const k = (heroR * 1.3 - subH) / mainH; it.f = TY.fit(g, offerQ.text || '', inner, it.f.size * Math.max(0.4, k), S.display, { maxLines: 2, min: 0.25, balance: true }); }
      items.offer = it;
      const next = ctx.cues.find(q => q.kind !== 'offer' && q.at > offerQ.at);
      hero = { t0: next ? Math.max(offerQ.at + 0.9, next.at - 0.35) : ctx.dur, slot: offerSlot };
      if (!titleQ && !pts.length && !ctaQ) { it.slot = it.hero; }
    }
    if (titleQ) {
      const fit = TY.fit(g, titleQ.text || '', titleR.w, (portrait ? 190 : 170) * u, S.display, { maxLines: 2, min: 0.3, balance: true });
      const tw = Math.max(...fit.lines.map(l => TY.width(g, l, fit.size, S.display)));
      items.title = { q: titleQ, ...titleR, align, f: fit, tw, sub: titleQ.sub || '', subSize: 44 * u, eyebrow: d.eyebrow || '', ebSize: 40 * u };
      items.title.h = fit.lines.length * fit.size * 1.02 + (titleQ.sub ? 70 * u : 0);
      if (titleR.h < items.title.h) titleR.h = items.title.h;
    }
    if (pts.length) {
      const long = pts.some(q => (q.text || '').length > 28);
      const rowH = Math.min(ptsR.h / pts.length, (portrait ? (long ? 156 : 96) : (long ? 132 : 92)) * u), gap = rowH * 0.16, h = rowH - gap;
      pts.forEach((q, i) => {
        const fit = TY.fit(g, q.text || '', ptsR.w - 110 * u, h * 0.86, S.body, { maxLines: 2, min: 0.32, balance: true });
        const lines = fit.lines && fit.lines.length ? fit.lines : [q.text || ''];
        const tw = Math.max(1, ...lines.map(l => TY.width(g, l, fit.size, S.body)));
        const pw = Math.min(ptsR.w, tw + 80 * u);
        const x = align === 'center' ? ptsR.x + (ptsR.w - pw) / 2 : ptsR.x;
        items.points.push({ q, text: q.text || '', lines, x, y: ptsR.y + i * rowH, w: pw, h, size: fit.size, tw, rot: (i % 2 ? 0.015 : -0.02) });
      });
    }
    if (ctaQ) {
      const size = TY.fit(g, (ctaQ.text || '') + '  ' + arrowFor(ctaQ.text), ctaR.w - 60 * u, ctaR.h * 0.5, S.body, { maxLines: 1, min: 0.35 }).size;
      const tw = TY.width(g, (ctaQ.text || '') + '  ' + arrowFor(ctaQ.text), size, S.body), w = Math.min(ctaR.w, tw + 110 * u);
      items.cta = { q: ctaQ, text: ctaQ.text || '', sub: ctaQ.sub || '', size, subSize: 40 * u, x: portrait || align === 'center' ? ctaR.x + (ctaR.w - w) / 2 : ctaR.x, y: ctaR.y, w, h: ctaR.h };
    }
    // portrait without a print photo: stack name → sticker → lines → button so nothing overlaps, and size the
    // sticker to fill the space that is left (a two-line brief gets a big sticker, not a half-empty frame)
    if (portrait && mode !== 'print' && items.offer && items.offer.slot !== items.offer.hero) {
      const it = items.offer, top = items.title ? items.title.y + items.title.h + (items.title.eyebrow ? 60 * u : 0) + 24 * u : B.y + 20 * u;
      const bottom = items.cta ? items.cta.y - (items.cta.sub ? 30 * u : 20 * u) : B.y + B.h;
      const rows = items.points.length ? items.points[items.points.length - 1].y + items.points[items.points.length - 1].h - items.points[0].y : 0;
      const free = bottom - top - (rows ? rows + 40 * u : 0);
      const r = clamp(free / 2.5, 120 * u, Math.min(B.w * 0.42, 380 * u));
      const cy = top + r * 1.18 + Math.max(0, (free - r * 2.5) * 0.3);
      it.slot = { ...it.slot, x: B.x + B.w / 2, y: cy, r };
      hero.slot = it.slot;
      let y = cy + r * 1.18 + 30 * u;
      const room = rows ? Math.max(0, bottom - y - rows) : 0;
      y += room * 0.4;
      const y0 = items.points.length ? items.points[0].y : 0;
      items.points.forEach(p => { p.y = y + (p.y - y0); });
    }
  },
  draw(c, t, ctx) {
    const { W, H, u } = ctx;
    const [dx, dy] = CAM.drift(t, 3 * u, S.seed % 7);
    const z = 1 + 0.025 * clamp(t / ctx.dur);
    c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2 + dx, -H / 2 + dy);
    background(c, ctx, t);
    drawPhoto(c, ctx, t);
    c.restore();
    // content is drawn without the zoom so it never leaves the safe box
    c.save(); c.translate(dx * 0.5, dy * 0.5);
    if (items.title) drawTitle(c, ctx, items.title, t);
    items.points.forEach((it, i) => drawPoint(c, ctx, it, t, i));
    if (items.cta) drawCta(c, ctx, items.cta, t);
    if (items.offer) drawOffer(c, ctx, items.offer, t);
    c.restore();
  },
};
})();
