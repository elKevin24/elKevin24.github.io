/* ── GLOBAL STATE ── */
let currentPartidos = [];
let currentQuinielaData = {};
let teamMetadata = {};

async function loadTeamMetadata() {
  try {
    const res = await fetch('metadata_equipos.json');
    if (res.ok) teamMetadata = await res.json();
  } catch (e) { console.warn('No se pudo cargar metadata_equipos.json'); }
}

function getBadge(name) {
  const team = teamMetadata[name.trim()];
  return team && team.badge ? team.badge : null;
}

/* ── FLAGS ── */
/* ── FLAG IMAGES via flagcdn.com ── */
const ISO = {
  'Mexico':'mx','South Africa':'za','South Korea':'kr','Canada':'ca',
  'Czech Republic':'cz','Bosnia & Herzegovina':'ba','Switzerland':'ch',
  'Qatar':'qa','Brazil':'br','Morocco':'ma','Haiti':'ht',
  'Scotland':'gb-sct','USA':'us','Paraguay':'py','Australia':'au',
  'Turkey':'tr','Germany':'de','Curaçao':'cw','Ivory Coast':'ci',
  'Ecuador':'ec','Netherlands':'nl','Japan':'jp','Sweden':'se',
  'Tunisia':'tn','Belgium':'be','Egypt':'eg','Iran':'ir',
  'New Zealand':'nz','Spain':'es','Cape Verde':'cv','Saudi Arabia':'sa',
  'Uruguay':'uy','France':'fr','Senegal':'sn','Norway':'no',
  'Iraq':'iq','Argentina':'ar','Algeria':'dz','Austria':'at',
  'Jordan':'jo','Portugal':'pt','DR Congo':'cd','Uzbekistan':'uz',
  'Colombia':'co','England':'gb-eng','Croatia':'hr','Ghana':'gh','Panama':'pa',
};

// Returns an <img> tag with the real flag image
function flag(name, h = 18) {
  const badgeUrl = getBadge(name);
  if (badgeUrl) {
    return `<img src="${badgeUrl}" alt="${name}" title="${name}" class="team-badge" style="height:${h}px; width:auto;">`;
  }
  const code = ISO[name];
  if (!code) return '<span style="font-size:16px;">⚽</span>';
  const size = h <= 14 ? '16x12' : '24x18';
  return `<img src="https://flagcdn.com/${size}/${code}.png" alt="${name}" title="${name}" style="height:${h}px;vertical-align:middle;border-radius:2px;display:inline-block;flex-shrink:0;" loading="lazy" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
}

/* ── SCORING ── */
function calcPuntos(real, pred) {
  if (!real || pred == null) return null;
  const rl = real.local,   rv = real.visitante;
  const pl = pred.local,   pv = pred.visitante;
  if (rl === pl && rv === pv) return { pts: 3, tipo: 'exact' };
  const rt = rl > rv ? 'L' : rl < rv ? 'V' : 'E';
  const pt = pl > pv ? 'L' : pl < pv ? 'V' : 'E';
  const matchedAnyScore = pl === rl || pv === rv;
  if (rt === pt && rt !== 'E' && matchedAnyScore) {
    return { pts: 2, tipo: 'diff' };
  }
  if (rt === pt || matchedAnyScore) {
    return { pts: 1, tipo: 'trend' };
  }
  return { pts: 0, tipo: 'zero' };
}

/* ── HELPERS ── */
const MONTHS = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${parseInt(day)} ${MONTHS[parseInt(m)]} ${y}`;
}
// Adds flag emojis to a 'TeamA vs TeamB' string
function fmtPartido(str) {
  if (!str || !str.includes(' vs ')) return str;
  const [a, b] = str.split(' vs ');
  return `${flag(a.trim())} ${a.trim()} vs ${flag(b.trim())} ${b.trim()}`;
}
// Format a full datetime string into the specified timezone (default: Guatemala)
function formatDateTimeFor(dateStr, timeZone = 'America/Guatemala') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  try {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone,
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

// Mark partidos as live if current time is within +/- windowMin minutes of their datetime
function markLive(partidos, windowMin = 120) {
  if (!partidos || !partidos.forEach) return;
  const now = Date.now();
  partidos.forEach(p => {
    p.live = false;
    if (!p || !p.fecha) return;
    const ts = Date.parse(p.fecha);
    if (isNaN(ts)) return; // no time info available
    p.live = Math.abs(now - ts) <= windowMin * 60 * 1000;
  });
}
function isToday(d) {
  const t = new Date();
  return d === `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

/* ── TABS ── */
function showTab(name, btn) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  
  if (btn) {
    btn.classList.add('active');
  } else {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(b => {
      const clickAttr = b.getAttribute('onclick');
      if (clickAttr && clickAttr.includes(`'${name}'`)) {
        b.classList.add('active');
      }
    });
  }
  sessionStorage.setItem('activeTab', name);
}

/* ── SYNC STATUS BADGE ── */
function updateSyncStatus(status, text) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const dot = el.querySelector('.sync-dot');
  
  const textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim());
  if (textNode) {
    textNode.nodeValue = ' ' + text;
  } else {
    el.appendChild(document.createTextNode(' ' + text));
  }

  if (status === 'success') {
    dot.className = 'sync-dot'; 
    dot.style.background = 'var(--green)';
    el.style.color = 'var(--green)';
    el.style.borderColor = 'rgba(34, 197, 94, 0.2)';
    el.style.background = 'rgba(34, 197, 94, 0.05)';
  } else if (status === 'error') {
    dot.className = 'sync-dot'; 
    dot.style.background = 'var(--red)';
    el.style.color = 'var(--red)';
    el.style.borderColor = 'rgba(248, 113, 113, 0.2)';
    el.style.background = 'rgba(248, 113, 113, 0.05)';
  } else {
    dot.className = 'sync-dot pulse'; 
    dot.style.background = 'var(--amber)';
    el.style.color = 'var(--amber)';
    el.style.borderColor = 'rgba(251, 191, 36, 0.2)';
    el.style.background = 'rgba(251, 191, 36, 0.05)';
  }
}

/* ── SEARCH STANDINGS ── */
let filterTimeout = null;
function filterStandings() {
  if (filterTimeout) clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    _executeFilterStandings();
  }, 200);
}

function _executeFilterStandings() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#standings-body tr.data-row');
  let foundCount = 0;
  
  rows.forEach(row => {
    const name = row.querySelector('.name-cell').textContent.toLowerCase();
    const detailRow = row.nextElementSibling;
    if (name.includes(query)) {
      row.style.display = '';
      foundCount++;
    } else {
      row.style.display = 'none';
      const panel = detailRow.querySelector('.detail-panel');
      if (panel) panel.classList.remove('open');
      row.setAttribute('aria-expanded', 'false');
      detailRow.style.display = 'none';
    }
  });

  const countEl = document.getElementById('search-count');
  if (query) {
    countEl.textContent = `${foundCount} participante${foundCount !== 1 ? 's' : ''} encontrado${foundCount !== 1 ? 's' : ''}`;
  } else {
    countEl.textContent = '';
  }

  // Manejo de estado vacío
  let emptyRow = document.getElementById('standings-empty-state');
  if (foundCount === 0 && query !== '') {
    if (!emptyRow) {
      emptyRow = document.createElement('tr');
      emptyRow.id = 'standings-empty-state';
      emptyRow.innerHTML = `
        <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--muted);">
          <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
          <div>No se encontraron participantes para "<strong>${query.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>"</div>
        </td>
      `;
      document.getElementById('standings-body').appendChild(emptyRow);
    } else {
      emptyRow.style.display = '';
      emptyRow.innerHTML = `
        <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--muted);">
          <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
          <div>No se encontraron participantes para "<strong>${query.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>"</div>
        </td>
      `;
    }
  } else {
    if (emptyRow) emptyRow.style.display = 'none';
  }
}

/* ── LOAD LIVE MATCH INFO ── */
let lastScoreKey = "";
let countdownInterval = null;

function startNextMatchCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  
  const updateTimer = () => {
    const el = document.getElementById('next-match-countdown');
    if (!el) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }
    
    const kickoffStr = el.getAttribute('data-kickoff');
    if (!kickoffStr) return;
    
    const kickoff = new Date(kickoffStr);
    const diff = kickoff.getTime() - Date.now();
    
    if (diff <= 0) {
      el.innerHTML = "🏁 ¡El partido está por comenzar o ha comenzado!";
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    let display = "Comienza en: ";
    if (days > 0) display += `${days}d `;
    display += `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    
    el.innerHTML = `⏳ ${display}`;
  };
  
  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

