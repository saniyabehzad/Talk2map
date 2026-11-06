/* Procedural "photos" for synthetic listings. Illustrations, not real places. */
(function (g) {
  const T = g.T2M;
  const FACADES = ['#e9d8b4', '#d9c7a7', '#cfd8d3', '#e6e0d4', '#d8b9a4', '#c9d4dd', '#efe6c8', '#d4c2c9', '#bfc9b8'];
  const MODERN = ['#d9d4cc', '#b9a58c', '#c8ccd0', '#e3e1dc', '#a8a39b'];
  const AUTUMN = ['#c8862b', '#d9a441', '#7c8f3c', '#a9662f', '#b94f2a'];

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * k))); gg = Math.max(0, Math.min(255, Math.round(gg * k))); b = Math.max(0, Math.min(255, Math.round(b * k)));
    return `rgb(${r},${gg},${b})`;
  }

  function mountains(ctx, w, base, amp, R, color, snow) {
    const pts = [];
    const n = 7;
    for (let i = 0; i <= n; i++) pts.push([i * w / n + (R() - 0.5) * w / n * 0.6, base - amp * (0.35 + R() * 0.65)]);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, base);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(w, base); ctx.closePath(); ctx.fill();
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        if (p[1] > base - amp * 0.7) continue;
        const s = amp * 0.22;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - s * 0.9, p[1] + s); ctx.lineTo(p[0] - s * 0.2, p[1] + s * 0.7);
        ctx.lineTo(p[0] + s * 0.3, p[1] + s * 1.05); ctx.lineTo(p[0] + s * 0.9, p[1] + s); ctx.closePath(); ctx.fill();
      }
    }
  }

  function tree(ctx, x, ground, size, R) {
    ctx.fillStyle = '#5a4634';
    ctx.fillRect(x - size * 0.06, ground - size * 0.9, size * 0.12, size * 0.9);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = AUTUMN[Math.floor(R() * AUTUMN.length)];
      ctx.beginPath();
      ctx.arc(x + (R() - 0.5) * size * 0.7, ground - size * (0.95 + R() * 0.5), size * (0.28 + R() * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function exterior(cv, L) {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, R = T.rng(L.seed);
    const sunny = L.a.sun > 29;
    let gr = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    gr.addColorStop(0, sunny ? '#78acdc' : '#9eb2c4'); gr.addColorStop(1, sunny ? '#e9f1f8' : '#dde3e8');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    if (sunny) {
      const sx = w * (0.78 + R() * 0.12), sy = h * 0.15;
      const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, h * 0.18);
      sg.addColorStop(0, 'rgba(255,240,190,1)'); sg.addColorStop(0.35, 'rgba(255,236,170,0.55)'); sg.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h * 0.5);
    }
    const horizon = h * 0.56;
    if (L.a.dLake < 90) {
      mountains(ctx, w, horizon - h * 0.04, h * 0.2, R, '#a9b8c8', true);
      ctx.fillStyle = '#87adc9'; ctx.fillRect(0, horizon - h * 0.045, w, h * 0.06);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, horizon - h * 0.03, w, 1.5);
    } else {
      mountains(ctx, w, horizon, h * 0.1, R, '#93a98f', false);
    }

    const ground = h * 0.83;
    // neighbours
    for (const side of [-1, 1]) {
      const nw = w * 0.28, nx = side < 0 ? -nw * 0.35 : w - nw * 0.65, nh = h * (0.32 + R() * 0.2);
      const col = FACADES[Math.floor(R() * FACADES.length)];
      ctx.fillStyle = shade(col, 0.88); ctx.fillRect(nx, ground - nh, nw, nh);
      ctx.fillStyle = 'rgba(60,80,95,0.55)';
      for (let fy = ground - nh + 12; fy < ground - 20; fy += h * 0.09)
        for (let fx = nx + 10; fx < nx + nw - 14; fx += w * 0.06) ctx.fillRect(fx, fy, w * 0.03, h * 0.045);
    }

    const modern = L.year >= 1997, old = L.year < 1960;
    const bw = w * (0.48 + R() * 0.12), bx = w * 0.5 - bw / 2 + (R() - 0.5) * w * 0.06;
    const fh = (h * 0.58) / (L.floors + 0.35);
    const top = ground - fh * L.floors;
    const VIVID = ['#e8c88a', '#a9c4b5', '#d99c84', '#b8c7d9', '#e6d36f', '#c4a7c2', '#9fb7a0', '#e3b9a0', '#f0ead8'];
    const fc = modern ? MODERN[L.seed % MODERN.length] : VIVID[(L.seed >>> 3) % VIVID.length];
    ctx.fillStyle = fc; ctx.fillRect(bx, top, bw, ground - top);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(bx + bw * 0.72, top, bw * 0.28, ground - top);
    ctx.fillStyle = shade(fc, 0.78); ctx.fillRect(bx, ground - fh * 0.35, bw, fh * 0.35);

    // roof
    if (modern) {
      ctx.fillStyle = shade(fc, 0.55); ctx.fillRect(bx - 4, top - 6, bw + 8, 6);
      ctx.fillStyle = shade(fc, 0.8); ctx.fillRect(bx + bw * 0.55, top - fh * 0.45, bw * 0.25, fh * 0.45 - 6);
    } else {
      ctx.fillStyle = old ? '#8b4a37' : '#6f5a50';
      ctx.beginPath(); ctx.moveTo(bx - 8, top); ctx.lineTo(bx + bw + 8, top);
      ctx.lineTo(bx + bw * 0.84, top - fh * 0.95); ctx.lineTo(bx + bw * 0.16, top - fh * 0.95); ctx.closePath(); ctx.fill();
      for (let d = 0; d < 2; d++) {
        const dx = bx + bw * (0.3 + d * 0.32);
        ctx.fillStyle = fc; ctx.fillRect(dx, top - fh * 0.62, bw * 0.12, fh * 0.48);
        ctx.fillStyle = '#3e5568'; ctx.fillRect(dx + bw * 0.025, top - fh * 0.52, bw * 0.07, fh * 0.32);
      }
    }

    const cols = modern ? 3 : (R() > 0.5 ? 5 : 4);
    const cw = bw / cols;
    for (let f = 0; f < L.floors; f++) {
      const fy = ground - (f + 1) * fh;
      for (let c = 0; c < cols; c++) {
        const ww = cw * (modern ? 0.74 : 0.46), wh = fh * (modern ? 0.62 : 0.56);
        const wx = bx + c * cw + (cw - ww) / 2, wy = fy + fh * 0.2;
        if (f === 0 && c === Math.floor(cols / 2)) {
          ctx.fillStyle = '#4a3a2e'; ctx.fillRect(wx + ww * 0.1, fy + fh * 0.2, ww * 0.8, fh * 0.8);
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(wx + ww * 0.15, fy + fh * 0.25, ww * 0.3, fh * 0.3);
          continue;
        }
        const gl = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
        gl.addColorStop(0, '#9dbdd3'); gl.addColorStop(1, '#3d5a70');
        ctx.fillStyle = '#f7f5f0'; ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        ctx.fillStyle = gl; ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (old) {
          ctx.fillStyle = R() > 0.5 ? '#56704f' : '#59697a';
          ctx.fillRect(wx - ww * 0.32, wy, ww * 0.26, wh); ctx.fillRect(wx + ww * 1.06, wy, ww * 0.26, wh);
        }
        if (L.balcony && f > 0 && (modern || c % 2 === 1)) {
          ctx.fillStyle = modern ? 'rgba(210,225,235,0.55)' : 'rgba(40,40,40,0.8)';
          if (modern) ctx.fillRect(wx - 6, wy + wh * 0.62, ww + 12, wh * 0.4);
          else { for (let k = 0; k <= 6; k++) ctx.fillRect(wx - 4 + k * (ww + 8) / 6, wy + wh * 0.65, 1.5, wh * 0.35); ctx.fillRect(wx - 4, wy + wh * 0.65, ww + 8, 2); }
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wx - 6, wy + wh + 1, ww + 12, 3);
        }
      }
    }

    // your floor
    const yf = ground - (L.floor + 1) * fh;
    ctx.strokeStyle = '#1a56db'; ctx.lineWidth = Math.max(2, w / 180);
    ctx.setLineDash([6, 4]); ctx.strokeRect(bx - 5, yf + 3, bw + 10, fh - 4); ctx.setLineDash([]);
    const label = L.floor === 0 ? 'Ground floor' : `Floor ${L.floor}`;
    ctx.font = `600 ${Math.round(h * 0.045)}px "IBM Plex Sans", system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 14;
    const lx = Math.min(w - tw - 6, bx + bw + 10), ly = yf + fh / 2 - h * 0.035;
    ctx.fillStyle = '#1a56db'; rr(ctx, lx, ly, tw, h * 0.07, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(label, lx + 7, ly + h * 0.052);

    // street
    ctx.fillStyle = '#b7bbbe'; ctx.fillRect(0, ground, w, h * 0.04);
    ctx.fillStyle = '#6a7177'; ctx.fillRect(0, ground + h * 0.04, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let x = 10; x < w; x += w / 8) ctx.fillRect(x, ground + h * 0.1, w / 18, 2.5);

    if (L.a.city && R() < 0.6) {
      ctx.strokeStyle = 'rgba(40,40,40,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h * 0.62); ctx.lineTo(w, h * 0.6); ctx.stroke();
      const tx = w * (0.05 + R() * 0.5), ty = ground + h * 0.015, tl = w * 0.42, th = h * 0.12;
      ctx.fillStyle = '#f4f6f8'; rr(ctx, tx, ty - th, tl, th, 8); ctx.fill();
      ctx.fillStyle = '#2b64c9'; ctx.fillRect(tx, ty - th * 0.38, tl, th * 0.38);
      ctx.fillStyle = '#2f3d4a';
      for (let k = 0; k < 6; k++) ctx.fillRect(tx + 8 + k * (tl - 16) / 6, ty - th * 0.85, (tl - 16) / 6 - 5, th * 0.38);
      ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.beginPath(); ctx.moveTo(tx + tl * 0.5, ty - th); ctx.lineTo(tx + tl * 0.42, h * 0.61); ctx.stroke();
    }
    tree(ctx, bx - w * 0.04, ground + 2, h * 0.2, R);
    if (R() > 0.4) tree(ctx, bx + bw + w * 0.05, ground + 2, h * 0.16, R);
  }

  function interior(cv, L) {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, R = T.rng(L.seed + 7);
    const walls = ['#efe9df', '#e3e8ea', '#ece4d6', '#e6e1ea', '#dfe6dc'];
    const wall = walls[Math.floor(R() * walls.length)];
    ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = shade(wall, 0.94); ctx.fillRect(0, 0, w, h * 0.06);
    const fl = h * 0.68;
    const fg = ctx.createLinearGradient(0, fl, 0, h);
    fg.addColorStop(0, '#b78d63'); fg.addColorStop(1, '#d4ab80');
    ctx.fillStyle = fg; ctx.fillRect(0, fl, w, h - fl);
    ctx.strokeStyle = 'rgba(90,60,35,0.25)'; ctx.lineWidth = 1;
    for (let i = -8; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.02, fl); ctx.lineTo(w / 2 + i * w * 0.12, h); ctx.stroke(); }
    ctx.fillStyle = '#f5f3ef'; ctx.fillRect(0, fl - 5, w, 5);

    const wx = w * 0.07, wy = h * 0.13, ww = w * 0.3, wh = h * 0.46;
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, L.a.sun > 29 ? '#7fb0dd' : '#a6b7c6'); sky.addColorStop(1, '#eef3f7');
    ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
    if (L.a.dLake < 90) { ctx.fillStyle = '#a9b8c8'; ctx.fillRect(wx, wy + wh * 0.6, ww, wh * 0.08); ctx.fillStyle = '#86abc7'; ctx.fillRect(wx, wy + wh * 0.68, ww, wh * 0.32); }
    else { ctx.fillStyle = '#9aa7ae'; for (let k = 0; k < 5; k++) ctx.fillRect(wx + k * ww / 5, wy + wh * (0.55 + R() * 0.2), ww / 5 - 3, wh); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(4, w / 90); ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
    ctx.fillStyle = '#d9dcde';
    for (let k = 0; k < 9; k++) ctx.fillRect(wx + 6 + k * (ww - 12) / 9, wy + wh + h * 0.03, (ww - 12) / 9 - 3, h * 0.08);

    const beam = Math.max(0, Math.min(1, (L.a.sun - 20) / 22));
    if (beam > 0.05) {
      ctx.fillStyle = `rgba(255,228,160,${0.15 + beam * 0.4})`;
      ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww, wy + wh);
      ctx.lineTo(wx + ww + w * 0.32, h); ctx.lineTo(wx + w * 0.12, h); ctx.closePath(); ctx.fill();
    }

    const sofas = ['#5b7a8c', '#8c6b5b', '#6b7f5d', '#7d7a8f', '#9a7b4f'];
    const sc = sofas[Math.floor(R() * sofas.length)];
    const sx = w * 0.5, sy = h * 0.47, sw = w * 0.4, sh = h * 0.24;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(sx + sw / 2, sy + sh + 6, sw * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(sc, 0.85); rr(ctx, sx, sy, sw, sh * 0.6, 12); ctx.fill();
    ctx.fillStyle = sc; rr(ctx, sx - 8, sy + sh * 0.4, sw + 16, sh * 0.55, 12); ctx.fill();
    ctx.fillStyle = shade(sc, 1.2); rr(ctx, sx + sw * 0.08, sy + sh * 0.12, sw * 0.22, sh * 0.32, 8); ctx.fill();
    rr(ctx, sx + sw * 0.66, sy + sh * 0.12, sw * 0.22, sh * 0.32, 8); ctx.fill();

    ctx.fillStyle = ['#c0533a', '#d6a74a', '#3f6d8c', '#7a8f6a'][Math.floor(R() * 4)];
    ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.86, w * 0.26, h * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

    const fx = sx + sw * 0.18, fy = h * 0.14;
    ctx.fillStyle = '#2f2f2f'; ctx.fillRect(fx - 3, fy - 3, sw * 0.64 + 6, h * 0.22 + 6);
    const art = ['#e0b44c', '#2d5f8b', '#c75b3d', '#e9e4da', '#6d8b5f'];
    ctx.fillStyle = art[3]; ctx.fillRect(fx, fy, sw * 0.64, h * 0.22);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = art[Math.floor(R() * art.length)]; ctx.beginPath(); ctx.arc(fx + R() * sw * 0.64, fy + R() * h * 0.22, h * (0.03 + R() * 0.05), 0, Math.PI * 2); ctx.fill(); }

    const px = w * 0.93, py = h * 0.66;
    ctx.fillStyle = '#c9b49a'; rr(ctx, px - w * 0.035, py, w * 0.07, h * 0.1, 4); ctx.fill();
    ctx.fillStyle = '#4f7b4a';
    for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse(px + (R() - 0.5) * w * 0.08, py - R() * h * 0.2, w * 0.018, h * 0.05, (R() - 0.5) * 1.6, 0, Math.PI * 2); ctx.fill(); }

    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.44, h * 0.8); ctx.lineTo(w * 0.44, h * 0.3); ctx.stroke();
    ctx.fillStyle = '#f1e6cf'; ctx.beginPath(); ctx.moveTo(w * 0.41, h * 0.3); ctx.lineTo(w * 0.47, h * 0.3); ctx.lineTo(w * 0.455, h * 0.22); ctx.lineTo(w * 0.425, h * 0.22); ctx.closePath(); ctx.fill();
  }

  function plan(cv, L, colors) {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    const ink = colors.ink, paper = colors.paper, faint = colors.faint, accent = colors.accent;
    ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = faint; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += w / 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    const m = w * 0.08, X = m, Y = h * 0.1, PW = w * 0.62, PH = h * (L.balcony ? 0.66 : 0.78);
    const beds = Math.max(1, Math.floor(L.rooms) - 1);
    const area = L.area;
    ctx.fillStyle = 'rgba(26,86,219,0.06)'; ctx.fillRect(X, Y, PW, PH);
    const leftW = PW * 0.56;
    const rooms = [];
    rooms.push({ x: X, y: Y, w: leftW, h: PH * 0.64, name: 'Living', a: Math.round(area * 0.34) });
    rooms.push({ x: X, y: Y + PH * 0.64, w: leftW * 0.6, h: PH * 0.36, name: 'Kitchen', a: Math.round(area * 0.12) });
    rooms.push({ x: X + leftW * 0.6, y: Y + PH * 0.64, w: leftW * 0.4, h: PH * 0.36, name: 'Bath', a: Math.round(area * 0.07) });
    const rh = PH / beds;
    for (let b = 0; b < beds; b++) rooms.push({ x: X + leftW, y: Y + b * rh, w: PW - leftW, h: rh, name: b === 0 ? 'Bedroom' : 'Room ' + (b + 1), a: Math.round(area * 0.47 / beds) });

    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, w / 160);
    rooms.forEach(r => ctx.strokeRect(r.x, r.y, r.w, r.h));
    ctx.lineWidth = Math.max(4, w / 80); ctx.strokeRect(X, Y, PW, PH);
    ctx.fillStyle = ink;
    const fs = Math.round(h * 0.045);
    rooms.forEach(r => {
      ctx.font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`;
      ctx.fillText(r.name, r.x + 8, r.y + fs + 6);
      ctx.font = `400 ${Math.round(fs * 0.85)}px "IBM Plex Mono", monospace`;
      ctx.fillText(r.a + ' m²', r.x + 8, r.y + fs * 2.1 + 6);
    });
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
    rooms.slice(3).forEach(r => { ctx.beginPath(); ctx.arc(r.x, r.y + r.h - 4, Math.min(28, r.h * 0.3), -Math.PI / 2, 0); ctx.stroke(); });
    ctx.strokeStyle = '#7fa8d8'; ctx.lineWidth = Math.max(4, w / 90);
    ctx.beginPath(); ctx.moveTo(X + PW * 0.08, Y); ctx.lineTo(X + PW * 0.42, Y); ctx.stroke();
    if (L.balcony) {
      const by = Y + PH + 4, bh = h * 0.1;
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(X, by, leftW, bh);
      ctx.save(); ctx.beginPath(); ctx.rect(X, by, leftW, bh); ctx.clip();
      ctx.strokeStyle = faint === 'transparent' ? ink : ink; ctx.globalAlpha = 0.25;
      for (let k = -bh; k < leftW; k += 10) { ctx.beginPath(); ctx.moveTo(X + k, by + bh); ctx.lineTo(X + k + bh, by); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.fillStyle = ink; ctx.font = `600 ${Math.round(fs * 0.85)}px "IBM Plex Sans", system-ui, sans-serif`;
      ctx.fillText('Balcony', X + 8, by + bh * 0.68);
    }
    const ix = X + PW + w * 0.06;
    ctx.fillStyle = ink;
    ctx.font = `700 ${Math.round(h * 0.075)}px "Archivo", system-ui, sans-serif`;
    ctx.fillText(L.rooms.toFixed(1), ix, Y + h * 0.08);
    ctx.font = `400 ${Math.round(h * 0.04)}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.fillText('rooms', ix, Y + h * 0.13);
    ctx.font = `700 ${Math.round(h * 0.075)}px "Archivo", system-ui, sans-serif`;
    ctx.fillText(area + ' m²', ix, Y + h * 0.27);
    ctx.font = `400 ${Math.round(h * 0.04)}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.fillText('living area', ix, Y + h * 0.32);
    const nx = ix + w * 0.06, ny = Y + h * 0.5;
    ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nx, ny + 26); ctx.lineTo(nx, ny - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx, ny - 22); ctx.lineTo(nx - 7, ny - 8); ctx.lineTo(nx + 7, ny - 8); ctx.closePath(); ctx.fill();
    ctx.font = `700 ${Math.round(h * 0.045)}px "IBM Plex Sans", system-ui, sans-serif`; ctx.fillText('N', nx - 5, ny + 48);
    ctx.fillStyle = ink; ctx.fillRect(ix, Y + h * 0.75, w * 0.12, 3);
    ctx.font = `400 ${Math.round(h * 0.035)}px "IBM Plex Mono", monospace`; ctx.fillText('5 m', ix, Y + h * 0.81);
  }

  const cache = new Map();
  function render(kind, L, wpx, hpx, colors) {
    const key = kind + L.id + wpx + 'x' + hpx + (kind === 'plan' ? colors.paper : '');
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx;
    if (kind === 'exterior') exterior(cv, L);
    else if (kind === 'interior') interior(cv, L);
    else plan(cv, L, colors);
    const url = cv.toDataURL('image/jpeg', 0.86);
    cache.set(key, url);
    return url;
  }
  g.T2MPics = { render };
})(window);
