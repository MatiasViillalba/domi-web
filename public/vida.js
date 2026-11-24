// Vida de la web: sonidos de interfaz sintetizados (sin archivos), fondo que sigue al mouse,
// aparición de bloques al hacer scroll y el cierre con la simulación.
(() => {
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Sonidos suaves, generados en el navegador ----------
  let activo = true;
  let ctx, master, eco;
  function audio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.22;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    // eco corto y suave para que no suene "seco"
    eco = ctx.createDelay(); eco.delayTime.value = 0.13;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    const ecoVol = ctx.createGain(); ecoVol.gain.value = 0.28;
    eco.connect(fb); fb.connect(eco); eco.connect(ecoVol); ecoVol.connect(lp);
    master.connect(lp); master.connect(eco); lp.connect(ctx.destination);
    return ctx;
  }
  function nota(f, t0, dur, vol = 1, tipo = 'sine', fFin) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t0);
    if (fFin) o.frequency.exponentialRampToValueAtTime(fFin, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function aire(t0, dur, vol, desde, hasta) {
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(desde, t0); bp.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur);
  }
  const SON = {
    escuchar: null, // a pedido: sin sonido
    pensar: (t) => { aire(t, 0.55, 0.18, 500, 2200); nota(392, t + 0.05, 0.5, 0.12, 'sine'); },
    responder: (t) => { [523.25, 659.25, 783.99].forEach((f, i) => nota(f, t + i * 0.07, 0.6, 0.22, 'sine')); },
    viajar: (t) => { aire(t, 0.45, 0.2, 400, 3000); },
    entender: (t) => { nota(880, t, 0.25, 0.16, 'triangle'); nota(1318.5, t + 0.09, 0.4, 0.14, 'sine'); },
    tapa: (t) => { nota(220, t, 0.16, 0.5, 'sine', 90); nota(660, t + 0.12, 0.22, 0.14, 'sine'); nota(440, t + 0.22, 0.32, 0.12, 'sine'); },
    tic: (t) => { nota(1400, t, 0.06, 0.08, 'sine', 1100); },
    nav: (t) => { aire(t, 0.25, 0.08, 1200, 2600); },
    abrir: (t) => { aire(t, 0.7, 0.16, 300, 3200); [392, 523.25, 659.25, 1046.5].forEach((f, i) => nota(f, t + 0.12 + i * 0.08, 0.9, 0.14, 'sine')); },
    cerrar: (t) => { [784, 587.33, 392].forEach((f, i) => nota(f, t + i * 0.07, 0.45, 0.13, 'sine')); },
    oro: (t) => { [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => nota(f, t + i * 0.055, 0.7, 0.1, 'sine')); aire(t, 0.9, 0.06, 4000, 9000); },
  };
  function sonar(clave) {
    if (!activo || !SON[clave]) return;
    const c = audio(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    SON[clave](c.currentTime + 0.01);
  }
  window.domiSonar = sonar;

  const b = document.createElement('button');
  b.type = 'button'; b.className = 'boton-sonido';
  const pintar = () => { b.setAttribute('aria-pressed', String(activo)); b.innerHTML = activo ? '<span aria-hidden="true">🔊</span> Sonido' : '<span aria-hidden="true">🔇</span> Sin sonido'; b.title = activo ? 'Silenciar efectos' : 'Activar efectos de sonido'; };
  pintar();
  b.addEventListener('click', () => { activo = !activo; try { localStorage.setItem('domi-sonido', activo ? 'si' : 'no'); } catch {} pintar(); if (activo) sonar('tic'); });
  // (botón de sonido quitado a pedido: los efectos quedan siempre activos)
  // El navegador habilita el audio con el primer clic o tecla
  const desbloquear = () => { const c = audio(); if (c && c.state === 'suspended') c.resume(); };
  addEventListener('pointerdown', desbloquear, { once: true, capture: true });
  addEventListener('keydown', desbloquear, { once: true, capture: true });

  const porEstado = { escuchando: 'escuchar', pensando: 'pensar', respondiendo: 'responder' };
  const esActivo = (el) => [...el.classList].some((c) => /activ|on$|actual/.test(c)) || el.getAttribute('aria-current') === 'true';
  function vigilar(lista, alActivar) {
    if (!lista) return;
    const previo = new WeakMap();
    const revisar = () => lista.querySelectorAll(':scope > li').forEach((li, i) => {
      const ahora = esActivo(li);
      if (ahora && !previo.get(li)) alActivar(li, i);
      previo.set(li, ahora);
    });
    new MutationObserver(revisar).observe(lista, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
    revisar();
  }
  let listo = false; setTimeout(() => { listo = true; }, 1500);
  vigilar(document.getElementById('lista-estados'), (li) => listo && sonar(porEstado[li.dataset.estado]));
  vigilar(document.getElementById('pasos'), (li, i) => listo && sonar([null, 'viajar', 'entender', 'responder'][i]));

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t || t === b) return;
    if (t.id === 'btn-privacidad') return sonar('tapa');
    if (t.id === 'jugar-simulacion') return; // tiene su propio sonido
    if (t.matches('[data-explorar]')) return sonar('abrir');
    if (t.closest('#personaliza') || t.closest('#interior') || t.closest('.lamina')) return sonar('tic');
    if (t.closest('nav') && t.getAttribute('href')?.startsWith('#')) return sonar('nav');
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('explorando')) sonar('cerrar'); });

  // ---------- Luz de fondo que sigue al mouse ----------
  if (!reducido && matchMedia('(hover: hover)').matches) {
    let cuadro = 0, ev;
    addEventListener('pointermove', (e) => {
      ev = e; if (cuadro) return;
      cuadro = requestAnimationFrame(() => { cuadro = 0; document.documentElement.style.setProperty('--mx', ev.clientX + 'px'); document.documentElement.style.setProperty('--my', ev.clientY + 'px'); });
    }, { passive: true });
  }

  // ---------- Aparición al hacer scroll ----------
  const aparecen = document.querySelectorAll('.cmp-tabla .cmp-fila:not(.cmp-cabeza), .plano h2, .plano .cuerpo, .precio, .paquete, .escena-uso, .panel-capturas figure, .galeria-laminas .lamina, .comparacion-ventajas li, .video-marco, .sim-texto > *, .sim-foto');
  if (!reducido && 'IntersectionObserver' in window) {
    aparecen.forEach((el, i) => { el.classList.add('aparece'); el.style.setProperty('--retraso', `${(el.classList.contains('cmp-fila') ? i % 6 : i % 4) * 90}ms`); });
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('visto'); io.unobserve(x.target); } }), { threshold: 0.15 });
    aparecen.forEach((el) => io.observe(el));
  }

  // ---------- Cierre: simulación ----------
  const foto = document.querySelector('.sim-foto');
  if (foto && !reducido && matchMedia('(hover: hover)').matches) {
    foto.addEventListener('pointermove', (e) => {
      const r = foto.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      foto.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`); foto.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      foto.style.setProperty('--lx', `${(x + 0.5) * 100}%`); foto.style.setProperty('--ly', `${(y + 0.5) * 100}%`);
    });
    foto.addEventListener('pointerleave', () => { foto.style.setProperty('--rx', '0deg'); foto.style.setProperty('--ry', '0deg'); });
  }
  const jugar = document.getElementById('jugar-simulacion');
  const dlg = document.getElementById('dialogo-simulacion');
  const vid = document.getElementById('video-simulacion');
  if (jugar && dlg && vid) {
    const INICIO = 116; // el recorrido del piso 12 empieza en el minuto 1:56 del video final
    function estallidoDorado(x, y) {
      if (reducido) return;
      const capa = document.createElement('div'); capa.className = 'estallido-oro';
      capa.style.setProperty('--x', `${x}px`); capa.style.setProperty('--y', `${y}px`);
      capa.innerHTML = '<span class="eo-flash"></span><span class="eo-anillo"></span><span class="eo-anillo a2"></span><span class="eo-anillo a3"></span><span class="eo-rayos"></span>';
      const W = innerWidth, H = innerHeight;
      for (let i = 0; i < 90; i++) {
        const p = document.createElement('i'); p.className = i % 3 ? 'eo-chispa' : 'eo-chispa larga';
        const ang = Math.random() * Math.PI * 2, dist = Math.hypot(W, H) * (0.25 + Math.random() * 0.6);
        p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`); p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
        p.style.setProperty('--r', `${(ang * 180 / Math.PI).toFixed(0)}deg`);
        p.style.setProperty('--t', `${(0.9 + Math.random() * 0.9).toFixed(2)}s`); p.style.setProperty('--d', `${(Math.random() * 0.25).toFixed(2)}s`);
        p.style.setProperty('--s', (0.5 + Math.random() * 1.2).toFixed(2));
        capa.append(p);
      }
      for (let i = 0; i < 40; i++) { // brillitos que caen por toda la pantalla
        const c = document.createElement('b'); c.className = 'eo-polvo';
        c.style.left = `${Math.random() * 100}%`; c.style.top = `${-10 - Math.random() * 20}%`;
        c.style.setProperty('--t', `${(1.6 + Math.random() * 1.4).toFixed(2)}s`); c.style.setProperty('--d', `${(0.2 + Math.random() * 0.6).toFixed(2)}s`);
        capa.append(c);
      }
      document.body.append(capa);
      document.body.classList.add('modo-oro');
      setTimeout(() => document.body.classList.remove('modo-oro'), 1800);
      setTimeout(() => capa.remove(), 3400);
    }
    jugar.addEventListener('click', (e) => {
      sonar('oro');
      { const r = jugar.getBoundingClientRect(); estallidoDorado(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2); }
      // chispas doradas desde el botón
      if (!reducido) for (let i = 0; i < 18; i++) {
        const s = document.createElement('span'); s.className = 'chispa';
        const r = jugar.getBoundingClientRect();
        s.style.left = `${e.clientX || r.left + r.width / 2}px`; s.style.top = `${e.clientY || r.top + r.height / 2}px`;
        const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 110;
        s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`); s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
        document.body.append(s); s.addEventListener('animationend', () => s.remove());
      }
      // Abre el juego real (DOMI · La oficina) con el enlace domi-oficina:// que registra «DOMI Jugar.app».
      // Si en esta compu no está instalado, a los 2,5 s se muestra el recorrido grabado.
      let seFue = false;
      const alIrse = () => { seFue = true; };
      addEventListener('blur', alIrse, { once: true });
      document.addEventListener('visibilitychange', alIrse, { once: true });
      setTimeout(() => { location.href = 'domi-oficina://jugar'; }, reducido ? 0 : 900);
      setTimeout(() => {
        removeEventListener('blur', alIrse);
        if (seFue) return;
        dlg.showModal();
        const ir = () => { try { vid.currentTime = INICIO; } catch {} vid.play().catch(() => {}); };
        if (vid.readyState >= 1) ir(); else vid.addEventListener('loadedmetadata', ir, { once: true });
      }, 3400);
    });
    dlg.querySelector('.sim-cerrar').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { vid.pause(); sonar('cerrar'); });
  }

  // ---------- Tocar la tapa del NODO 3D para apagar el micrófono ----------
  const btnPriv = document.getElementById('btn-privacidad');
  const etiquetas = document.getElementById('etiquetas');
  if (btnPriv && etiquetas) {
    const zona = document.createElement('button');
    zona.type = 'button'; zona.className = 'zona-tapa'; zona.setAttribute('aria-label', 'Tocar la tapa del NODO para apagar o encender el micrófono'); zona.hidden = true;
    zona.addEventListener('click', () => { btnPriv.click(); zona.blur(); });
    document.body.append(zona);
    const ubicar = () => {
      const ic = etiquetas.querySelector('[data-key="pr:ic"]'), tp = etiquetas.querySelector('[data-key="pr:tapa"]');
      const circ = etiquetas.querySelectorAll('svg.guias circle');
      const visible = ic && tp && getComputedStyle(ic).visibility === 'visible' && parseFloat(ic.style.opacity || getComputedStyle(ic).opacity) > 0.4 && !document.body.classList.contains('explorando');
      if (visible && circ.length >= 2) {
        // el orden de los círculos sigue el de las etiquetas
        const idx = [...etiquetas.querySelectorAll('.etq')].filter((e) => getComputedStyle(e).visibility === 'visible');
        const iIc = idx.indexOf(ic), iTp = idx.indexOf(tp);
        const a = circ[iIc] || circ[0], t = circ[iTp] || circ[1];
        const ra = a.getBoundingClientRect(), rt = t.getBoundingClientRect(); const x = ra.left + ra.width / 2, y = ra.top + ra.height / 2, x2 = rt.left + rt.width / 2, y2 = rt.top + rt.height / 2;
        const d = Math.min(Math.max(70, Math.hypot(x - x2, y - y2) * 2.3), Math.min(innerWidth, innerHeight) * 0.6);
        zona.style.left = `${x}px`; zona.style.top = `${y - d * 0.18}px`; zona.style.width = zona.style.height = `${d}px`;
        zona.hidden = false;
        zona.classList.toggle('apagado', btnPriv.getAttribute('aria-pressed') === 'true');
      } else zona.hidden = true;
      requestAnimationFrame(ubicar);
    };
    requestAnimationFrame(ubicar);
  }

  // ---------- Batería: por fuera / por dentro y números que cuentan ----------
  const visor = document.querySelector('.bat-visor');
  if (visor) {
    visor.querySelectorAll('.bat-toggle button').forEach((bt) => bt.addEventListener('click', () => {
      if (visor.dataset.vista === bt.dataset.v) return;
      visor.dataset.vista = bt.dataset.v;
      visor.querySelectorAll('.bat-toggle button').forEach((x) => x.setAttribute('aria-pressed', String(x === bt)));
      visor.classList.remove('escaneando'); void visor.offsetWidth; visor.classList.add('escaneando');
      sonar(bt.dataset.v === 'dentro' ? 'entender' : 'tic');
    }));
  }
  const nums = document.querySelectorAll('[data-contar]');
  if (nums.length && !reducido && 'IntersectionObserver' in window) {
    const io2 = new IntersectionObserver((es) => es.forEach((x) => {
      if (!x.isIntersecting) return; io2.unobserve(x.target);
      const el = x.target, fin = +el.dataset.contar, dec = +el.dataset.dec || 0, t0 = performance.now();
      const paso = (t) => { const k = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - k, 3); el.textContent = (fin * e).toFixed(dec).replace('.', ','); if (k < 1) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    }), { threshold: 0.6 });
    nums.forEach((n) => io2.observe(n));
  }

  // ---------- Diferenciales: íconos y luz que sigue al mouse ----------
  const ICONOS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path class="pulso" d="M9.5 15a3.5 3.5 0 0 1 5 0"/><circle cx="12" cy="17.5" r=".8" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle class="pulso" cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/><path class="pulso" d="M4 4l16 16"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3"/><rect class="pulso" x="5.5" y="9.5" width="7" height="5" rx="1" fill="currentColor" stroke="none"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M3 9h18"/><circle class="pulso" cx="7" cy="13.5" r="1.2" fill="currentColor"/><path d="M11 13.5h6"/></svg>',
  ];
  document.querySelectorAll('.comparacion-ventajas li').forEach((li, i) => {
    if (!li.querySelector('.ventaja-icono')) { const ic = document.createElement('span'); ic.className = 'ventaja-icono'; ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = ICONOS[i % ICONOS.length]; li.prepend(ic); }
    li.addEventListener('pointermove', (e) => { const r = li.getBoundingClientRect(); li.style.setProperty('--cx', `${e.clientX - r.left}px`); li.style.setProperty('--cy', `${e.clientY - r.top}px`); });
  });
})();