async function loadLiveMatchInfo() {
  try {
    const response = await fetch('live_match.json?_t=' + new Date().getTime());
    if (!response.ok) {
      console.warn('No se pudo cargar live_match.json');
      return;
    }
    
    const liveData = await response.json();
    const container = document.getElementById('live-now');
    
    if (liveData.has_live && liveData.live) {
      const live = liveData.live;
      const team1 = live.team1 || 'Equipo 1';
      const team2 = live.team2 || 'Equipo 2';
      const b1 = getBadge(team1);
      const b2 = getBadge(team2);
      
      // Detectar cambio de marcador para animación
      const currentScoreKey = `${team1}-${live.score1}-${live.score2}-${team2}`;
      let flashClass = "";
      if (lastScoreKey !== "" && lastScoreKey !== currentScoreKey) {
        flashClass = "flash-update";
        console.log('%c[GOL]%c ¡Cambio detectado en el marcador!', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
      }
      lastScoreKey = currentScoreKey;
      
      container.innerHTML = `
        <div class="live-match-card ${flashClass}">
          <div class="live-badge">🔴 EN VIVO</div>
          <div class="live-match-teams">
            <div class="live-team" style="text-align: center;">
              ${b1 ? `<img src="${b1}" class="live-team-badge">` : flag(team1, 48)}
              <div class="live-team-name" style="font-weight: 700; font-size: 16px;">${team1}</div>
            </div>
            <div style="text-align: center;">
              <div class="live-score" style="font-size: 32px; font-weight: 800; color: var(--gold); letter-spacing: 2px;">${live.score1} - ${live.score2}</div>
              <div class="live-minute" style="background: rgba(34,197,94,0.1); color: var(--green); padding: 2px 8px; border-radius: 12px; font-size: 11px; display: inline-block; margin-top: 8px;">Minuto ${live.minute_display || ''}</div>
            </div>
            <div class="live-team" style="text-align: center;">
              ${b2 ? `<img src="${b2}" class="live-team-badge">` : flag(team2, 48)}
              <div class="live-team-name" style="font-weight: 700; font-size: 16px;">${team2}</div>
            </div>
          </div>
          <div class="live-match-info" style="text-align: center; font-size: 12px; color: var(--muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
            🏟️ ${live.stadium || 'Estadio'} • ${liveData.current_time}
          </div>
        </div>
      `;
    } else if (liveData.next) {
      const next = liveData.next;
      const team1 = next.team1 || 'Equipo 1';
      const team2 = next.team2 || 'Equipo 2';
      const b1 = getBadge(team1);
      const b2 = getBadge(team2);
      
      container.innerHTML = `
        <div class="next-match-card">
          <div class="next-badge">⏰ Próximo</div>
          <div class="next-match-teams">
            <div style="text-align: center; font-weight: 600; font-size: 14px;">
              ${b1 ? `<img src="${b1}" class="team-badge" style="display:block; margin:0 auto 4px;">` : flag(team1, 24)}
              ${team1}
            </div>
            <div style="color: var(--muted); font-size: 12px; font-weight: 600;">VS</div>
            <div style="text-align: center; font-weight: 600; font-size: 14px;">
              ${b2 ? `<img src="${b2}" class="team-badge" style="display:block; margin:0 auto 4px;">` : flag(team2, 24)}
              ${team2}
            </div>
          </div>
          <div id="next-match-countdown" class="countdown-timer" data-kickoff="${next.date}T${next.time}:00-06:00" style="font-size: 13px; font-weight: 700; color: var(--gold); text-align: center; margin: 10px 0 6px;">
            ⏳ Calculando tiempo...
          </div>
          <div style="font-size: 11px; color: var(--muted); text-align: center; padding-top: 8px; border-top: 1px solid rgba(30,51,34,0.4);">
            🏟️ ${next.stadium || 'Estadio'} • 📅 ${next.date || ''} a las ${next.time || 'N/A'}
          </div>
        </div>
      `;
      startNextMatchCountdown();
    } else {
      container.innerHTML = '';
    }
  } catch (error) {
    console.warn('Error cargando live match info:', error);
  }
}

function setMyUser(nombre, event) {
  if (event) event.stopPropagation();
  const current = localStorage.getItem('myUser');
  if (current === nombre) {
    localStorage.removeItem('myUser');
  } else {
    localStorage.setItem('myUser', nombre);
  }
  renderDashboard(currentPartidos, currentQuinielaData);
}
window.setMyUser = setMyUser;

/* ── MAIN ── */
/* ── LEADERBOARD CALCULATOR ── */
function calculateLeaderboard(participantes, matchesList) {
  const standings = participantes.map(p => {
    let totalPts = 0, exactos = 0, difs = 0, trends = 0;
    const detalle = [];

    const predMap = {};
    (p.predicciones || []).forEach(pr => { predMap[pr.id] = pr; });

    matchesList.forEach(partido => {
      const pred = predMap[partido.id];
      const res  = pred ? calcPuntos(partido.resultado, pred) : { pts: 0, tipo: 'zero' };
      if (res) {
        totalPts += res.pts;
        if (res.tipo === 'exact') exactos++;
        else if (res.tipo === 'diff') difs++;
        else if (res.tipo === 'trend') trends++;
        detalle.push({ partido, pred: pred || null, res });
      }
    });

    return { nombre: p.nombre, totalPts, exactos, difs, trends, detalle };
  });

  standings.sort((a, b) => b.totalPts - a.totalPts || b.exactos - a.exactos || b.difs - a.difs);
  return standings;
}

/* ── MAIN ── */
async function init() {
  console.group('%c⚽ Quiniela Mundial 2026 - Inicialización / Sincronización', 'color: #f0c040; font-weight: bold; font-size: 13px;');
  console.time('⏱️ Tiempo de procesamiento');

  updateSyncStatus('syncing', 'Sincronizando…');
  
  // Cargar metadatos de equipos (logos/escudos)
  await loadTeamMetadata();
  let partidos, quiniela;

  try {
    console.log('%c[API]%c Cargando partidos.json y quiniela.json locales...', 'color: #3b82f6; font-weight: bold;', 'color: inherit;');
    const cacheBuster = '?_t=' + new Date().getTime();
    const [pr, qr] = await Promise.all([
      fetch('partidos.json' + cacheBuster),
      fetch('quiniela.json' + cacheBuster)
    ]);
    if (!pr.ok || !qr.ok) throw new Error('fetch failed');
    partidos = await pr.json();
    quiniela = await qr.json();
    currentPartidos = partidos;
    currentQuinielaData = quiniela;
    console.log('%c[API]%c Carga local completada.', 'color: #3b82f6; font-weight: bold;', 'color: inherit;');

    try {
      console.log('%c[API]%c Sincronizando en vivo con openfootball/worldcup.json...', 'color: #10b981; font-weight: bold;', 'color: inherit;');
      const apiResponse = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        const apiMatches = apiData.matches || [];
        
        const apiLookup = {};
        apiMatches.forEach(m => {
          const t1 = (m.team1 || '').trim();
          const t2 = (m.team2 || '').trim();
          apiLookup[`${t1} vs ${t2}`] = m;
        });
        
        let mergeCount = 0;
        partidos.forEach(p => {
          if (p.resultado == null) {
            const apiMatch = apiLookup[p.partido.trim()];
            if (apiMatch && apiMatch.score && apiMatch.score.ft) {
              p.resultado = {
                local: apiMatch.score.ft[0],
                visitante: apiMatch.score.ft[1]
              };
              mergeCount++;
            }
          }
        });
        console.log(`%c[API]%c Sincronización finalizada. Marcadores nuevos mezclados en memoria: ${mergeCount}`, 'color: #10b981; font-weight: bold;', 'color: inherit;');
        updateSyncStatus('success', 'Sincronizado');
      } else {
        updateSyncStatus('error', 'Datos locales');
      }
    } catch (apiError) {
      console.warn('[API] No se pudo sincronizar en vivo:', apiError);
      updateSyncStatus('error', 'Datos locales');
    }
  } catch(e) {
    console.error('[API] Error crítico al cargar datos:', e);
    document.getElementById('standings-body').innerHTML =
      `<tr><td colspan="6"><div class="msg">
        ⚠️ No se pudo cargar <code>partidos.json</code> o <code>quiniela.json</code>.<br>
        Asegúrate de que los archivos estén en la misma carpeta que este HTML.
      </div></td></tr>`;
    document.getElementById('last-update').textContent = 'Error al cargar datos';
    updateSyncStatus('error', 'Error de carga');
    console.timeEnd('⏱️ Tiempo de procesamiento');
    console.groupEnd();
    return;
  }

  // Marcar partidos en curso (zona Guatemala) antes de renderizar
  try {
    markLive(partidos, 120);
  } catch (err) {
    console.warn('markLive error:', err);
  }
  renderDashboard(partidos, quiniela);
  
  // Restaurar pestaña activa si existe
  const activeTab = sessionStorage.getItem('activeTab');
  if (activeTab && activeTab !== 'posiciones') {
    showTab(activeTab);
  }
  
  // Populate admin panel dropdown and textarea initially
  updateAdminJsonOutput();
  populateAdminSelect();
}

