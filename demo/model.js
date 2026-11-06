/* Talk2Map demo model — synthetic, schematic Zurich. Not real data. */
(function (g) {
  const W = 1000, H = 800;
  const HB = [480, 420];

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, k) {
    let h = Math.imul((x | 0) * 73856093 ^ (y | 0) * 19349663 ^ (k || 0) * 83492791, 0x27d4eb2d);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
    return ((h >>> 0) % 100000) / 100000;
  }

  const LAKE = [[495,460],[530,452],[560,470],[600,520],[660,580],[740,650],[840,730],[930,800],[860,800],[780,762],[690,702],[612,642],[560,592],[520,542],[500,500]];
  const CITY = [[110,230],[260,130],[470,80],[650,110],[780,210],[790,360],[720,470],[650,560],[560,640],[470,700],[380,690],[300,600],[230,470],[140,380]];
  const LIMMAT = [[512,456],[470,410],[420,360],[360,320],[290,290],[200,262],[100,235],[0,215]];
  const SIHL = [[420,800],[430,700],[445,600],[460,520],[480,470],[500,450]];
  const MOTORWAYS = [
    [[0,170],[250,150],[500,118],[700,128],[1000,108]],
    [[0,520],[150,522],[300,612],[380,702],[420,800]],
    [[780,210],[880,262],[1000,300]]
  ];
  const RAIL = [
    [[480,420],[560,300],[600,180],[640,0]],
    [[480,420],[360,400],[200,420],[0,440]],
    [[480,420],[620,380],[780,330],[1000,300]],
    [[480,420],[470,540],[540,600],[620,680],[720,760],[790,800]],
    [[480,420],[540,440],[630,500],[720,580],[830,660],[1000,760]]
  ];
  const AIRPORT = [830, 30];
  const HILLS = [
    { name: 'Zürichberg', x: 650, y: 320, sx: 85, sy: 70, g: 10 },
    { name: 'Uetliberg', x: 315, y: 575, sx: 45, sy: 95, g: 13 },
    { name: 'Hönggerberg', x: 300, y: 245, sx: 70, sy: 45, g: 7 },
    { name: 'Witikon', x: 745, y: 420, sx: 55, sy: 60, g: 8 }
  ];
  const HOODS = [
    ['Kreis 1', 505, 440], ['Oerlikon', 560, 168], ['Schwamendingen', 690, 190], ['Altstetten', 235, 365],
    ['Höngg', 300, 268], ['Wipkingen', 420, 318], ['Wiedikon', 395, 485], ['Enge', 470, 528],
    ['Wollishofen', 468, 640], ['Seefeld', 585, 505], ['Hottingen', 600, 430], ['Fluntern', 625, 355],
    ['Affoltern', 420, 125], ['Albisrieden', 290, 455], ['Witikon', 735, 440], ['Zurich West', 350, 368]
  ];
  // Demo tax rates (fictional values, shape only).
  const SECTORS = [
    [0, 25, 'Dübendorf', 98], [25, 55, 'Wallisellen', 90], [55, 80, 'Opfikon', 94], [80, 110, 'Rümlang', 104],
    [110, 140, 'Regensdorf', 106], [140, 165, 'Oberengstringen', 108], [165, 195, 'Schlieren', 111],
    [195, 215, 'Urdorf', 101], [215, 235, 'Uitikon', 86], [235, 255, 'Stallikon', 99], [255, 285, 'Adliswil', 102],
    [285, 312, 'Kilchberg', 74], [312, 340, 'Zollikon', 78], [340, 360, 'Fällanden', 96]
  ];
  const CITY_TAX = 119;

  const ANCHORS = [
    { id: 'A', label: 'Work A', place: 'Office, Oerlikon', x: 562, y: 182, trips: 3, depart: '07:45' },
    { id: 'B', label: 'Work B', place: 'Office, Zurich West', x: 348, y: 362, trips: 2, depart: '08:15' },
    { id: 'F', label: 'Grandparents', place: 'Wollishofen', x: 468, y: 652, trips: 1, depart: 'Sat 10:00' }
  ];

  function pip(pt, poly) {
    let x = pt[0], y = pt[1], inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function dSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function dLine(p, line) { let m = 1e9; for (let i = 1; i < line.length; i++) m = Math.min(m, dSeg(p, line[i - 1], line[i])); return m; }
  function dLines(p, lines) { let m = 1e9; for (const l of lines) m = Math.min(m, dLine(p, l)); return m; }
  function dPoly(p, poly) { return dLine(p, poly.concat([poly[0]])); }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function gauss(p, h) { const ux = (p[0] - h.x) / h.sx, uy = (p[1] - h.y) / h.sy; return Math.exp(-0.5 * (ux * ux + uy * uy)); }
  const energySum = (...ls) => 10 * Math.log10(ls.reduce((s, l) => s + Math.pow(10, l / 10), 0));

  function inScope(p) {
    const ex = (p[0] - 480) / 540, ey = (p[1] - 410) / 450;
    return ex * ex + ey * ey <= 1 && !pip(p, LAKE) && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H;
  }
  function municipality(p) {
    if (pip(p, CITY)) return { name: 'Zürich', tax: CITY_TAX, city: true };
    let ang = Math.atan2(-(p[1] - HB[1]), p[0] - HB[0]) * 180 / Math.PI; if (ang < 0) ang += 360;
    for (const s of SECTORS) if (ang >= s[0] && ang < s[1]) return { name: s[2], tax: s[3], city: false };
    return { name: 'Fällanden', tax: 96, city: false };
  }
  function nearestHood(p) {
    let best = null, bd = 1e9;
    for (const h of HOODS) { const d = Math.hypot(p[0] - h[1], p[1] - h[2]); if (d < bd) { bd = d; best = h[0]; } }
    return best;
  }

  function attrs(p) {
    const x = p[0], y = p[1];
    const n = (k) => hash2(Math.round(x), Math.round(y), k);
    const muni = municipality(p);
    const dRail = dLines(p, RAIL), dMot = dLines(p, MOTORWAYS), dHB = dist(p, HB), dAir = dist(p, AIRPORT);
    const dLake = dPoly(p, LAKE), dSihl = dLine(p, SIHL), dLimmat = dLine(p, LIMMAT);
    const hill = HILLS.reduce((s, h) => s + h.g * gauss(p, h), 0);

    const walkToStop = (muni.city ? 2 + n(1) * 4 : 3 + Math.min(10, dRail / 22) + n(2) * 3);
    const pt = {}, car = {};
    for (const a of ANCHORS) {
      const d = dist(p, [a.x, a.y]);
      pt[a.id] = Math.round(walkToStop + 2 + d / 24 + n(3 + a.id.charCodeAt(0)) * 5 + (muni.city ? 0 : 2));
      car[a.id] = Math.round((4 + d / 36) * 1.3 + 2 + n(9 + a.id.charCodeAt(0)) * 3);
    }

    const road = 31 + 21 * Math.exp(-dMot / 26) + (muni.city ? 7 * Math.exp(-dHB / 230) : 0) + n(11) * 5;
    const rail = 24 + 22 * Math.exp(-dRail / 17) + n(12) * 2;
    const air = 26 + 24 * Math.exp(-dAir / 230) + n(13) * 2;
    const noiseNight = energySum(road, rail, air);

    const slopeStop = Math.min(18, 1 + n(14) * 2.2 + hill * (0.75 + n(15) * 0.5));
    const slope300 = Math.min(20, slopeStop + 0.8 + n(16) * 2.5 + hill * 0.15);
    const steps = hill > 5 && n(17) > 0.45 ? 1 + Math.floor(n(18) * 3) : 0;

    const sun = 24 + 11 * gauss(p, { x: 610, y: 370, sx: 120, sy: 90 }) + 7 * Math.exp(-dLake / 70)
      - 9 * gauss(p, { x: 335, y: 505, sx: 60, sy: 60 }) + n(19) * 7 - (muni.city && dHB < 150 ? 4 : 0);

    let runoff = 0;
    if (dSihl < 28 && n(20) > 0.35) runoff = n(21) > 0.5 ? 30 : 10;
    else if (n(22) > 0.9) runoff = n(23) > 0.6 ? 30 : 10;
    const flood = dSihl < 14 ? 'medium' : dLimmat < 10 ? 'low' : 'none';

    let heat = 1;
    if (muni.city) heat = dHB < 140 ? 4 : (dHB < 290 && hill < 4) ? 3 : 2;
    else heat = hill < 3 && dHB < 320 ? 2 : 1;
    if (dLake < 25 && heat > 1) heat -= 1;

    const contaminated = n(24) > 0.965;
    const shopMin = Math.round(muni.city ? 3 + n(25) * 5 : 5 + n(26) * 9);
    const greenMin = Math.round(Math.max(1, 2 + n(27) * 7 - hill * 0.4));

    return {
      muni: muni.name, tax: muni.tax, city: muni.city, hood: muni.city ? nearestHood(p) : muni.name,
      pt, car, road, rail, air, noiseNight, slopeStop, slope300, steps, sun, runoff, flood, heat,
      contaminated, shopMin, greenMin, dHB, dLake
    };
  }

  function weekly(a) {
    return ANCHORS.reduce((s, an) => s + an.trips * 2 * a.pt[an.id], 0);
  }

  function makeCells(r) {
    const cells = [];
    const dx = r * Math.sqrt(3), dy = r * 1.5;
    let row = 0;
    for (let y = 0; y <= H + r; y += dy, row++) {
      for (let x = (row % 2 ? dx / 2 : 0); x <= W + r; x += dx) {
        const p = [x, y];
        if (!inScope(p)) continue;
        cells.push({ x, y, a: attrs(p) });
      }
    }
    return cells;
  }

  const STREETS = ['Lindenstrasse', 'Rosenweg', 'Bergstrasse', 'Seeblickweg', 'Ahornweg', 'Kirchgasse', 'Sonnenhalde',
    'Hofackerstrasse', 'Wiesenweg', 'Gartenstrasse', 'Rebbergstrasse', 'Bachtobelweg', 'Eichenweg', 'Mühlegasse',
    'Hirschenweg', 'Föhrenstrasse', 'Talackerweg', 'Brunnenhof'];

  function makeListings(count, seed) {
    const R = rng(seed);
    const out = [];
    let tries = 0;
    while (out.length < count && tries < 20000) {
      tries++;
      const p = [R() * W, R() * H];
      if (!inScope(p)) continue;
      const a = attrs(p);
      // bias listings towards inhabited areas (city + near rail)
      if (!a.city && R() > 0.55) continue;
      const rooms = [2.5, 3, 3.5, 3.5, 4, 4.5, 4.5, 5.5][Math.floor(R() * 8)];
      const area = Math.round(rooms * 23 + R() * 18);
      const perM2 = 30 + 10 * Math.exp(-a.dHB / 240) + (a.dLake < 60 ? 6 : 0) - 0.18 * Math.max(0, a.noiseNight - 45) + R() * 5;
      const rent = Math.round(area * perM2 / 10) * 10;
      const floors = 3 + Math.floor(R() * 4);
      const floor = Math.floor(R() * floors);
      const year = [1904, 1928, 1936, 1955, 1962, 1974, 1988, 1997, 2008, 2016, 2021][Math.floor(R() * 11)];
      out.push({
        id: 'L' + String(out.length + 1).padStart(3, '0'),
        x: p[0], y: p[1], a, rooms, area, rent, floor, floors, year,
        street: STREETS[Math.floor(R() * STREETS.length)] + ' ' + (1 + Math.floor(R() * 120)),
        seed: Math.floor(R() * 1e9),
        balcony: R() > 0.3,
        available: ['1 Dec', '1 Jan', '1 Feb', '1 Mar', '1 Apr'][Math.floor(R() * 5)]
      });
    }
    return out;
  }

  const DEFAULTS = { rooms: 3.5, rent: 3800, ptA: 25, ptB: 25, ptF: 35, noise: 45, slope: 6, noFlood: true, heat: 4 };

  function evaluate(item, c) {
    const a = item.a;
    const checks = [
      { key: 'ptA', label: 'Public transport to Work A', value: a.pt.A, limit: c.ptA, unit: 'min', pass: a.pt.A <= c.ptA },
      { key: 'ptB', label: 'Public transport to Work B', value: a.pt.B, limit: c.ptB, unit: 'min', pass: a.pt.B <= c.ptB },
      { key: 'ptF', label: 'Public transport to Grandparents', value: a.pt.F, limit: c.ptF, unit: 'min', pass: a.pt.F <= c.ptF },
      { key: 'noise', label: 'Night noise (road+rail+air)', value: Math.round(a.noiseNight), limit: c.noise, unit: 'dB', pass: a.noiseNight <= c.noise },
      { key: 'slope', label: 'Max slope, walk to stop', value: +a.slopeStop.toFixed(1), limit: c.slope, unit: '%', pass: a.slopeStop <= c.slope },
      { key: 'flood', label: 'Flood risk (runoff + river)', value: (a.runoff > 0 || a.flood !== 'none') ? 'yes' : 'none', limit: c.noFlood ? 'none' : 'any', unit: '', pass: !c.noFlood || (a.runoff === 0 && a.flood === 'none') },
      { key: 'heat', label: 'Night heat class', value: a.heat, limit: c.heat, unit: '/4', pass: a.heat <= c.heat }
    ];
    if (item.rooms !== undefined) {
      checks.unshift(
        { key: 'rooms', label: 'Rooms', value: item.rooms, limit: c.rooms, unit: '', pass: item.rooms >= c.rooms, min: true },
        { key: 'rent', label: 'Rent per month', value: item.rent, limit: c.rent, unit: 'CHF', pass: item.rent <= c.rent }
      );
    }
    const passed = checks.filter(k => k.pass).length;
    return { checks, passed, total: checks.length, all: passed === checks.length };
  }

  g.T2M = { W, H, HB, LAKE, CITY, LIMMAT, SIHL, MOTORWAYS, RAIL, AIRPORT, HILLS, HOODS, ANCHORS, SECTORS, CITY_TAX,
    rng, hash2, attrs, makeCells, makeListings, evaluate, weekly, DEFAULTS, inScope };
})(typeof window !== 'undefined' ? window : globalThis);
