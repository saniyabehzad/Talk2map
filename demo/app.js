(function () {
  const T = window.T2M, P = window.T2MPics;
  const $ = (s) => document.querySelector(s);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const chf = (v) => 'CHF ' + Math.round(v).toLocaleString('de-CH');
  const fmtWeek = (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const R_HEX = 14;
  const cells = T.makeCells(R_HEX);
  const listings = T.makeListings(100, 42);
  listings.forEach((l) => { l.weekly = T.weekly(l.a); });

  let crit = Object.assign({}, T.DEFAULTS);
  let layer = 'match';
  let selected = null;
  let hoverId = null;
  let galleryKind = 'exterior';
  let results = { match: [], near: [], cellEval: [] };

  /* ---------- profile ---------- */
  $('#anchors').innerHTML = T.ANCHORS.map((a) => `
    <div class="anchor"><div class="anchor-tag">${a.id}</div>
      <div><b>${esc(a.label)}</b><span>${esc(a.place)}</span></div>
      <div class="freq">${a.trips}× / week<br>${esc(a.depart)}</div></div>`).join('');

  /* ---------- criteria controls ---------- */
  const CONTROLS = [
    { key: 'rooms', label: 'Rooms, at least', min: 1.5, max: 6.5, step: 0.5, fmt: (v) => (+v).toFixed(1) },
    { key: 'rent', label: 'Rent per month, at most', min: 1500, max: 7000, step: 100, fmt: (v) => chf(v) },
    { key: 'ptA', label: 'Public transport to Work A', min: 8, max: 60, step: 1, fmt: (v) => v + ' min' },
    { key: 'ptB', label: 'Public transport to Work B', min: 8, max: 60, step: 1, fmt: (v) => v + ' min' },
    { key: 'ptF', label: 'Public transport to Grandparents', min: 8, max: 60, step: 1, fmt: (v) => v + ' min' },
    { key: 'noise', label: 'Night noise, at most', min: 34, max: 60, step: 1, fmt: (v) => v + ' dB' },
    { key: 'slope', label: 'Max slope, walk to stop', min: 2, max: 16, step: 0.5, fmt: (v) => (+v).toFixed(1) + ' %' },
    { key: 'heat', label: 'Night heat class, at most', min: 1, max: 4, step: 1, fmt: (v) => v + ' / 4' },
    { key: 'noFlood', label: 'Exclude flood-prone buildings', toggle: true }
  ];
  function renderControls() {
    $('#crit').innerHTML = CONTROLS.map((c) => c.toggle ? `
      <div class="crit-row toggle" id="row-${c.key}"><label><input type="checkbox" id="c-${c.key}" ${crit[c.key] ? 'checked' : ''}> ${c.label}</label></div>` : `
      <div class="crit-row" id="row-${c.key}">
        <label for="c-${c.key}"><span>${c.label}</span><output id="o-${c.key}">${c.fmt(crit[c.key])}</output></label>
        <input type="range" id="c-${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${crit[c.key]}">
      </div>`).join('');
    CONTROLS.forEach((c) => {
      const el = $('#c-' + c.key);
      el.addEventListener('input', () => {
        crit[c.key] = c.toggle ? el.checked : +el.value;
        if (!c.toggle) $('#o-' + c.key).textContent = c.fmt(crit[c.key]);
        run(false);
      });
    });
  }
  function setCrit(changes) {
    Object.assign(crit, changes);
    renderControls();
    Object.keys(changes).forEach((k) => {
      const row = $('#row-' + k); if (!row) return;
      row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
    });
    run(true);
  }

  /* ---------- evaluation ---------- */
  function compute() {
    results.cellEval = cells.map((c) => T.evaluate(c, crit));
    const ev = listings.map((l) => ({ l, e: T.evaluate(l, crit) }));
    results.match = ev.filter((x) => x.e.all).sort((a, b) => a.l.weekly - b.l.weekly);
    results.near = ev.filter((x) => x.e.passed === x.e.total - 1).sort((a, b) => a.l.weekly - b.l.weekly);
    results.matchCells = results.cellEval.filter((e) => e.all).length;
    if (selected && !listings.includes(selected)) selected = null;
  }

  function criticSuggestion() {
    const byKey = {};
    results.near.forEach(({ l, e }) => {
      const f = e.checks.find((k) => !k.pass);
      if (!f || f.key === 'flood') return;
      (byKey[f.key] = byKey[f.key] || []).push({ l, f });
    });
    let best = null;
    for (const k in byKey) {
      const arr = byKey[k];
      if (!best || arr.length > best.arr.length) best = { key: k, arr };
    }
    if (!best) return null;
    const vals = best.arr.map((x) => x.f.value).sort((a, b) => a - b);
    const take = vals.slice(0, Math.min(vals.length, 4));
    let v = best.key === 'rooms' ? Math.min(...take) : Math.max(...take);
    if (best.key === 'rent') v = Math.ceil(v / 100) * 100;
    if (best.key === 'slope') v = Math.ceil(v * 2) / 2;
    if (['ptA', 'ptB', 'ptF', 'noise'].includes(best.key)) v = Math.ceil(v);
    const gain = best.arr.filter((x) => best.key === 'rooms' ? x.f.value >= v : x.f.value <= v).length;
    const ctrl = CONTROLS.find((c) => c.key === best.key);
    return { key: best.key, value: v, gain, label: ctrl.label.replace(', at most', '').replace(', at least', ''), fmt: ctrl.fmt(v) };
  }

  /* ---------- trace + SQL ---------- */
  function renderTrace(animate) {
    const sug = results.match.length < 6 ? criticSuggestion() : null;
    const steps = [
      { t: 'Intent agent', d: `Turned your request into ${CONTROLS.length} explicit criteria` },
      { t: 'Place resolver', d: '3 places resolved · scope: Zürich + 14 neighbours (LV95)' },
      { t: 'Spatial SQL agent', d: `${cells.length.toLocaleString('de-CH')} areas and ${listings.length} listings scanned · ${results.match.length} match` },
      sug ? { t: 'Critic', d: `Few results. Relaxing “${sug.label}” to ${sug.fmt} adds ${sug.gain}.`, warn: true }
          : { t: 'Critic', d: 'Checked units (metres, dB, %), no empty or absurd results' },
      { t: 'Explainer', d: 'Drew matching areas, ranked homes by your weekly travel time' }
    ];
    const ol = $('#trace');
    ol.innerHTML = steps.map((s) => `<li class="${s.warn ? 'warn' : ''}"><i class="dot"></i><div><b>${s.t}</b><span>${esc(s.d)}</span></div></li>`).join('');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reduce) {
      const lis = [...ol.children];
      lis.forEach((li) => li.classList.add('running'));
      lis.forEach((li, i) => setTimeout(() => li.classList.remove('running'), 180 * (i + 1)));
    }
    $('#sql').textContent =
`SELECT l.listing_id, l.rent_chf, l.rooms, b.egid,
       v.pt_a, v.pt_b, v.pt_f, v.weekly_travel_min
FROM   listing l
JOIN   static_score s USING (egid)
JOIN   user_view    v USING (egid)      -- user 'demo'
WHERE  l.rooms              >= ${crit.rooms}
  AND  l.rent_chf           <= ${crit.rent}
  AND  v.pt_a               <= ${crit.ptA}
  AND  v.pt_b               <= ${crit.ptB}
  AND  v.pt_f               <= ${crit.ptF}
  AND  s.noise_night_db     <= ${crit.noise}
  AND  s.max_grade_to_stop  <= ${crit.slope}
  AND  s.night_heat_class   <= ${crit.heat}${crit.noFlood ? `
  AND  s.runoff_depth_t100   = 0
  AND  s.flood_hazard_level  = 'none'` : ''}
ORDER  BY v.weekly_travel_min
LIMIT  50;`;
    return sug;
  }

  /* ---------- results pane ---------- */
  function chipsFor(l, e) {
    const fail = new Set(e.checks.filter((k) => !k.pass).map((k) => k.key));
    const c = (key, txt) => `<span class="chip ${fail.has(key) ? 'fail' : ''}">${txt}</span>`;
    return c('ptA', `A ${l.a.pt.A} min`) + c('ptB', `B ${l.a.pt.B} min`) + c('ptF', `F ${l.a.pt.F} min`) +
      c('noise', `${Math.round(l.a.noiseNight)} dB`) + c('slope', `${l.a.slopeStop.toFixed(1)} %`) +
      (fail.has('rent') ? c('rent', 'over budget') : '') + (fail.has('rooms') ? c('rooms', 'too small') : '') +
      (fail.has('flood') ? c('flood', 'flood risk') : '') + (fail.has('heat') ? c('heat', 'hot nights') : '');
  }
  function card(l, e) {
    const img = P.render('exterior', l, 256, 200);
    const floor = l.floor === 0 ? 'ground floor' : `floor ${l.floor}`;
    return `<button class="card" data-id="${l.id}">
      <img src="${img}" alt="Illustration of the building at ${esc(l.street)}">
      <div>
        <div class="top"><span class="price">${chf(l.rent)}</span><span class="badge">Synthetic</span></div>
        <div class="title">${l.rooms.toFixed(1)} rooms · ${l.area} m² · ${floor}</div>
        <div class="addr">${esc(l.street)} · ${esc(l.a.hood)}</div>
        <div class="chips">${chipsFor(l, e)}</div>
        <div class="week">${fmtWeek(l.weekly)} travel per week</div>
      </div></button>`;
  }

  function renderResults(sug) {
    const box = $('#results');
    if (selected) { renderDetail(); return; }
    const n = results.match.length;
    let critic = '';
    if (sug) {
      critic = `<div class="critic"><div><b>Only ${n} home${n === 1 ? '' : 's'} match.</b> Allowing “${esc(sug.label)}” up to <b>${esc(sug.fmt)}</b> would add ${sug.gain} more.</div>
        <div><button class="btn" id="relax">Apply suggestion</button></div></div>`;
    } else {
      critic = `<div class="critic ok">Every match below meets all ${CONTROLS.length} criteria. The risk profile is shown for each home.</div>`;
    }
    box.innerHTML = `
      <div class="res-head">
        <div class="count">${n} home${n === 1 ? '' : 's'} match</div>
        <div class="sub">${results.matchCells} areas on the map fit your places and environment criteria · sorted by your weekly travel time</div>
      </div>
      ${critic}
      <div class="list">
        ${results.match.map(({ l, e }) => card(l, e)).join('')}
        ${results.near.length ? `<h3>Almost: one criterion off</h3>` + results.near.slice(0, 8).map(({ l, e }) => card(l, e)).join('') : ''}
      </div>`;
    const relax = $('#relax');
    if (relax) relax.addEventListener('click', () => {
      addMsg('user', `OK, allow ${sug.label.toLowerCase()} up to ${sug.fmt}.`);
      setCrit({ [sug.key]: sug.value });
      addMsg('agent', `Done. ${results.match.length} homes match now.`);
    });
    box.querySelectorAll('.card').forEach((b) => {
      b.addEventListener('click', () => select(b.dataset.id));
      b.addEventListener('mouseenter', () => { hoverId = b.dataset.id; draw(); });
      b.addEventListener('mouseleave', () => { hoverId = null; draw(); });
    });
  }

  function metric(label, value, state) {
    const cls = state === true ? 'ok' : state === false ? 'no' : 'info';
    const txt = state === true ? 'meets' : state === false ? 'misses' : 'info';
    return `<div class="metric"><span>${label}</span><span class="v">${value}</span><span class="state ${cls}">${txt}</span></div>`;
  }

  function renderDetail() {
    const l = selected, e = T.evaluate(l, crit), a = l.a;
    const chk = Object.fromEntries(e.checks.map((k) => [k.key, k]));
    const colors = { ink: css('--ink'), paper: css('--paper'), faint: css('--line'), accent: css('--accent') };
    const kinds = [['exterior', 'Building'], ['interior', 'Living room'], ['plan', 'Floor plan']];
    const big = P.render(galleryKind, l, 760, 460, colors);
    const passTxt = e.all ? `It meets all ${e.total} of your criteria.` : `It meets ${e.passed} of ${e.total} criteria; it misses ${e.checks.filter((k) => !k.pass).map((k) => k.label.toLowerCase()).join(', ')}.`;
    const best = ['A', 'B', 'F'].map((id) => ({ id, m: a.pt[id] })).sort((x, y) => x.m - y.m)[0];
    const why = `${passTxt} Your shortest trip is to ${T.ANCHORS.find((x) => x.id === best.id).label} (${best.m} min). ` +
      `Nights here are about ${Math.round(a.noiseNight)} dB, and the walk to the nearest stop rises at most ${a.slopeStop.toFixed(1)} %.` +
      (a.sun > 30 ? ' The best facade gets plenty of winter sun.' : '');
    const floor = l.floor === 0 ? 'Ground floor' : `Floor ${l.floor} of ${l.floors - 1}`;
    const risk = (a.runoff > 0 || a.flood !== 'none' || a.contaminated) ? 'Has risk notes' : 'No risk notes';

    $('#results').innerHTML = `
      <div class="detail">
        <button class="btn back" id="back">← All results</button>
        <div class="gallery">
          <img class="main" src="${big}" alt="${kinds.find((k) => k[0] === galleryKind)[1]} illustration for ${esc(l.street)}">
          <div class="thumbs" role="group" aria-label="Pictures">
            ${kinds.map(([k, lab]) => `<button data-k="${k}" aria-pressed="${k === galleryKind}"><img src="${P.render(k, l, 320, 200, colors)}" alt=""><span>${lab}</span></button>`).join('')}
          </div>
        </div>
        <div class="d-title">
          <div class="top" style="display:flex;justify-content:space-between;align-items:baseline"><span class="price" style="font-size:22px">${chf(l.rent)}<small style="font:400 13px var(--body);color:var(--muted)"> / month</small></span><span class="badge">Synthetic listing ${l.id}</span></div>
          <h2>${l.rooms.toFixed(1)} rooms, ${l.area} m² in ${esc(a.hood)}</h2>
          <div class="addr">${esc(l.street)} · ${esc(a.muni)} · ${floor} · built ${l.year} · ${l.balcony ? 'balcony' : 'no balcony'} · available ${l.available}</div>
        </div>
        <div class="why">${esc(why)}</div>
        <div class="group"><h4>Your week · ${fmtWeek(l.weekly)} travelling</h4>
          ${metric('Work A, public transport', a.pt.A + ' min', chk.ptA.pass)}
          ${metric('Work B, public transport', a.pt.B + ' min', chk.ptB.pass)}
          ${metric('Grandparents, public transport', a.pt.F + ' min', chk.ptF.pass)}
          ${metric('Work A / B by car (peak ×1.3)', `${a.car.A} / ${a.car.B} min`, null)}
        </div>
        <div class="group"><h4>Quiet and sun</h4>
          ${metric('Night noise, all sources', Math.round(a.noiseNight) + ' dB', chk.noise.pass)}
          ${metric('· road / rail / aircraft', `${Math.round(a.road)} / ${Math.round(a.rail)} / ${Math.round(a.air)} dB`, null)}
          ${metric('Winter sun, best facade (Dec)', a.sun.toFixed(0) + ' kWh/m²', null)}
        </div>
        <div class="group"><h4>Walking</h4>
          ${metric('Max slope, walk to nearest stop', a.slopeStop.toFixed(1) + ' %', chk.slope.pass)}
          ${metric('Max slope within 300 m', a.slope300.toFixed(1) + ' %', null)}
          ${metric('Stairs on the way to stops', a.steps ? a.steps + ' flights' : 'none', null)}
          ${metric('Supermarket / green space', `${a.shopMin} / ${a.greenMin} min walk`, null)}
        </div>
        <div class="group"><h4>Risk · ${risk}</h4>
          ${metric('Heavy-rain runoff (100-year)', a.runoff ? a.runoff + ' cm' : 'none', crit.noFlood ? a.runoff === 0 : null)}
          ${metric('River or lake flooding', a.flood, crit.noFlood ? a.flood === 'none' : null)}
          ${metric('Night heat class', a.heat + ' / 4', chk.heat.pass)}
          ${metric('Contaminated-site register', a.contaminated ? 'plot listed' : 'not listed', null)}
        </div>
        <div class="group"><h4>Money</h4>
          ${metric('Rent', chf(l.rent), chk.rent.pass)}
          ${metric('Municipal tax rate', a.tax + ' %', null)}
        </div>
        <p class="foot">Synthetic demo. Pictures are generated illustrations, the map is schematic, and every value is generated. The real product would use GTFS, sonBASE, Sonnenfassade, swissALTI3D and canton Zurich hazard data.</p>
      </div>`;
    $('#back').addEventListener('click', () => { selected = null; renderResults(renderTrace(false)); draw(); });
    $('#results').querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => { galleryKind = b.dataset.k; renderDetail(); }));
    $('#results').scrollTop = 0; document.querySelector('.right').scrollTop = 0;
  }

  function select(id) {
    selected = listings.find((l) => l.id === id) || null;
    galleryKind = 'exterior';
    renderResults(null);
    draw();
  }

  /* ---------- chat ---------- */
  function addMsg(who, html, raw) {
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    if (raw) d.innerHTML = html; else d.textContent = html;
    $('#chat').appendChild(d);
    d.scrollIntoView({ block: 'nearest' });
  }
  function interpret(text) {
    const t = text.toLowerCase();
    const ch = {}; const notes = [];
    const money = t.match(/(?:under|below|max|up to|bis|unter|<)\s*(?:chf\s*)?(\d[\d'’ ]{2,})/);
    if (money) { const v = +money[1].replace(/[^\d]/g, ''); if (v >= 1000) { ch.rent = Math.min(7000, v); notes.push(`rent ≤ ${chf(ch.rent)}`); } }
    const rooms = t.match(/(\d(?:[.,]5)?)\s*(?:rooms?|zimmer|zi)/);
    if (rooms) { ch.rooms = +rooms[1].replace(',', '.'); notes.push(`at least ${ch.rooms.toFixed(1)} rooms`); }
    const mins = t.match(/(\d{1,2})\s*min/);
    if (mins) {
      const v = +mins[1];
      if (/work a|oerlikon/.test(t)) ch.ptA = v;
      else if (/work b|west/.test(t)) ch.ptB = v;
      else if (/grand|parents|wollishofen|family/.test(t)) ch.ptF = v;
      else { ch.ptA = v; ch.ptB = v; }
      notes.push(Object.keys(ch).filter((k) => k.startsWith('pt')).map((k) => `${k === 'ptA' ? 'Work A' : k === 'ptB' ? 'Work B' : 'Grandparents'} ≤ ${v} min`).join(', '));
    }
    if (/very quiet|super quiet/.test(t)) { ch.noise = 40; notes.push('night noise ≤ 40 dB'); }
    else if (/quiet|leise|noise/.test(t)) { ch.noise = Math.max(34, crit.noise - 3); notes.push(`night noise ≤ ${ch.noise} dB`); }
    if (/flat|no hill|stroller|pram|wheelchair|kinderwagen/.test(t)) { ch.slope = 4; notes.push('max slope 4 % on the walk to the stop'); }
    if (/(ignore|don.t care).*(flood)/.test(t)) { ch.noFlood = false; notes.push('flood-prone buildings allowed'); }
    else if (/flood/.test(t)) { ch.noFlood = true; notes.push('flood-prone buildings excluded'); }
    if (/cool|heat|hot/.test(t)) { ch.heat = 2; notes.push('night heat class ≤ 2'); }
    if (/cheaper/.test(t) && ch.rent === undefined) { ch.rent = Math.max(1500, crit.rent - 300); notes.push(`rent ≤ ${chf(ch.rent)}`); }
    if (/bigger|larger|more space/.test(t) && ch.rooms === undefined) { ch.rooms = Math.min(6.5, crit.rooms + 1); notes.push(`at least ${ch.rooms.toFixed(1)} rooms`); }
    if (/reset|start over/.test(t)) { Object.assign(ch, T.DEFAULTS); notes.length = 0; notes.push('back to the original criteria'); }
    return { ch, notes: notes.filter(Boolean) };
  }
  function ask(text) {
    if (!text.trim()) return;
    addMsg('user', text);
    const { ch, notes } = interpret(text);
    if (!Object.keys(ch).length) {
      addMsg('agent', 'I couldn’t map that to a criterion yet. Try “quieter”, “max 30 min to Work B”, “under 3500”, “4.5 rooms” or “flat walk”.');
      return;
    }
    setCrit(ch);
    const n = results.match.length;
    addMsg('agent', `Updated: ${esc(notes.join('; '))}. <b>${n} home${n === 1 ? '' : 's'}</b> match now${n < 6 ? ', and the critic has a suggestion on the right' : ''}.`, true);
  }
  $('#composer').addEventListener('submit', (ev) => { ev.preventDefault(); const i = $('#ask'); ask(i.value); i.value = ''; });
  const SUGG = ['Make it quieter', 'Max 30 min to Work B', 'Flat walk, we have a pram', 'Bigger: 4.5 rooms', 'Cool nights in summer', 'Reset'];
  $('#suggest').innerHTML = SUGG.map((s) => `<button type="button">${s}</button>`).join('');
  $('#suggest').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));

  /* ---------- map ---------- */
  const canvas = $('#map'), ctx = canvas.getContext('2d');
  let view = { s: 1, ox: 0, oy: 0 };
  const LAYERS = [
    ['match', 'Matches'], ['travel', 'Weekly travel'], ['noise', 'Night noise'], ['slope', 'Slope'], ['heat', 'Night heat'], ['risk', 'Flood risk']
  ];
  $('#layers').innerHTML = LAYERS.map(([k, l]) => `<button data-l="${k}" aria-pressed="${k === layer}">${l}</button>`).join('');
  $('#layers').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    layer = b.dataset.l;
    $('#layers').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    draw(); renderLegend();
  }));

  const RAMPS = {
    travel: { stops: [[34, 140, 90], [240, 200, 80], [200, 60, 60]], lo: 180, hi: 600, unit: 'min/week', get: (a) => T.weekly(a) },
    noise: { stops: [[250, 240, 205], [235, 150, 70], [150, 30, 70]], lo: 34, hi: 55, unit: 'dB', get: (a) => a.noiseNight },
    slope: { stops: [[225, 235, 220], [150, 170, 110], [95, 70, 40]], lo: 0, hi: 14, unit: '%', get: (a) => a.slopeStop },
    heat: { stops: [[120, 170, 210], [245, 210, 120], [205, 60, 50]], lo: 1, hi: 4, unit: 'class', get: (a) => a.heat }
  };
  function rampColor(r, v, alpha) {
    let t = Math.max(0, Math.min(1, (v - r.lo) / (r.hi - r.lo)));
    const seg = t * (r.stops.length - 1), i = Math.min(r.stops.length - 2, Math.floor(seg)), f = seg - i;
    const c = r.stops[i].map((x, k) => Math.round(x + (r.stops[i + 1][k] - x) * f));
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }
  function hexToRgba(hex, a) {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function renderLegend() {
    const lg = $('#legend');
    if (layer === 'match') {
      const acc = css('--accent');
      lg.innerHTML = `<b>Areas that fit your places and environment criteria</b>
        <div class="row"><span class="sw" style="background:${hexToRgba(acc, 0.55)}"></span>All criteria met</div>
        <div class="row"><span class="sw" style="background:${hexToRgba(acc, 0.2)}"></span>One criterion off</div>
        <div class="row"><span class="sw" style="background:${acc};border-radius:50%"></span>Matching home · <span class="sw" style="border:2px solid ${acc};border-radius:50%"></span>near miss</div>`;
    } else if (layer === 'risk') {
      lg.innerHTML = `<b>Flood risk (runoff + river)</b>
        <div class="row"><span class="sw" style="background:rgba(70,130,200,0.35)"></span>Runoff 10 cm or low river hazard</div>
        <div class="row"><span class="sw" style="background:rgba(30,70,170,0.65)"></span>Runoff 30 cm or medium river hazard</div>`;
    } else {
      const r = RAMPS[layer];
      const g = `linear-gradient(90deg, ${r.stops.map((s) => `rgb(${s.join(',')})`).join(',')})`;
      const title = { travel: 'Your weekly travel time (all three places)', noise: 'Night noise, road + rail + aircraft', slope: 'Max slope on the walk to the nearest stop', heat: 'Night heat class' }[layer];
      lg.innerHTML = `<b>${title}</b><div class="ramp" style="background:${g}"></div><div class="ends"><span>${r.lo} ${r.unit}</span><span>${r.hi} ${r.unit}</span></div>`;
    }
  }

  // Camera: world point at the centre of the free map area + zoom factor.
  // Recomputed on every resize, so the map always refits to the pane.
  const FIT = { x0: 20, y0: 10, x1: 990, y1: 790 };           // world box shown at zoom 1
  let cam = { cx: (FIT.x0 + FIT.x1) / 2, cy: (FIT.y0 + FIT.y1) / 2, zoom: 1 };
  const TOP = 54, BOTTOM = 12, SIDE = 12;                       // room for the layer bar
  function baseScale(w, h) {
    return Math.min((w - SIDE * 2) / (FIT.x1 - FIT.x0), (h - TOP - BOTTOM) / (FIT.y1 - FIT.y0));
  }
  function applyCam() {
    const s = view.base * cam.zoom;
    const mx = view.w / 2, my = TOP + (view.h - TOP - BOTTOM) / 2;
    view.s = s; view.ox = mx - cam.cx * s; view.oy = my - cam.cy * s;
  }
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    view = { dpr, w: r.width, h: r.height, base: baseScale(r.width, r.height) };
    applyCam();
    draw();
  }
  function zoomAt(f, sx, sy) {
    const nz = Math.max(1, Math.min(6, cam.zoom * f));
    const wx = (sx - view.ox) / view.s, wy = (sy - view.oy) / view.s;   // world point under cursor
    cam.zoom = nz;
    const s = view.base * nz, mx = view.w / 2, my = TOP + (view.h - TOP - BOTTOM) / 2;
    cam.cx = wx - (sx - mx) / s;                                         // keep it under the cursor
    cam.cy = wy - (sy - my) / s;
    applyCam(); draw();
  }
  function fit() { cam = { cx: (FIT.x0 + FIT.x1) / 2, cy: (FIT.y0 + FIT.y1) / 2, zoom: 1 }; applyCam(); draw(); }
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });
  let drag = null;
  canvas.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, moved: 0 }; canvas.setPointerCapture(ev.pointerId); });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = ev.clientX; drag.y = ev.clientY;
    if (drag.moved > 4) {
      canvas.classList.add('dragging'); $('#tip').style.display = 'none';
      cam.cx -= dx / view.s; cam.cy -= dy / view.s; applyCam(); draw();
    }
  });
  canvas.addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); canvas.classList.remove('dragging'); });
  canvas.addEventListener('dblclick', () => fit());
  $('#zin').addEventListener('click', () => zoomAt(1.4, view.w / 2, TOP + (view.h - TOP - BOTTOM) / 2));
  $('#zout').addEventListener('click', () => zoomAt(1 / 1.4, view.w / 2, TOP + (view.h - TOP - BOTTOM) / 2));
  $('#zfit').addEventListener('click', fit);
  window.addEventListener('resize', resize);
  const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + y * view.s;
  function path(pts, close) {
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); if (close) ctx.closePath();
  }
  function hex(cx, cy, r) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const ang = Math.PI / 180 * (60 * k - 30); const px = X(cx + r * Math.cos(ang)), py = Y(cy + r * Math.sin(ang)); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }

  function draw() {
    const { dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css('--map-land'); ctx.fillRect(0, 0, view.w, view.h);
    const acc = css('--accent');

    // scope halo
    ctx.save();
    ctx.beginPath(); ctx.ellipse(X(480), Y(410), 540 * view.s, 450 * view.s, 0, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(css('--panel'), 0.55); ctx.fill();
    ctx.restore();

    // hill shading
    T.HILLS.forEach((h) => {
      const gr = ctx.createRadialGradient(X(h.x), Y(h.y), 2, X(h.x), Y(h.y), Math.max(h.sx, h.sy) * view.s * 1.6);
      gr.addColorStop(0, 'rgba(110,130,90,0.22)'); gr.addColorStop(1, 'rgba(110,130,90,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, view.w, view.h);
    });

    // cells
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; let fill = null;
      if (layer === 'match') {
        const e = results.cellEval[i];
        if (e.all) fill = hexToRgba(acc, 0.5); else if (e.passed === e.total - 1) fill = hexToRgba(acc, 0.17);
      } else if (layer === 'risk') {
        const a = c.a;
        if (a.runoff >= 30 || a.flood === 'medium') fill = 'rgba(30,70,170,0.6)';
        else if (a.runoff > 0 || a.flood === 'low') fill = 'rgba(70,130,200,0.32)';
      } else {
        const r = RAMPS[layer]; fill = rampColor(r, r.get(c.a), 0.62);
      }
      if (fill) { hex(c.x, c.y, R_HEX * 0.98); ctx.fillStyle = fill; ctx.fill(); }
    }

    // lake + rivers
    path(T.LAKE, true); ctx.fillStyle = css('--map-water'); ctx.fill();
    ctx.strokeStyle = css('--map-water'); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, 7 * view.s); path(T.LIMMAT); ctx.stroke();
    ctx.lineWidth = Math.max(2, 5 * view.s); path(T.SIHL); ctx.stroke();

    // motorways + rail
    ctx.strokeStyle = css('--map-road'); ctx.lineWidth = Math.max(2.5, 6 * view.s);
    T.MOTORWAYS.forEach((m) => { path(m); ctx.stroke(); });
    ctx.strokeStyle = css('--map-rail'); ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]);
    T.RAIL.forEach((m) => { path(m); ctx.stroke(); });
    ctx.setLineDash([]);

    // city boundary
    path(T.CITY, true); ctx.strokeStyle = css('--map-boundary'); ctx.lineWidth = 1.6; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);

    // airport
    ctx.save(); ctx.translate(X(T.AIRPORT[0]), Y(T.AIRPORT[1])); ctx.rotate(-0.35);
    ctx.fillStyle = css('--map-rail'); ctx.fillRect(-46 * view.s, -3, 92 * view.s, 6); ctx.restore();

    // labels
    ctx.textAlign = 'center';
    ctx.fillStyle = css('--map-label');
    ctx.font = `500 ${Math.max(10, Math.min(14, 12 * view.s))}px "IBM Plex Sans", sans-serif`;
    T.HOODS.forEach((h) => ctx.fillText(h[0], X(h[1]), Y(h[2]) - 14));
    ctx.font = `italic 400 ${Math.max(9.5, Math.min(13, 11 * view.s))}px "IBM Plex Sans", sans-serif`;
    const MUNI_POS = { 'Dübendorf': [900, 395], 'Wallisellen': [800, 120], 'Opfikon': [690, 40], 'Rümlang': [470, 22], 'Regensdorf': [220, 70], 'Oberengstringen': [85, 165], 'Schlieren': [40, 320], 'Urdorf': [70, 560], 'Uitikon': [170, 610], 'Stallikon': [235, 760], 'Adliswil': [380, 770], 'Kilchberg': [560, 712], 'Zollikon': [770, 560], 'Fällanden': [930, 470] };
    for (const k in MUNI_POS) { const p = MUNI_POS[k]; ctx.fillText(k, X(p[0]), Y(p[1])); }
    ctx.font = `700 ${Math.max(11, Math.min(16, 13 * view.s))}px "Archivo", sans-serif`; ctx.fillStyle = css('--map-boundary');
    ctx.fillText('ZÜRICH', X(520), Y(395));
    ctx.font = `italic 400 ${Math.max(10, Math.min(14, 12 * view.s))}px "IBM Plex Sans", sans-serif`; ctx.fillStyle = css('--accent');
    ctx.fillText('Zürichsee', X(720), Y(690));
    ctx.fillStyle = css('--map-label'); ctx.fillText('Airport', X(T.AIRPORT[0]), Y(T.AIRPORT[1]) + 18);
    ctx.textAlign = 'left';

    // selected: lines to anchors
    if (selected) {
      T.ANCHORS.forEach((an) => {
        ctx.strokeStyle = acc; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(X(selected.x), Y(selected.y)); ctx.lineTo(X(an.x), Y(an.y)); ctx.stroke(); ctx.setLineDash([]);
        const mx = X((selected.x + an.x) / 2), my = Y((selected.y + an.y) / 2);
        const txt = selected.a.pt[an.id] + ' min';
        ctx.font = '600 11.5px "IBM Plex Mono", monospace';
        const tw = ctx.measureText(txt).width + 10;
        ctx.fillStyle = css('--panel'); ctx.fillRect(mx - tw / 2, my - 9, tw, 18);
        ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.strokeRect(mx - tw / 2, my - 9, tw, 18);
        ctx.fillStyle = acc; ctx.textAlign = 'center'; ctx.fillText(txt, mx, my + 4); ctx.textAlign = 'left';
      });
    }

    // listings
    const matchIds = new Set(results.match.map((x) => x.l.id)), nearIds = new Set(results.near.map((x) => x.l.id));
    listings.forEach((l) => {
      const isM = matchIds.has(l.id), isN = nearIds.has(l.id);
      const isSel = selected && selected.id === l.id, isHov = hoverId === l.id;
      if (!isM && !isN && !isSel) {
        ctx.fillStyle = hexToRgba(css('--muted'), 0.45); ctx.beginPath(); ctx.arc(X(l.x), Y(l.y), 2.2, 0, Math.PI * 2); ctx.fill();
        return;
      }
      const r = isSel || isHov ? 9 : isM ? 6.5 : 5;
      ctx.beginPath(); ctx.arc(X(l.x), Y(l.y), r, 0, Math.PI * 2);
      if (isM || isSel) { ctx.fillStyle = acc; ctx.fill(); ctx.strokeStyle = css('--panel'); ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.fillStyle = css('--panel'); ctx.fill(); ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke(); }
      if (isSel || isHov) {
        const txt = chf(l.rent);
        ctx.font = '600 12px "IBM Plex Sans", sans-serif';
        const tw = ctx.measureText(txt).width + 12;
        ctx.fillStyle = css('--ink'); ctx.fillRect(X(l.x) - tw / 2, Y(l.y) - 32, tw, 20);
        ctx.fillStyle = css('--panel'); ctx.textAlign = 'center'; ctx.fillText(txt, X(l.x), Y(l.y) - 18); ctx.textAlign = 'left';
      }
    });

    // anchors
    T.ANCHORS.forEach((an) => {
      const x = X(an.x), y = Y(an.y);
      ctx.fillStyle = css('--ink'); ctx.fillRect(x - 11, y - 11, 22, 22);
      ctx.fillStyle = css('--panel'); ctx.font = '700 12px "Archivo", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(an.id, x, y + 4.5);
      ctx.fillStyle = css('--ink'); ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillText(an.label, x, y + 26); ctx.textAlign = 'left';
    });
  }

  function toWorld(ev) {
    const r = canvas.getBoundingClientRect();
    return [(ev.clientX - r.left - view.ox) / view.s, (ev.clientY - r.top - view.oy) / view.s, ev.clientX - r.left, ev.clientY - r.top];
  }
  function nearestListing(wx, wy, maxPx) {
    let best = null, bd = 1e9;
    const visible = new Set(results.match.map((x) => x.l.id).concat(results.near.map((x) => x.l.id)));
    listings.forEach((l) => { if (!visible.has(l.id)) return; const d = Math.hypot(l.x - wx, l.y - wy) * view.s; if (d < bd) { bd = d; best = l; } });
    return bd <= maxPx ? best : null;
  }
  canvas.addEventListener('mousemove', (ev) => {
    const [wx, wy, sx, sy] = toWorld(ev);
    const tip = $('#tip');
    const l = nearestListing(wx, wy, 12);
    if (l) {
      canvas.style.cursor = 'pointer';
      tip.innerHTML = `<b>${chf(l.rent)} · ${l.rooms.toFixed(1)} rooms</b><br>${esc(l.street)}, ${esc(l.a.hood)}<br><span style="color:var(--muted)">Click to open</span>`;
    } else {
      canvas.style.cursor = 'crosshair';
      let best = null, bd = 1e9;
      for (const c of cells) { const d = (c.x - wx) ** 2 + (c.y - wy) ** 2; if (d < bd) { bd = d; best = c; } }
      if (!best || bd > (R_HEX * 1.2) ** 2) { tip.style.display = 'none'; return; }
      const a = best.a;
      tip.innerHTML = `<b>${esc(a.hood)}</b>${a.city ? '' : ''} <span style="color:var(--muted)">· ${esc(a.muni)}</span>
        <table>
          <tr><td>To Work A / B / F</td><td>${a.pt.A} / ${a.pt.B} / ${a.pt.F} min</td></tr>
          <tr><td>Weekly travel</td><td>${fmtWeek(T.weekly(a))}</td></tr>
          <tr><td>Night noise</td><td>${Math.round(a.noiseNight)} dB</td></tr>
          <tr><td>Slope to stop</td><td>${a.slopeStop.toFixed(1)} %</td></tr>
          <tr><td>Night heat</td><td>${a.heat} / 4</td></tr>
          <tr><td>Tax rate</td><td>${a.tax} %</td></tr>
        </table>`;
    }
    tip.style.display = 'block';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(view.w - tw - 8, sx + 14) + 'px';
    tip.style.top = Math.min(view.h - th - 8, sy + 14) + 'px';
  });
  canvas.addEventListener('mouseleave', () => { $('#tip').style.display = 'none'; });
  canvas.addEventListener('click', (ev) => {
    if (drag && drag.moved > 4) return;
    const [wx, wy] = toWorld(ev);
    const l = nearestListing(wx, wy, 14);
    if (l) select(l.id);
  });

  /* ---------- run ---------- */
  function run(animate) {
    compute();
    const sug = renderTrace(animate);
    renderResults(sug);
    draw();
  }

  addMsg('user', 'We need 3.5 rooms under CHF 3,800. Max 25 min to both offices and about 35 to my parents in Wollishofen. Quiet at night, no steep walk to the tram, and nothing that floods.');
  renderControls();
  compute();
  addMsg('agent', `Here’s how I read that. Every number is editable below.
    <ul><li>3.5+ rooms, rent ≤ CHF 3’800</li><li>Work A and B ≤ 25 min, Grandparents ≤ 35 min by public transport</li>
    <li>“Quiet” = night noise ≤ 45 dB (road + rail + aircraft)</li><li>“No steep walk” = max 6 % on the way to your stop</li>
    <li>No heavy-rain runoff and no river flood hazard</li></ul>
    I found <b>${results.match.length} homes</b>. They’re ranked by how long you’d travel each week.`, true);
  new ResizeObserver(resize).observe(canvas.parentElement);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderLegend(); draw(); });
  new MutationObserver(() => { renderLegend(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  renderLegend();
  run(true);
})();