function renderStadiums() {
  const grid = document.getElementById('stadiums-grid');
  if (!grid) return;
  
  // Obtenemos estadios únicos de la metadata
  const stadiums = {};
  Object.values(teamMetadata).forEach(t => {
    if (t.stadium && !stadiums[t.stadium]) {
      stadiums[t.stadium] = {
        name: t.stadium,
        img: t.stadium_thumb,
        team: t.name
      };
    }
  });

  const items = Object.values(stadiums);
  if (items.length === 0) {
    grid.innerHTML = '<div style="color:var(--muted); font-size:12px;">No hay información de sedes disponible aún.</div>';
    return;
  }

  grid.innerHTML = items.map(s => `
    <div class="stadium-card">
      <img src="${s.img || 'https://via.placeholder.com/400x200?text=Estadio+Proximamente'}" class="stadium-img" alt="${s.name}" onerror="this.src='https://via.placeholder.com/400x200?text=Estadio+Proximamente'">
      <div class="stadium-info">
        <div class="stadium-name">${s.name}</div>
        <div class="stadium-city">Sede de: ${s.team}</div>
      </div>
    </div>
  `).join('');
}

function renderDashboard(partidos, quiniela) {
  const jugados   = partidos.filter(p => p.resultado != null);
  const pendientes = partidos.filter(p => p.resultado == null);

  console.log(`%c[Datos]%c Partidos jugados: ${jugados.length} | Pendientes: ${pendientes.length}`, 'color: #fbbf24; font-weight: bold;', 'color: inherit;');

  const lastMatch = jugados.length > 0 ? jugados[jugados.length - 1] : null;
  if (lastMatch) {
    const liveBadge = lastMatch.live ? `<span class="live-badge">EN VIVO</span>` : '';
    document.getElementById('last-update').innerHTML = `Último: ${fmtPartido(lastMatch.partido)} ${liveBadge}`;
  } else {
    document.getElementById('last-update').textContent = 'Sin resultados aún';
  }

  // Cargar información de partidos en vivo
  loadLiveMatchInfo();
  renderStadiums();

  console.log('%c[Cálculo]%c Procesando posiciones actuales...', 'color: #a855f7; font-weight: bold;', 'color: inherit;');
  const participantes = quiniela.participantes || [];
  const standings = calculateLeaderboard(participantes, jugados);

  let standingsPrevias = [];
  const jugadosOrdenados = [...jugados].sort((a, b) => a.id - b.id);
  if (jugadosOrdenados.length > 1) {
    const jugadosPrevios = jugadosOrdenados.slice(0, -1);
    standingsPrevias = calculateLeaderboard(participantes, jugadosPrevios);
  }

  const maxPts = jugados.length * 3;

  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="metric-num">${jugados.length}</div><div class="metric-lbl">Partidos jugados</div></div>
    <div class="metric"><div class="metric-num">${pendientes.length}</div><div class="metric-lbl">Por jugar</div></div>
    <div class="metric"><div class="metric-num">${maxPts}</div><div class="metric-lbl">Pts máx. posibles</div></div>
    <div class="metric"><div class="metric-num">${standings[0]?.totalPts ?? 0}</div><div class="metric-lbl">Puntaje líder</div></div>
  `;

  // Mostrar partidos en vivo al inicio de la pestaña Quiniela
  try {
    const liveNowEl = document.getElementById('live-now');
    const liveMatches = (partidos || []).filter(p => p.live).sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    if (liveMatches.length > 0) {
      const items = liveMatches.map(p => {
        const time = formatDateTimeFor(p.fecha);
        return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">${fmtPartido(p.partido)} <span style="color:var(--muted); font-size:12px;">· ${time}</span> <span class="live-badge">EN VIVO</span></div>`;
      }).join('');
      liveNowEl.innerHTML = `<div style="font-size:13px; font-weight:700; color:var(--gold); margin-bottom:6px;">Juega ahora</div>${items}`;
    } else {
      liveNowEl.innerHTML = '';
    }
  } catch (e) {
    console.warn('Error rendering live-now:', e);
  }

  const badgeCls = i => ['badge-1','badge-2','badge-3'][i] ?? 'badge-n';
  const rankLabel = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);

  const tbody = document.getElementById('standings-body');
  tbody.innerHTML = '';
  standings.forEach((s, i) => {
    const detailId = `detail-${i}`;

    let trendHtml = '<span style="color:var(--muted)">─</span>';
    if (standingsPrevias.length > 0) {
      const prevIndex = standingsPrevias.findIndex(p => p.nombre === s.nombre);
      if (prevIndex !== -1) {
        const diff = prevIndex - i; 
        if (diff > 0) {
          trendHtml = `<span style="color:var(--green)">▲${diff}</span>`;
        } else if (diff < 0) {
          trendHtml = `<span style="color:var(--red)">▼${Math.abs(diff)}</span>`;
        }
      }
    }

    const isMe = s.nombre === localStorage.getItem('myUser');
    const tr = document.createElement('tr');
    tr.className = 'data-row' + (isMe ? ' ego-item' : '');
    tr.setAttribute('aria-expanded', 'false');
    tr.setAttribute('title', 'Haz clic para expandir y ver predicciones detalladas');
    tr.onclick = () => toggleDetail(detailId, tr);
    
    const nameDisplay = isMe 
      ? `<span style="display:inline-flex; align-items:center; gap:6px; font-weight:700; color:var(--gold);">⭐ ${s.nombre} <span class="ego-tag" style="background:var(--gold); color:#000; font-size:9px; padding:2px 5px; border-radius:4px; font-weight:800; text-transform:uppercase; line-height:1;">Tú</span></span>`
      : s.nombre;

    tr.innerHTML = `
      <td class="rank-cell">
        <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <span class="rank-medal" style="min-width:20px; text-align:center;">${rankLabel(i)}</span>
          <span style="font-size:10px; font-family:'JetBrains Mono', monospace; min-width:24px; text-align:left; white-space:nowrap;">${trendHtml}</span>
        </div>
      </td>
      <td class="name-cell">
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
          <span>${nameDisplay}</span>
          <span class="row-chevron" style="margin-left: 8px; font-size: 10px; opacity: 0.5; transition: transform 0.2s;">▸</span>
        </div>
      </td>
      <td class="num-cell c-exact">${s.exactos}</td>
      <td class="num-cell c-diff">${s.difs}</td>
      <td class="num-cell c-trend">${s.trends}</td>
      <td class="num-cell"><span class="pts-badge ${badgeCls(i)}">${s.totalPts}</span></td>
    `;
    tbody.appendChild(tr);

    const dtr = document.createElement('tr');
    dtr.className = 'detail-row';
    const dtd = document.createElement('td');
    dtd.colSpan = 6;
    const panel = document.createElement('div');
    panel.className = 'detail-panel';
    panel.id = detailId;

    const matchCards = s.detalle.map(d => {
      const predStr = d.pred ? `${d.pred.local}-${d.pred.visitante}` : '?-?';
      const realStr = `${d.partido.resultado.local}-${d.partido.resultado.visitante}`;
      const parts = d.partido.partido.split(' vs ');
      const loc = parts[0]?.trim() || d.partido.partido;
      const vis = parts[1]?.trim() || '';
      const teamsHtml = vis
        ? `<span class="pill-team">${flag(loc, 14)} ${loc}</span>
           <span class="pill-vs-sep">vs</span>
           <span class="pill-team">${flag(vis, 14)} ${vis}</span>`
        : `<span class="pill-team">${loc}</span>`;
      return `<div class="match-pill ${d.res.tipo}" title="${d.partido.partido}">
        <div class="pill-teams">${teamsHtml}</div>
        <div class="pill-bottom">
          <div class="pill-score-info">
            <span class="pill-score-pred">${predStr}</span>
            <span class="pill-score-arrow">→</span>
            <span class="pill-score-real">${realStr}</span>
          </div>
          <span class="pill-pts-badge ${d.res.tipo}">${d.res.pts}p</span>
        </div>
      </div>`;
    }).join('');

    const totalDetalle = s.detalle.length;
    const exactPct = totalDetalle > 0 ? (s.exactos / totalDetalle) * 100 : 0;
    const diffPct  = totalDetalle > 0 ? (s.difs / totalDetalle) * 100 : 0;
    const trendPct = totalDetalle > 0 ? (s.trends / totalDetalle) * 100 : 0;
    const zeroPct  = totalDetalle > 0 ? ((totalDetalle - s.exactos - s.difs - s.trends) / totalDetalle) * 100 : 0;

    const meBtnText = isMe ? '⭐ Quitar marca de "yo"' : 'Marcar como yo';
    const meBtnClass = isMe ? 'me-btn active' : 'me-btn';

    panel.innerHTML = `
      <div class="detail-header" style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
          <span class="c-exact">✅ ${s.exactos} exactos (${s.exactos*3}p)</span>
          <span class="c-diff">🎯 ${s.difs} gan. + marcador (${s.difs*2}p)</span>
          <span class="c-trend">↕ ${s.trends} tend. / marcador (${s.trends}p)</span>
          <span style="color:var(--muted)">Total: ${s.totalPts} pts de ${maxPts} posibles</span>
        </div>
        <button class="${meBtnClass}" onclick="setMyUser('${s.nombre.replace(/'/g, "\\'")}', event)">${meBtnText}</button>
      </div>
      <div class="accuracy-bar-container">
        <div class="accuracy-bar-label">
          <span>Distribución de resultados (${totalDetalle} partidos jugados)</span>
          <span>Precisión: ${Math.round(exactPct + diffPct + trendPct)}%</span>
        </div>
        <div class="accuracy-bar">
          <div class="accuracy-seg exact" style="width: ${exactPct}%" title="Exactos: ${s.exactos} (${Math.round(exactPct)}%)"></div>
          <div class="accuracy-seg diff"  style="width: ${diffPct}%"  title="Ganador + marcador: ${s.difs} (${Math.round(diffPct)}%)"></div>
          <div class="accuracy-seg trend" style="width: ${trendPct}%" title="Tendencia / marcador: ${s.trends} (${Math.round(trendPct)}%)"></div>
          <div class="accuracy-seg zero"  style="width: ${zeroPct}%"  title="Sin puntos: ${totalDetalle - s.exactos - s.difs - s.trends} (${Math.round(zeroPct)}%)"></div>
        </div>
        <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:8px;">
          <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted);">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;flex-shrink:0;"></span>
            Exacto <strong style="color:var(--chalk); margin-left:2px;">${s.exactos} × 3p</strong>
          </span>
          <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted);">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--blue);display:inline-block;flex-shrink:0;"></span>
            Ganador + marcador <strong style="color:var(--chalk); margin-left:2px;">${s.difs} × 2p</strong>
          </span>
          <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted);">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block;flex-shrink:0;"></span>
            Tendencia / marcador <strong style="color:var(--chalk); margin-left:2px;">${s.trends} × 1p</strong>
          </span>
          <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted);">
            <span style="width:8px;height:8px;border-radius:50%;background:#3b4a3d;display:inline-block;flex-shrink:0;"></span>
            Sin puntos <strong style="color:var(--chalk); margin-left:2px;">${totalDetalle - s.exactos - s.difs - s.trends} × 0p</strong>
          </span>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0 6px; border-top:1px solid var(--border); margin-top:4px;">
        <span style="font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--muted);">Partido a partido</span>
        <span style="font-size:10px; color:var(--muted); font-family:'JetBrains Mono',monospace;">Tu pronóstico → Resultado real</span>
      </div>
      <div class="detail-grid">${matchCards}</div>
    `;

    dtd.appendChild(panel);
    dtr.appendChild(dtd);
    tbody.appendChild(dtr);
  });

  renderResultados(currentPartidos);
  renderCalendario(currentPartidos);

  updateDetalleParticipants(quiniela);
  updateDetalleGroups(partidos);
  renderDetalle(currentPartidos, currentQuinielaData);

  const groupStandings = calcGroupStandings(partidos);
  const sortedGroups = Object.keys(groupStandings).sort();
  let htmlGrupos = '';
  sortedGroups.forEach((grpName, grpIdx) => {
    const teams = groupStandings[grpName];
    let rowsHtml = '';
    teams.forEach((t, index) => {
      const dg = t.gf - t.gc;
      const dgStr = dg > 0 ? `+${dg}` : String(dg);
      const isQualified = index < 2; 
      rowsHtml += `<tr class="${isQualified ? 'qualified-row' : ''}">
        <td style="font-weight:600; color:var(--muted); text-align:center;">${index + 1}</td>
        <td style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;"><span style="display:inline-flex;align-items:center;gap:5px;">${flag(t.name, 14)} ${t.name}</span></td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace;">${t.pj}</td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace; color:var(--muted);">${t.g}</td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace; color:var(--muted);">${t.e}</td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace; color:var(--muted);">${t.p}</td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace; color:var(--muted); font-size:11px;">${t.gf}:${t.gc}</td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace; color:${dg > 0 ? 'var(--green)' : dg < 0 ? 'var(--red)' : 'var(--muted)'}">${dgStr}</td>
        <td style="text-align:center; font-family:'JetBrains Mono', monospace; font-weight:600; color:var(--gold);">${t.pts}</td>
      </tr>`;
    });

    htmlGrupos += `<div class="group-card reveal-card" style="animation-delay: ${grpIdx * 40}ms">
      <div class="group-title">${grpName.replace('Group ', 'Grupo ')}</div>
      <table class="group-table">
        <thead>
          <tr>
            <th style="text-align:center; width:20px;">#</th>
            <th>Equipo</th>
            <th style="text-align:center; width:24px;">PJ</th>
            <th style="text-align:center; width:20px;">G</th>
            <th style="text-align:center; width:20px;">E</th>
            <th style="text-align:center; width:20px;">P</th>
            <th style="text-align:center; width:44px;">GF:GC</th>
            <th style="text-align:center; width:28px;">DG</th>
            <th style="text-align:center; width:28px;">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
  });
  document.getElementById('groups-grid').innerHTML = htmlGrupos;

  console.timeEnd('⏱️ Tiempo de procesamiento');
  console.groupEnd();
}

function calcGroupStandings(partidos) {
  const groups = {};

  partidos.forEach(p => {
    if (!p.grupo || !p.grupo.startsWith('Group')) return;
    if (!p.partido.includes(' vs ')) return;

    const teams = p.partido.split(' vs ');
    const home = teams[0].trim();
    const away = teams[1].trim();
    const grp = p.grupo;

    if (!groups[grp]) groups[grp] = {};
    if (!groups[grp][home]) groups[grp][home] = { name: home, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
    if (!groups[grp][away]) groups[grp][away] = { name: away, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };

    if (p.resultado) {
      const rl = p.resultado.local;
      const rv = p.resultado.visitante;

      groups[grp][home].pj += 1;
      groups[grp][away].pj += 1;
      groups[grp][home].gf += rl;
      groups[grp][home].gc += rv;
      groups[grp][away].gf += rv;
      groups[grp][away].gc += rl;

      if (rl > rv) {
        groups[grp][home].g += 1;
        groups[grp][home].pts += 3;
        groups[grp][away].p += 1;
      } else if (rl < rv) {
        groups[grp][away].g += 1;
        groups[grp][away].pts += 3;
        groups[grp][home].p += 1;
      } else {
        groups[grp][home].e += 1;
        groups[grp][home].pts += 1;
        groups[grp][away].e += 1;
        groups[grp][away].pts += 1;
      }
    }
  });

  const result = {};
  for (const [grpName, teamsObj] of Object.entries(groups)) {
    const teamsArray = Object.values(teamsObj);
    teamsArray.sort((a, b) => {
      const dgA = a.gf - a.gc;
      const dgB = b.gf - b.gc;
      return b.pts - a.pts || dgB - dgA || b.gf - a.gf;
    });
    result[grpName] = teamsArray;
  }
  return result;
}

function toggleDetail(detailId, row) {
  const panel = document.getElementById(detailId);
  const isOpen = panel.classList.contains('open');
  document.querySelectorAll('.detail-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.data-row').forEach(r => r.setAttribute('aria-expanded','false'));
  if (!isOpen) {
    panel.classList.add('open');
    row.setAttribute('aria-expanded', 'true');
  }
}

/* ── RENDER RESULTADOS (partidos con resultado) ── */
function renderResultados(partidos) {
  const filter = document.getElementById('filter-resultados')?.value || 'ALL';
  const lista = document.getElementById('resultados-list');
  if (!lista) return;

  const jugados = partidos
    .filter(p => p.resultado != null)
    .filter(p => filter === 'ALL' || p.grupo === filter)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id);

  if (jugados.length === 0) {
    lista.innerHTML = '<div class="msg">No hay resultados aún para esta fase.</div>';
    return;
  }

  // Agrupar por fecha
  const byDate = {};
  jugados.forEach(p => {
    if (!byDate[p.fecha]) byDate[p.fecha] = [];
    byDate[p.fecha].push(p);
  });

  let html = '';
  Object.keys(byDate).sort((a,b) => new Date(b) - new Date(a)).forEach(fecha => {
    html += `<div class="date-sep"><div class="date-line"></div><div class="date-lbl">${fmtDate(fecha)}</div><div class="date-line"></div></div>`;
    byDate[fecha].forEach(p => {
      const [loc, vis] = p.partido.split(' vs ');
      html += `
        <div class="match-card reveal-card" style="animation-delay:0ms">
          <div class="team">
            <span class="team-flag">${flag(loc.trim())}</span>
            <span class="team-name">${loc.trim()}</span>
          </div>
          <div class="score-center">
            <div class="score-num">${p.resultado.local} – ${p.resultado.visitante}</div>
            <div class="score-meta">${p.grupo} · ${p.estadio}</div>
          </div>
          <div class="team away">
            <span class="team-flag">${flag(vis.trim())}</span>
            <span class="team-name">${vis.trim()}</span>
          </div>
        </div>`;
    });
  });
  lista.innerHTML = html;
}

function updateDetalleParticipants(quiniela) {
  const select = document.getElementById('filter-participante');
  if (!select || !quiniela) return;
  const participantes = (quiniela.participantes || []).map(p => p.nombre).filter(Boolean);
  
  // Guardar el valor actual por si ya hay selección activa
  const currentValue = select.value;

  select.innerHTML = ['<option value="ALL">Todos los participantes</option>',
    ...participantes.map(nombre => `<option value="${nombre}">${nombre}</option>`)
  ].join('');

  // Si hay un usuario preferido y el selector no tiene un valor establecido previamente
  const myUser = localStorage.getItem('myUser');
  if (myUser && participantes.includes(myUser)) {
    if (!currentValue || currentValue === 'ALL') {
      select.value = myUser;
    } else {
      select.value = currentValue;
    }
  } else if (currentValue && [ 'ALL', ...participantes ].includes(currentValue)) {
    select.value = currentValue;
  }
}

function updateDetalleGroups(partidos) {
  const select = document.getElementById('filter-detalle-grupo');
  if (!select || !partidos) return;
  const groups = Array.from(new Set((partidos || []).map(p => p.grupo).filter(Boolean)));
  groups.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  select.innerHTML = ['<option value="ALL">Todos los grupos/fases</option>',
    ...groups.map(gr => `<option value="${gr}">${gr}</option>`)
  ].join('');
}

function renderDetalle(partidos, quiniela) {
  const filterName = document.getElementById('filter-participante')?.value || 'ALL';
  const filterGroup = document.getElementById('filter-detalle-grupo')?.value || 'ALL';
  const filterStatus = document.getElementById('filter-detalle-status')?.value || 'ALL';
  const sortBy = document.getElementById('sort-detalle')?.value || 'NAME';
  const container = document.getElementById('detalle-list');
  if (!container) return;

  const partidosById = (partidos || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  const participantes = (quiniela.participantes || [])
    .filter(p => filterName === 'ALL' || p.nombre === filterName);

  const cards = participantes.map(p => {
    const visiblePreds = (p.predicciones || []).filter(pred => {
      const partido = partidosById[pred.id];
      const matchesGroup = filterGroup === 'ALL' || (partido?.grupo === filterGroup);
      const real = partido?.resultado || null;
      const status = real ? 'WITH_RESULT' : 'PENDING';
      const matchesStatus = filterStatus === 'ALL' || status === filterStatus;
      return matchesGroup && matchesStatus;
    });

    if (visiblePreds.length === 0) return null;

    const details = visiblePreds.map(pred => {
      const partido = partidosById[pred.id];
      const real = partido?.resultado || null;
      const res = real ? calcPuntos(real, pred) : { pts: 'Pendiente', tipo: 'pending' };
      const matchLabel = partido ? `${partido.partido}` : `Partido #${pred.id}`;
      const meta = partido ? `${partido.grupo} · ${fmtDate(partido.fecha)} · ${partido.estadio}` : 'Partido sin resultado';
      const liveHtml = partido && partido.live ? ' <span class="live-badge">EN VIVO</span>' : '';
      const outcome = real ? `${real.local} – ${real.visitante}` : 'Pendiente';
      return `
        <div class="prediction-row">
          <div class="prediction-info">
            <div class="match-label">${fmtPartido(matchLabel)}</div>
            <div class="match-meta">${meta}${liveHtml}</div>
          </div>
          <div class="prediction-score">
            <span>${pred.local}–${pred.visitante}</span>
            <span>→</span>
            <span>${outcome}</span>
            <span class="prediction-badge ${res.tipo}">${res.pts === 'Pendiente' ? 'Pendiente' : res.pts + ' pts'}</span>
          </div>
        </div>`;
    }).join('');

    const totalPreds = visiblePreds.length;
    const played = visiblePreds.filter(pred => partidosById[pred.id]?.resultado).length;
    const pending = totalPreds - played;
    let exactos = 0, difs = 0, trends = 0;
    const totalPts = visiblePreds.reduce((sum, pred) => {
      const real = partidosById[pred.id]?.resultado;
      const score = calcPuntos(real, pred);
      if (score) {
        if (score.tipo === 'exact') exactos++;
        else if (score.tipo === 'diff') difs++;
        else if (score.tipo === 'trend') trends++;
        return sum + score.pts;
      }
      return sum;
    }, 0);

    return {
      nombre: p.nombre,
      exactos,
      totalPts,
      played,
      pending,
      ingresos: totalPreds,
      html: `
      <div class="participant-card">
        <div class="participant-header">
          <div class="participant-name">${p.nombre}</div>
          <div class="participant-stats">
            <span>Ingresos: ${totalPreds}</span>
            <span>Con resultado: ${played}</span>
            <span>Pendientes: ${pending}</span>
            <span>Exactos: ${exactos}</span>
            <span>Total: ${totalPts} pts</span>
          </div>
        </div>
        <div class="prediction-grid">${details}</div>
      </div>`
    };
  }).filter(Boolean);

  if (cards.length === 0) {
    container.innerHTML = '<div class="msg">No hay predicciones que coincidan con los filtros seleccionados.</div>';
    return;
  }

  cards.sort((a, b) => {
    switch (sortBy) {
      case 'TOTAL_PTS': return b.totalPts - a.totalPts;
      case 'EXACTOS': return b.exactos - a.exactos;
      case 'RESULTADOS': return b.played - a.played;
      case 'PENDIENTES': return b.pending - a.pending;
      case 'INGRESOS': return b.ingresos - a.ingresos;
      default: return a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' });
    }
  });

  container.innerHTML = cards.map(card => card.html).join('');
}

/* ── RENDER CALENDARIO (partidos pendientes + entrada manual) ── */
function renderCalendario(partidos) {
  const filter = document.getElementById('filter-calendario')?.value || 'ALL';
  const lista = document.getElementById('calendario-list');
  if (!lista) return;

  // Asegurar marcas en vivo antes de renderizar
  try { markLive(partidos, 120); } catch (e) { /* noop */ }

  const pendientes = partidos
    .filter(p => p.resultado == null)
    .filter(p => filter === 'ALL' || p.grupo === filter)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);

  if (pendientes.length === 0) {
    lista.innerHTML = '<div class="msg">🎉 ¡Todos los partidos de esta fase tienen resultado!</div>';
    return;
  }

  const byDate = {};
  pendientes.forEach(p => {
    if (!byDate[p.fecha]) byDate[p.fecha] = [];
    byDate[p.fecha].push(p);
  });

  let html = '';
  Object.keys(byDate).sort().forEach(fecha => {
    const todayMark = isToday(fecha) ? ' <span style="color:var(--amber);font-size:10px;font-weight:600;letter-spacing:1px;">HOY</span>' : '';
    html += `<div class="date-sep"><div class="date-line"></div><div class="date-lbl">${fmtDate(fecha)}${todayMark}</div><div class="date-line"></div></div>`;
    byDate[fecha].forEach(p => {
      if (!p.partido.includes(' vs ')) return;
      const [loc, vis] = p.partido.split(' vs ');
      html += `
        <div class="match-card" id="card-${p.id}">
          <div class="team">
            <span class="team-flag">${flag(loc.trim())}</span>
            <span class="team-name">${loc.trim()}</span>
          </div>
          <div class="score-center">
            <div class="score-num pending">vs</div>
            <div class="score-meta">${p.grupo} · ${p.estadio}${p.live ? ' <span class="live-badge">EN VIVO</span>' : ''}</div>
            <div style="margin-top:8px;" id="inline-form-${p.id}">
              <div style="display:flex; gap:6px; align-items:center; justify-content:center; flex-wrap:wrap;">
                <input type="number" id="il-loc-${p.id}" min="0" placeholder="Local"
                  style="width:52px; text-align:center; background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:5px 4px; color:var(--chalk); font-size:13px; font-family:'JetBrains Mono',monospace; outline:none;"
                  onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
                <span style="color:var(--muted)">–</span>
                <input type="number" id="il-vis-${p.id}" min="0" placeholder="Visita"
                  style="width:52px; text-align:center; background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:5px 4px; color:var(--chalk); font-size:13px; font-family:'JetBrains Mono',monospace; outline:none;"
                  onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
                <button onclick="applyInlineScore(${p.id})"
                  style="background:var(--gold); color:#0a0f0b; border:none; font-weight:600; border-radius:6px; padding:5px 12px; cursor:pointer; font-size:12px; white-space:nowrap; transition:opacity 0.2s;"
                  onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">✅ Guardar</button>
              </div>
            </div>
          </div>
          <div class="team away">
            <span class="team-flag">${flag(vis.trim())}</span>
            <span class="team-name">${vis.trim()}</span>
          </div>
        </div>`;
    });
  });
  lista.innerHTML = html;
}

/* ── INLINE SCORE ENTRY ── */
function applyInlineScore(matchId) {
  const locEl = document.getElementById(`il-loc-${matchId}`);
  const visEl = document.getElementById(`il-vis-${matchId}`);
  const loc = parseInt(locEl?.value);
  const vis = parseInt(visEl?.value);

  if (isNaN(loc) || isNaN(vis) || loc < 0 || vis < 0) {
    alert('Ingresa marcador válido (números ≥ 0) para ambos equipos.');
    return;
  }

  const partido = currentPartidos.find(p => p.id === matchId);
  if (!partido) return;

  partido.resultado = { local: loc, visitante: vis };

  // Rebuild dashboard
  renderDashboard(currentPartidos, currentQuinielaData);

  // Show updated JSON
  updateAdminJsonOutput();

  // Stay on calendario tab
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-calendario').classList.add('active');
  document.querySelector('[onclick*="calendario"]').classList.add('active');

  // Flash notification
  showToast(`✅ Marcador guardado en memoria. Descarga el JSON para persistir.`);
}

/* ── TOAST NOTIFICATION ── */
function showToast(msg) {
  let toast = document.getElementById('__toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2e1c;border:1px solid var(--green);color:var(--chalk);padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.4s;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

/* ── ADMIN PANEL ── */
function toggleAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) updateAdminJsonOutput();
}

function updateAdminJsonOutput() {
  const ta = document.getElementById('admin-json-output');
  if (ta) ta.value = JSON.stringify(currentPartidos, null, 2);
}

function copyAdminJson() {
  updateAdminJsonOutput();
  const ta = document.getElementById('admin-json-output');
  navigator.clipboard.writeText(ta.value)
    .then(() => showToast('📋 JSON copiado al portapapeles'))
    .catch(() => { ta.select(); document.execCommand('copy'); showToast('📋 JSON copiado'); });
}

function downloadAdminJson() {
  updateAdminJsonOutput();
  const blob = new Blob([document.getElementById('admin-json-output').value], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'partidos.json';
  a.click();
  showToast('💾 Archivo descargado');
}

function applyManualScore() {
  const sel = document.getElementById('admin-match-select');
  const locEl = document.getElementById('admin-score-local');
  const visEl = document.getElementById('admin-score-away');
  if (!sel || !locEl || !visEl) return;

  const matchId = parseInt(sel.value);
  const loc = parseInt(locEl.value);
  const vis = parseInt(visEl.value);

  if (isNaN(matchId) || isNaN(loc) || isNaN(vis)) {
    alert('Selecciona un partido e ingresa el marcador.');
    return;
  }

  const partido = currentPartidos.find(p => p.id === matchId);
  if (!partido) return;

  partido.resultado = { local: loc, visitante: vis };
  renderDashboard(currentPartidos, currentQuinielaData);
  updateAdminJsonOutput();
  showToast(`✅ ${fmtPartido(partido.partido)} actualizado en memoria.`);

  // Refresh select (partido now has result, should not appear)
  populateAdminSelect();
}

function populateAdminSelect() {
  const sel = document.getElementById('admin-match-select');
  if (!sel) return;
  const pending = currentPartidos.filter(p => p.resultado == null);
  sel.innerHTML = pending.length === 0
    ? '<option value="">-- Todos los partidos tienen resultado --</option>'
    : pending.map(p => `<option value="${p.id}">${p.fecha} · ${p.partido}</option>`).join('');
}

// Auto-refresh data every 60 seconds to keep scores and live status updated
setInterval(() => {
  console.log('%c[Polling]%c Refreshing match data...', 'color: #3b82f6; font-weight: bold;', 'color: inherit;');
  init();
}, 60000);

init();

/* ══════════════════════════════════════════
   MICRO-INTERACTION ENGINE
   ══════════════════════════════════════════ */

// ── Scroll progress bar
const progressBar = document.createElement('div');
progressBar.id = 'scroll-progress';
document.body.prepend(progressBar);

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const max = document.body.scrollHeight - window.innerHeight;
  progressBar.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';

  // Glass header on scroll
  document.querySelector('header').classList.toggle('scrolled', scrolled > 10);
}, { passive: true });

// ── Staggered IntersectionObserver for reveals
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function observeRevealCards() {
  document.querySelectorAll('.reveal-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 35}ms`;
    el.style.animationPlayState = 'paused';
    revealObserver.observe(el);
  });
}

// ── Animated number counter for metrics
function animateCounter(el, target, duration = 600) {
  const start = performance.now();
  const from = 0;
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out expo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function runMetricCounters() {
  document.querySelectorAll('.metric-num').forEach(el => {
    const val = parseInt(el.textContent);
    if (!isNaN(val)) animateCounter(el, val);
  });
}

// ── Ripple effect on buttons
function addRipple(e) {
  const btn = e.currentTarget;
  const existing = btn.querySelector('.ripple');
  if (existing) existing.remove();

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `
    position:absolute; border-radius:50%; pointer-events:none;
    width:${size}px; height:${size}px;
    left:${x}px; top:${y}px;
    background: rgba(255,255,255,0.15);
    transform: scale(0);
    animation: rippleAnim 0.55s var(--ease-out-expo) forwards;
  `;
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// Inject ripple keyframe
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `@keyframes rippleAnim { to { transform: scale(2.5); opacity: 0; } }`;
document.head.appendChild(rippleStyle);

function wireRipples() {
  document.querySelectorAll('button, .admin-btn').forEach(btn => {
    btn.removeEventListener('click', addRipple);
    btn.addEventListener('click', addRipple);
  });
}

// ── CUSTOM DROPDOWN SELECTS ──
function initCustomSelects() {
  document.querySelectorAll('select').forEach(selectEl => {
    if (selectEl.dataset.customized === 'true') {
      return;
    }
    
    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    // Custom style classes
    if (selectEl.classList.contains('admin-select')) {
      wrapper.classList.add('admin-select-style');
    }
    
    // Preserve flex / width layout inline styles
    const originalStyle = selectEl.getAttribute('style');
    if (originalStyle) {
      const allowedStyles = ['width', 'max-width', 'min-width', 'flex', 'margin'];
      const styleParts = originalStyle.split(';').filter(s => {
        const name = s.split(':')[0].trim().toLowerCase();
        return allowedStyles.some(allowed => name === allowed || name.startsWith(allowed + '-'));
      });
      if (styleParts.length > 0) {
        wrapper.setAttribute('style', styleParts.join(';') + ';');
      }
    }
    
    // Hide original select visually but keep it accessible
    selectEl.classList.add('custom-select-hidden');
    
    // Insert wrapper in DOM
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    
    // Create trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.tabIndex = 0;
    
    const label = document.createElement('span');
    label.className = 'custom-select-label';
    
    const arrow = document.createElement('span');
    arrow.className = 'custom-select-arrow';
    arrow.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    
    trigger.appendChild(label);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);
    
    // Create menu
    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    wrapper.appendChild(menu);
    
    let activeIndex = -1;
    
    function updateOptions() {
      menu.innerHTML = '';
      const options = Array.from(selectEl.options);
      
      const selectedIndex = selectEl.selectedIndex >= 0 ? selectEl.selectedIndex : 0;
      const selectedOption = options[selectedIndex];
      label.textContent = selectedOption ? selectedOption.textContent : '';
      
      options.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'custom-select-option';
        if (idx === selectedIndex) {
          item.classList.add('selected');
        }
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectOption(idx);
        });
        
        menu.appendChild(item);
      });
    }
    
    function selectOption(index) {
      const options = Array.from(selectEl.options);
      if (index >= 0 && index < options.length) {
        selectEl.selectedIndex = index;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        updateOptions();
      }
      closeMenu();
    }
    
    function openMenu() {
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.add('open');
      trigger.focus();
      
      const selectedItem = menu.querySelector('.custom-select-option.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
      
      activeIndex = selectEl.selectedIndex >= 0 ? selectEl.selectedIndex : 0;
      highlightOption(activeIndex);
    }
    
    function closeMenu() {
      wrapper.classList.remove('open');
    }
    
    function highlightOption(index) {
      const items = menu.querySelectorAll('.custom-select-option');
      items.forEach((item, idx) => {
        if (idx === index) {
          item.classList.add('highlighted');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('highlighted');
        }
      });
    }
    
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (wrapper.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    
    trigger.addEventListener('keydown', (e) => {
      const options = Array.from(selectEl.options);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!wrapper.classList.contains('open')) {
          openMenu();
        } else {
          if (activeIndex >= 0 && activeIndex < options.length) {
            selectOption(activeIndex);
          } else {
            closeMenu();
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!wrapper.classList.contains('open')) {
          openMenu();
        } else {
          activeIndex = (activeIndex + 1) % options.length;
          highlightOption(activeIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!wrapper.classList.contains('open')) {
          openMenu();
        } else {
          activeIndex = (activeIndex - 1 + options.length) % options.length;
          highlightOption(activeIndex);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      } else if (e.key === 'Tab') {
        closeMenu();
      }
    });
    
    selectEl.addEventListener('change', () => {
      updateOptions();
    });
    
    // MutationObserver to watch option changes
    const observer = new MutationObserver(() => {
      updateOptions();
    });
    observer.observe(selectEl, { childList: true, characterData: true, subtree: true });
    
    selectEl.dataset.customized = 'true';
    updateOptions();
  });
}

// Close menus clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
    w.classList.remove('open');
  });
});

// ── Hook into renderDashboard to trigger animations
const _origRenderDashboard = renderDashboard;
window.renderDashboard = function(partidos, quiniela) {
  _origRenderDashboard(partidos, quiniela);
  requestAnimationFrame(() => {
    observeRevealCards();
    runMetricCounters();
    wireRipples();
    initCustomSelects();
  });
};

// ── toggleAdminPanel with slide animation
const _origToggleAdmin = toggleAdminPanel;
window.toggleAdminPanel = function() {
  const panel = document.getElementById('admin-panel');
  const isHidden = panel.style.display === 'none' || panel.style.display === '';
  if (isHidden) {
    panel.style.display = 'block';
    panel.classList.remove('panel-enter');
    void panel.offsetWidth; // force reflow
    panel.classList.add('panel-enter');
  } else {
    panel.style.opacity = '0';
    panel.style.transform = 'scaleY(0.95) translateY(-8px)';
    setTimeout(() => {
      panel.style.display = 'none';
      panel.style.opacity = '';
      panel.style.transform = '';
    }, 300);
    return;
  }
  updateAdminJsonOutput();
};

// ── Initial run
requestAnimationFrame(() => {
  observeRevealCards();
  wireRipples();
  initCustomSelects();
});

// Polling automático para la tarjeta de partido en vivo (cada 5 segundos)
setInterval(loadLiveMatchInfo, 5000);
