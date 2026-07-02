/* ============================================================
   ABSTERGO · Lógica de la app
   Módulos: Inicio · Gastos · Rol · Tarjeta · Deudas · Asistente · Config
   Acceso con PIN · Los datos se guardan en el navegador del teléfono
   ============================================================ */

/* ---------- Utilidades ---------- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const hoy = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = n => '$' + (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const nombreMes = ym => { const [a, m] = ym.split('-'); return MESES[+m - 1] + ' ' + a; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICO_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const ICO_EDIT  = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICO_DOTS  = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

function fechaBonita(f) {
  const h = hoy();
  if (f === h) return 'Hoy';
  const d = new Date(h + 'T12:00:00'); d.setDate(d.getDate() - 1);
  const ayer = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (f === ayer) return 'Ayer';
  const p = f.split('-');
  const anio = p[0] !== h.slice(0, 4) ? ' ' + p[0] : '';
  return (+p[2]) + ' ' + MESES[+p[1] - 1].slice(0, 3).toLowerCase() + anio;
}
const fmtHora = ts => {
  const d = new Date(ts);
  const f = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return fechaBonita(f) + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

/* ---------- Datos iniciales / migración ---------- */
function datosIniciales() {
  const defs = [
    ['🍔', 'Alimentación',    ['Supermercado', 'Comida rápida', 'Restaurante']],
    ['🚌', 'Transporte',      ['Bus / Taxi', 'Gasolina']],
    ['🏠', 'Hogar',           ['Arriendo', 'Luz / Agua', 'Internet', 'Muebles']],
    ['🎬', 'Entretenimiento', ['Netflix', 'Spotify', 'Salidas', 'Videojuegos']],
    ['📱', 'Celular',         ['Recarga Claro', 'Plan', 'Accesorios']],
    ['❤️', 'Salud',           ['Medicinas', 'Consultas']],
    ['👕', 'Ropa y personal', ['Ropa', 'Cuidado personal']],
    ['💳', 'Deudas',          ['Tarjeta de crédito', 'Almacén', 'Préstamos']],
    ['📦', 'Otros',           ['Varios']]
  ];
  const cats = defs.map(d => ({ id: uid(), emoji: d[0], nombre: d[1], subs: d[2].map(n => ({ id: uid(), nombre: n })) }));
  const cat = n => cats.find(c => c.nombre === n);
  const sub = (c, n) => cat(c).subs.find(s => s.nombre === n);
  return {
    perfil: { nombre: 'Wilmer', sueldo: 600, saldoInicial: 0, pin: '971818' },
    categorias: cats,
    movimientos: [],
    roles: {},
    deudas: [],
    fijos: [
      { id: uid(), nombre: 'Netflix',       monto: 7.99,  catId: cat('Entretenimiento').id, subId: sub('Entretenimiento', 'Netflix').id, dia: 5 },
      { id: uid(), nombre: 'Spotify',       monto: 5.99,  catId: cat('Entretenimiento').id, subId: sub('Entretenimiento', 'Spotify').id, dia: 5 },
      { id: uid(), nombre: 'Internet',      monto: 24.90, catId: cat('Hogar').id,           subId: sub('Hogar', 'Internet').id,          dia: 10 },
      { id: uid(), nombre: 'Recarga Claro', monto: 10.00, catId: cat('Celular').id,         subId: sub('Celular', 'Recarga Claro').id,   dia: 1 }
    ],
    fijosAplicados: {},
    asistente: []
  };
}
function migrar(d) {
  d.perfil = d.perfil || {};
  if (!d.perfil.pin) d.perfil.pin = '971818';
  if (d.perfil.saldoInicial == null) d.perfil.saldoInicial = 0;
  d.asistente = d.asistente || [];
  d.movimientos = d.movimientos || [];
  d.movimientos.forEach(m => { if (!m.origen) m.origen = 'banco'; });
  d.roles = d.roles || {}; d.deudas = d.deudas || [];
  d.fijos = d.fijos || []; d.fijosAplicados = d.fijosAplicados || {};
  d.categorias = d.categorias || [];
  return d;
}

const LS_KEY = 'abstergo_v1';
function cargar() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return migrar(JSON.parse(raw));
    const viejo = localStorage.getItem('billetera_v1');   // datos de la versión anterior
    if (viejo) { const d = migrar(JSON.parse(viejo)); localStorage.setItem(LS_KEY, JSON.stringify(d)); return d; }
  } catch (e) { /* datos dañados: se reinicia */ }
  return datosIniciales();
}
function guardar() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(D)); }
  catch (e) { toast('No se pudo guardar 😕'); }
}

/* ---------- Estado ---------- */
let D = cargar();
let mes = hoy().slice(0, 7);
let vista = 'inicio';
let filtroMov = 'todos';
let pickYear = +mes.slice(0, 4);
let tipoMov = 'gasto';
let pinBuf = '';
let bloqueada = true;

/* ---------- Cálculos ---------- */
const movsDelMes = ym => D.movimientos.filter(m => m.fecha.startsWith(ym));
const ordMov = (a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0);
const sumar = arr => arr.reduce((t, x) => t + (+x.monto || 0), 0);
const liquidoRol = r => sumar(r.ingresos) - sumar(r.descuentos);
const ingresosMes = ym => {
  const rol = D.roles[ym];
  return (rol ? liquidoRol(rol) : 0) + sumar(movsDelMes(ym).filter(m => m.tipo === 'ingreso'));
};
const egresosMes = ym => sumar(movsDelMes(ym).filter(m => m.tipo === 'gasto' && m.origen === 'banco'));
const comprasTarjetaMes = ym => sumar(movsDelMes(ym).filter(m => m.origen === 'tarjeta'));
function saldoBanco() {
  const rolTot = Object.keys(D.roles).reduce((t, k) => t + liquidoRol(D.roles[k]), 0);
  const ing = sumar(D.movimientos.filter(m => m.tipo === 'ingreso'));
  const gas = sumar(D.movimientos.filter(m => m.tipo === 'gasto' && m.origen === 'banco'));
  return +(num(D.perfil.saldoInicial) + rolTot + ing - gas).toFixed(2);
}
function consumoPorCategoria(ym) {   // gastos banco (sin pagos de tarjeta) + compras con tarjeta
  const map = {};
  movsDelMes(ym).filter(m => m.tipo === 'gasto' && !m.pagoTarjeta)
    .forEach(m => { map[m.catId] = (map[m.catId] || 0) + (+m.monto || 0); });
  return Object.keys(map).map(id => ({ cat: catInfo(id), total: map[id] })).sort((a, b) => b.total - a.total);
}
const catInfo = id => D.categorias.find(c => c.id === id) || { id: '', emoji: '❔', nombre: 'Sin categoría', subs: [] };
function subNombre(catId, subId) {
  const s = catInfo(catId).subs.find(x => x.id === subId);
  return s ? s.nombre : '';
}
const catPorNombre = n => D.categorias.find(c => c.nombre === n);
const fijosPendientes = ym => D.fijos.filter(f => !(D.fijosAplicados[ym] || []).includes(f.id));
const saldoPlazo = d => Math.max(0, (+d.total || 0) - sumar(d.pagos));
const tarjetas = () => D.deudas.filter(d => d.tipo === 'tarjeta');
const plazos   = () => D.deudas.filter(d => d.tipo === 'plazo');

/* ---------- Asistente ---------- */
function burbuja(txt, emo) {
  const b = $('#bubble');
  $('#bubbleTxt').textContent = txt;
  b.querySelector('.bubble-emo').textContent = emo || '🤖';
  b.classList.add('show');
  clearTimeout(b._tm);
  b._tm = setTimeout(() => b.classList.remove('show'), 6000);
}
function asistir(txt, emo) {
  D.asistente.unshift({ id: uid(), ts: Date.now(), txt, emo: emo || '🤖' });
  D.asistente = D.asistente.slice(0, 60);
  guardar();
  burbuja(txt, emo);
}
const nombre = () => (D.perfil.nombre || '').trim().split(' ')[0] || 'amigo';
const pick = a => a[Math.floor(Math.random() * a.length)];
function avisoUsoIngresos(ym) {
  const ing = ingresosMes(ym);
  if (!(ing > 0)) return '';
  const p = Math.round(egresosMes(ym) / ing * 100);
  if (p >= 100) return ' 🚨 Ya gastaste TODO lo que ingresó este mes.';
  if (p >= 90)  return ' ⚠️ Cuidado: llevas el ' + p + '% de tus ingresos gastado.';
  if (p >= 70)  return ' 👀 Ya usaste el ' + p + '% de tus ingresos del mes.';
  return '';
}

/* ---------- UI base ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2400);
}
function abrirSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').classList.add('open');
  $('#backdrop').classList.add('show');
}
function cerrarSheet() {
  $('#sheet').classList.remove('open');
  $('#backdrop').classList.remove('show');
}
function pedirConfirm(msg, fn) {
  window.__cfm = fn;
  abrirSheet(
    '<h3 class="sheet-title">¿Estás seguro?</h3>' +
    '<p class="muted" style="margin-bottom:16px">' + esc(msg) + '</p>' +
    '<div class="btn-row">' +
      '<button class="btn-ghost btn-sm" data-a="close">Cancelar</button>' +
      '<button class="btn-danger btn-sm" data-a="cfm-si">Sí, continuar</button>' +
    '</div>'
  );
}
function opcionesCat(sel) {
  return D.categorias.map(c =>
    '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + c.emoji + ' ' + esc(c.nombre) + '</option>'
  ).join('');
}
function poblarSubs(catSelId, subSelId, sel) {
  const cat = catInfo($('#' + catSelId).value);
  $('#' + subSelId).innerHTML =
    '<option value="">— Sin subcategoría —</option>' +
    cat.subs.map(s => '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.nombre) + '</option>').join('');
}
function gaugeHTML(ym) {
  const ing = ingresosMes(ym), egr = egresosMes(ym), compras = comprasTarjetaMes(ym);
  const pReal = ing > 0 ? Math.round(egr / ing * 100) : 0;
  const p = Math.min(100, pReal);
  const L = 251.33;                       // largo del semicírculo (r=80)
  const col = pReal < 60 ? 'var(--green)' : pReal < 85 ? 'var(--gold)' : 'var(--red)';
  return '<section class="gauge-card">' +
    '<p class="section-title" style="color:var(--muted)">Medidor · ingresos vs egresos</p>' +
    '<div class="gauge-wrap">' +
      '<svg viewBox="0 0 200 112">' +
        '<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--surf2)" stroke-width="15" stroke-linecap="round"/>' +
        '<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="' + col + '" stroke-width="15" stroke-linecap="round" stroke-dasharray="' + (L * p / 100).toFixed(1) + ' 999" style="filter:drop-shadow(0 0 8px ' + col + ')"/>' +
      '</svg>' +
      '<div class="gauge-center"><div class="gauge-pct mono">' + (ing > 0 ? pReal + '%' : '—') + '</div>' +
      '<div class="gauge-lbl">' + (ing > 0 ? 'de tus ingresos gastado' : 'sin ingresos este mes') + '</div></div>' +
    '</div>' +
    '<div class="g-legend">' +
      '<div class="g-item"><span class="g-k">Ingresos</span><span class="g-v mono pos">' + fmt(ing) + '</span></div>' +
      '<div class="g-item"><span class="g-k">Egresos banco</span><span class="g-v mono neg">' + fmt(egr) + '</span></div>' +
      '<div class="g-item"><span class="g-k">💳 Compras</span><span class="g-v mono" style="color:var(--gold)">' + fmt(compras) + '</span></div>' +
    '</div></section>';
}
function colsHTML(ym) {
  const datos = [
    { k: 'Ingresos', v: ingresosMes(ym), c: 'var(--green)' },
    { k: 'Egresos', v: egresosMes(ym), c: 'var(--red)' },
    { k: '💳 Compras', v: comprasTarjetaMes(ym), c: 'var(--gold)' }
  ];
  const max = Math.max(datos[0].v, datos[1].v, datos[2].v);
  if (!(max > 0)) return '';
  return '<div class="card"><div class="card-head"><span class="card-title">📊 Comparativa del mes</span></div>' +
    '<div class="cols">' + datos.map(d => {
      const hpx = Math.max(6, Math.round(d.v / max * 120));
      return '<div class="col"><span class="col-val mono">' + fmt(d.v) + '</span>' +
        '<div class="col-bar" style="height:' + hpx + 'px;background:' + d.c + '"></div>' +
        '<span class="col-k">' + d.k + '</span></div>';
    }).join('') + '</div>' +
    '<p class="hint" style="text-align:center">Que la columna verde siempre le gane a la roja 💪</p></div>';
}

/* ============================================================
   VISTAS
   ============================================================ */
function vInicio() {
  const sb = saldoBanco();
  const ts = tarjetas();
  const dispT = ts.reduce((t, d) => t + Math.max(0, d.cupo - d.usado), 0);
  const deudaT = ts.reduce((t, d) => t + d.usado, 0);
  const rol = D.roles[mes];
  const porCat = consumoPorCategoria(mes);
  const maxCat = porCat.length ? porCat[0].total : 1;
  const pend = fijosPendientes(mes);
  const recientes = movsDelMes(mes).filter(m => m.origen === 'banco').sort(ordMov).slice(0, 3);

  let h = '<div class="acct-row">' +
    '<button class="acct goldb" data-a="ir" data-v="gastos" style="text-align:left">' +
      '<span class="acct-k">🏦 Efectivo / Bancos</span>' +
      '<span class="acct-v mono" style="color:' + (sb < 0 ? 'var(--red)' : 'var(--cream)') + '">' + fmt(sb) + '</span>' +
      '<span class="acct-s">Saldo disponible</span></button>' +
    '<button class="acct" data-a="ir" data-v="tarjeta" style="text-align:left">' +
      '<span class="acct-k">💳 Tarjeta</span>' +
      (ts.length
        ? '<span class="acct-v mono">' + fmt(dispT) + '</span><span class="acct-s">Cupo libre · deuda ' + fmt(deudaT) + '</span>'
        : '<span class="acct-v" style="font-size:14px;color:var(--muted)">Sin tarjeta</span><span class="acct-s">Toca para agregar</span>') +
    '</button></div>';

  h += gaugeHTML(mes);
  h += colsHTML(mes);

  h += rol
    ? '<button class="pill" data-a="ir" data-v="rol">📄 Rol de ' + nombreMes(mes).split(' ')[0] + ' · líquido ' + fmt(liquidoRol(rol)) + '</button>'
    : '<button class="pill" data-a="ir" data-v="rol">📄 Aún no registras tu rol de ' + nombreMes(mes).split(' ')[0] + '</button>';

  if (pend.length) {
    h += '<div class="card"><div class="card-head"><span class="card-title">📌 Gastos fijos pendientes</span>' +
         '<span class="link">' + pend.length + '</span></div>' +
         '<p class="muted" style="font-size:13px;margin-bottom:12px">' + pend.map(f => esc(f.nombre)).join(' · ') + '</p>' +
         '<button class="btn-ghost" data-a="aplicar-fijos">Aplicar fijos de ' + nombreMes(mes).split(' ')[0] + '</button></div>';
  }

  h += '<div class="section-head"><span class="section-title">Consumo por categoría</span></div>';
  if (porCat.length) {
    h += '<div class="card"><div class="bars">' + porCat.map(x =>
      '<div class="bar">' +
        '<div class="bar-top"><span class="bar-name">' + x.cat.emoji + ' ' + esc(x.cat.nombre) + '</span>' +
        '<span class="bar-amt mono">' + fmt(x.total) + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(4, Math.round(x.total / maxCat * 100)) + '%"></div></div>' +
      '</div>').join('') + '</div>' +
      '<p class="hint">Incluye gastos de banco y compras con tarjeta.</p></div>';
  } else {
    h += '<div class="empty"><b>Sin consumos todavía</b>Usa el botón + para tu primer gasto</div>';
  }

  if (plazos().length) {
    h += '<div class="section-head"><span class="section-title">Deudas a plazos</span>' +
         '<button class="link" data-a="ir" data-v="deudas">Ver todo</button></div>';
    h += plazos().map(d => {
      const saldo = saldoPlazo(d), pagado = d.total - saldo;
      const p = d.total > 0 ? Math.min(100, Math.round(pagado / d.total * 100)) : 0;
      return '<div class="card debt"><div class="debt-top"><span class="debt-name">🏬 ' + esc(d.nombre) + '</span>' +
             '<span class="item-amt mono neg">' + fmt(saldo) + '</span></div>' +
             '<div class="progress"><div class="progress-fill" style="width:' + p + '%"></div></div>' +
             '<div class="debt-meta"><span>Cuota ' + fmt(d.cuota) + ' · ' + d.pagos.length + ' de ' + d.meses + '</span><span>' + p + '%</span></div></div>';
    }).join('');
  }

  h += '<div class="section-head"><span class="section-title">Movimientos recientes</span>' +
       '<button class="link" data-a="ir" data-v="gastos">Ver todo</button></div>';
  h += recientes.length ? recientes.map(m => filaMov(m)).join('')
     : '<div class="empty">Todavía no hay movimientos en ' + nombreMes(mes) + '</div>';
  return h;
}

function filaMov(m, acciones) {
  const c = catInfo(m.catId);
  const sub = subNombre(m.catId, m.subId);
  let badge = '';
  if (m.origen === 'tarjeta') badge = '<span class="badge">💳 tarjeta</span>';
  else if (m.pagoTarjeta) badge = '<span class="badge">pago 💳</span>';
  const btns = acciones
    ? '<button class="icon-btn" data-a="mov-edit" data-id="' + m.id + '">' + ICO_EDIT + '</button>' +
      '<button class="icon-btn" data-a="mov-del" data-id="' + m.id + '">' + ICO_TRASH + '</button>'
    : '';
  return '<div class="item">' +
    '<div class="item-ico">' + c.emoji + '</div>' +
    '<div class="item-main"><div class="item-name">' + esc(m.nota || sub || c.nombre) + ' ' + badge + '</div>' +
    '<div class="item-sub">' + esc(c.nombre + (sub ? ' · ' + sub : '')) + ' · ' + fechaBonita(m.fecha) + '</div></div>' +
    '<span class="item-amt mono ' + (m.tipo === 'gasto' ? 'neg' : 'pos') + '">' +
    (m.tipo === 'gasto' ? '−' : '+') + fmt(m.monto) + '</span>' + btns +
  '</div>';
}

function vGastos() {
  const lista = movsDelMes(mes)
    .filter(m => m.origen === 'banco')
    .filter(m => filtroMov === 'todos' || m.tipo === filtroMov)
    .sort(ordMov);
  let h = '<h2 class="view-title">💸 Gastos y bancos</h2>' +
    '<div class="seg">' +
    ['todos', 'gasto', 'ingreso'].map(f =>
      '<button class="' + (filtroMov === f ? 'active' : '') + '" data-a="filtro" data-f="' + f + '">' +
      (f === 'todos' ? 'Todos' : f === 'gasto' ? 'Gastos' : 'Ingresos') + '</button>').join('') +
    '</div>';
  if (!lista.length) {
    h += '<div class="empty"><b>Nada por aquí</b>Registra movimientos con el botón +</div>';
  } else {
    let fechaAct = '';
    lista.forEach(m => {
      if (m.fecha !== fechaAct) { fechaAct = m.fecha; h += '<p class="date-h">' + fechaBonita(m.fecha) + '</p>'; }
      h += filaMov(m);
    });
    const tg = sumar(lista.filter(m => m.tipo === 'gasto'));
    const ti = sumar(lista.filter(m => m.tipo === 'ingreso'));
    h += '<div class="card"><div class="kpi-row">' +
         '<div class="kpi"><span class="kpi-k">Ingresos extra</span><span class="kpi-v mono pos">' + fmt(ti) + '</span></div>' +
         '<div class="kpi"><span class="kpi-k">Salidas banco</span><span class="kpi-v mono neg">' + fmt(tg) + '</span></div>' +
         '</div></div>';
  }
  h += '<p class="hint" style="text-align:center">Aquí va lo que pagas con efectivo o banco.<br>Los consumos con tarjeta se registran en el módulo 💳 Tarjeta.<br>Para corregir o borrar un movimiento ve a ⚙️ Configuración.</p>';
  return h;
}

function vRol() {
  const rol = D.roles[mes];
  let h = '<h2 class="view-title">📄 Rol de pago</h2>';
  if (!rol) {
    return h + '<div class="empty" style="padding:40px 20px"><b>Rol de ' + nombreMes(mes) + '</b>' +
      'Registra cuánto ganaste este mes y tus descuentos (IESS, anticipos, préstamos…)</div>' +
      '<button class="btn" data-a="rol-crear">Crear rol de ' + nombreMes(mes) + '</button>';
  }
  const ti = sumar(rol.ingresos), td = sumar(rol.descuentos), liq = ti - td;
  const linea = (l, tipo) =>
    '<div class="rol-line"><span class="rl-n">' + esc(l.nombre) + '</span>' +
    '<span class="rl-v mono">' + fmt(l.monto) + '</span>' +
    '<button class="icon-btn" data-a="rol-line-del" data-tipo="' + tipo + '" data-id="' + l.id + '">' + ICO_TRASH + '</button></div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">💵 Ingresos</span></div>' +
    (rol.ingresos.map(l => linea(l, 'ingreso')).join('') || '<p class="hint">Agrega tu sueldo con los botones 👇</p>') +
    '<div class="rol-total"><span>TOTAL INGRESOS</span><span class="mono pos">' + fmt(ti) + '</span></div>' +
    '<div class="chip-row" style="margin-top:8px">' +
    ['Sueldo', 'Horas extra', 'Bono', 'Comisión', 'Otro'].map(n =>
      '<button class="chip" data-a="rol-linea" data-tipo="ingreso" data-n="' + n + '">+ ' + n + '</button>').join('') +
    '</div></div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">📉 Descuentos</span></div>' +
    (rol.descuentos.map(l => linea(l, 'descuento')).join('') || '<p class="hint">Ej: IESS, anticipos, préstamos, sobregiros…</p>') +
    '<div class="rol-total"><span>TOTAL DESCUENTOS</span><span class="mono neg">' + fmt(td) + '</span></div>' +
    '<div class="chip-row" style="margin-top:8px">' +
    '<button class="chip gold" data-a="rol-iess">⚡ IESS 9.45%</button>' +
    ['Anticipo', 'Préstamo Compañía', 'Sobregiro', 'Comisariato', 'Multa', 'Otro'].map(n =>
      '<button class="chip" data-a="rol-linea" data-tipo="descuento" data-n="' + n + '">+ ' + n + '</button>').join('') +
    '</div><p class="hint">Puedes agregar todos los descuentos que necesites. El botón IESS calcula el 9.45% automáticamente.</p></div>';

  h += '<div class="grand"><small>Líquido a recibir</small><span class="rl-big mono">' + fmt(liq) + '</span>' +
       '<p class="hint">Este valor entra a tu saldo de Bancos y cuenta como ingreso de ' + nombreMes(mes) + '.</p></div>';
  h += '<button class="btn-danger" data-a="rol-del" style="margin-top:2px">Eliminar rol de este mes</button>';
  return h;
}

function vTarjeta() {
  let h = '<h2 class="view-title">💳 Tarjeta de crédito</h2>';
  const ts = tarjetas();
  if (!ts.length) {
    return h + '<div class="empty" style="padding:36px 20px"><b>Sin tarjetas</b>Registra tu tarjeta con su cupo para controlar tus consumos</div>' +
      '<button class="btn" data-a="tarjeta-nueva">Agregar tarjeta</button>';
  }
  h += ts.map(d => {
    const disp = Math.max(0, d.cupo - d.usado);
    const p = d.cupo > 0 ? Math.min(100, Math.round(d.usado / d.cupo * 100)) : 0;
    const comprasMes = sumar(movsDelMes(mes).filter(m => m.origen === 'tarjeta' && m.deudaId === d.id));
    return '<div class="card debt">' +
      '<div class="debt-top"><span class="debt-name">💳 ' + esc(d.nombre) + '</span>' +
      '<button class="icon-btn" data-a="deuda-hist" data-id="' + d.id + '">' + ICO_DOTS + '</button></div>' +
      '<div class="kpi-row">' +
        '<div class="kpi"><span class="kpi-k">Deuda</span><span class="kpi-v mono neg">' + fmt(d.usado) + '</span></div>' +
        '<div class="kpi"><span class="kpi-k">Disponible</span><span class="kpi-v mono pos">' + fmt(disp) + '</span></div>' +
        '<div class="kpi"><span class="kpi-k">Cupo</span><span class="kpi-v mono">' + fmt(d.cupo) + '</span></div>' +
      '</div>' +
      '<div class="progress"><div class="progress-fill" style="width:' + p + '%"></div></div>' +
      '<div class="debt-meta"><span>Uso del cupo</span><span>' + p + '%</span></div>' +
      '<div class="debt-meta"><span>Compras de ' + nombreMes(mes).split(' ')[0] + '</span><span class="mono">' + fmt(comprasMes) + '</span></div>' +
      '<div class="btn-row">' +
        '<button class="btn-ghost btn-sm" data-a="compra" data-id="' + d.id + '">🛒 Compra</button>' +
        '<button class="btn btn-sm" data-a="pagot" data-id="' + d.id + '">💰 Pagar tarjeta</button>' +
      '</div></div>';
  }).join('');
  h += '<button class="btn-ghost" data-a="tarjeta-nueva">+ Agregar otra tarjeta</button>' +
       '<p class="hint" style="text-align:center">Las compras aquí suben tu deuda y cuentan en tus categorías,<br>pero no tocan tu saldo de Bancos hasta que pagues.<br>El cupo se corrige solo en ⚙️ Configuración.</p>';
  return h;
}

function vDeudas() {
  let h = '<h2 class="view-title">🏬 Deudas a plazos</h2>';
  const ps = plazos();
  if (!ps.length) {
    return h + '<div class="empty" style="padding:36px 20px"><b>Sin deudas a plazos</b>Ej: los electrodomésticos diferidos del almacén.<br>Pon el total y a cuántos meses.</div>' +
      '<button class="btn" data-a="plazo-nueva">Agregar deuda</button>';
  }
  h += ps.map(d => {
    const saldo = saldoPlazo(d), pagado = d.total - saldo;
    const p = d.total > 0 ? Math.min(100, Math.round(pagado / d.total * 100)) : 0;
    return '<div class="card debt">' +
      '<div class="debt-top"><span class="debt-name">🏬 ' + esc(d.nombre) + '</span>' +
      '<button class="icon-btn" data-a="deuda-hist" data-id="' + d.id + '">' + ICO_DOTS + '</button></div>' +
      '<div class="kpi-row">' +
        '<div class="kpi"><span class="kpi-k">Debes</span><span class="kpi-v mono neg">' + fmt(saldo) + '</span></div>' +
        '<div class="kpi"><span class="kpi-k">Cuota</span><span class="kpi-v mono">' + fmt(d.cuota) + '</span></div>' +
        '<div class="kpi"><span class="kpi-k">Cuotas</span><span class="kpi-v">' + d.pagos.length + ' / ' + d.meses + '</span></div>' +
      '</div>' +
      '<div class="progress"><div class="progress-fill" style="width:' + p + '%"></div></div>' +
      '<div class="debt-meta"><span>Pagado ' + fmt(pagado) + ' de ' + fmt(d.total) + '</span><span>' + p + '%</span></div>' +
      (saldo > 0
        ? '<button class="btn" data-a="cuota" data-id="' + d.id + '">Pagar cuota</button>'
        : '<div class="pill" style="justify-content:center">🎉 ¡Deuda liquidada!</div>') +
      '</div>';
  }).join('');
  h += '<button class="btn-ghost" data-a="plazo-nueva">+ Agregar otra deuda</button>' +
       '<p class="hint" style="text-align:center">Cada cuota que pagues sale de tu saldo de Bancos.<br>Para corregir o eliminar una deuda ve a ⚙️ Configuración.</p>';
  return h;
}

function vAsistente() {
  let h = '<h2 class="view-title">🤖 Asistente</h2>';
  if (!D.asistente.length) {
    return h + '<div class="empty" style="padding:40px 20px"><b>Hola, soy tu asistente Abstergo</b>' +
      'Cada vez que registres un gasto, un pago o una compra,<br>aquí te dejaré un mensaje con lo importante.</div>';
  }
  h += '<div class="chat">' + D.asistente.map(m =>
    '<div class="msg"><span class="msg-emo">' + m.emo + '</span>' +
    '<div class="msg-txt">' + esc(m.txt) + '<span class="msg-time">' + fmtHora(m.ts) + '</span></div></div>'
  ).join('') + '</div>';
  h += '<button class="btn-ghost" data-a="chat-clear" style="margin-top:4px">Limpiar mensajes</button>';
  return h;
}

/* ---------- Configuración ---------- */
function vConfig() {
  let h = '<h2 class="view-title">⚙️ Configuración</h2>';

  h += '<div class="card"><div class="card-head"><span class="card-title">👤 Mi perfil</span></div>' +
    '<div class="row2">' +
      '<div class="field"><label>Nombre</label><input id="p_nombre" value="' + esc(D.perfil.nombre) + '"></div>' +
      '<div class="field"><label>Sueldo base</label><input id="p_sueldo" type="number" inputmode="decimal" step="0.01" value="' + (D.perfil.sueldo || '') + '"></div>' +
    '</div>' +
    '<div class="field"><label>Saldo inicial en bancos</label><input id="p_saldo" type="number" inputmode="decimal" step="0.01" value="' + (D.perfil.saldoInicial || 0) + '"></div>' +
    '<p class="hint">El saldo inicial es lo que tenías en efectivo/bancos antes de empezar a usar la app.</p></div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">🔐 Seguridad</span></div>' +
    '<button class="btn-ghost" data-a="pin-abrir">Cambiar PIN de acceso</button></div>';

  const lista = movsDelMes(mes).sort(ordMov);
  h += '<div class="card"><div class="card-head"><span class="card-title">✏️ Corregir movimientos · ' + nombreMes(mes).split(' ')[0] + '</span></div>';
  h += lista.length
    ? lista.map(m => filaMov(m, true)).join('')
    : '<p class="hint">No hay movimientos en este mes. Cambia de mes arriba a la derecha.</p>';
  if (lista.length) h += '<button class="btn-danger" style="margin-top:12px" data-a="borrar-mes">Borrar movimientos de ' + nombreMes(mes).split(' ')[0] + '</button>';
  h += '<button class="btn-danger" style="margin-top:8px" data-a="borrar-historial">Borrar TODO el historial de movimientos</button></div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">💳 Tarjetas</span></div>';
  h += tarjetas().length ? tarjetas().map(d =>
    '<div class="item" style="border:0;background:transparent;padding:10px 2px">' +
    '<div class="item-ico">💳</div>' +
    '<div class="item-main"><div class="item-name">' + esc(d.nombre) + '</div>' +
    '<div class="item-sub">Cupo ' + fmt(d.cupo) + ' · deuda ' + fmt(d.usado) + '</div></div>' +
    '<button class="icon-btn" data-a="tarjeta-edit" data-id="' + d.id + '">' + ICO_EDIT + '</button></div>'
  ).join('') : '<p class="hint">Sin tarjetas registradas.</p>';
  h += '<p class="hint">Aquí puedes actualizar el cupo, corregir la deuda o eliminar la tarjeta.</p></div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">🏬 Deudas a plazos</span></div>';
  h += plazos().length ? plazos().map(d =>
    '<div class="item" style="border:0;background:transparent;padding:10px 2px">' +
    '<div class="item-ico">🏬</div>' +
    '<div class="item-main"><div class="item-name">' + esc(d.nombre) + '</div>' +
    '<div class="item-sub">Saldo ' + fmt(saldoPlazo(d)) + ' · cuota ' + fmt(d.cuota) + '</div></div>' +
    '<button class="icon-btn" data-a="plazo-edit" data-id="' + d.id + '">' + ICO_EDIT + '</button></div>'
  ).join('') : '<p class="hint">Sin deudas a plazos.</p>';
  h += '</div>';

  const pend = fijosPendientes(mes);
  h += '<div class="card"><div class="card-head"><span class="card-title">🔁 Gastos fijos mensuales</span>' +
       '<button class="link" data-a="fijo-nuevo">+ Agregar</button></div>';
  h += D.fijos.length ? D.fijos.map(f => {
    const c = catInfo(f.catId);
    return '<div class="item" style="border:0;padding:10px 2px;background:transparent">' +
      '<div class="item-ico">' + c.emoji + '</div>' +
      '<div class="item-main"><div class="item-name">' + esc(f.nombre) + '</div>' +
      '<div class="item-sub">Día ' + f.dia + ' · ' + esc(c.nombre) + '</div></div>' +
      '<span class="item-amt mono">' + fmt(f.monto) + '</span>' +
      '<button class="icon-btn" data-a="fijo-edit" data-id="' + f.id + '">' + ICO_EDIT + '</button></div>';
  }).join('') : '<p class="hint">Ej: Netflix, Spotify, Internet, recargas…</p>';
  if (D.fijos.length) {
    h += pend.length
      ? '<button class="btn-ghost" style="margin-top:10px" data-a="aplicar-fijos">Aplicar ' + pend.length + ' fijo(s) a ' + nombreMes(mes).split(' ')[0] + '</button>'
      : '<p class="hint" style="text-align:center">✓ Fijos de ' + nombreMes(mes).split(' ')[0] + ' ya aplicados</p>';
  }
  h += '</div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">🏷️ Categorías</span>' +
       '<button class="link" data-a="cat-nueva">+ Nueva</button></div>';
  h += D.categorias.map(c =>
    '<div style="padding:8px 0;border-bottom:1px dashed var(--line2)">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="font-size:17px">' + c.emoji + '</span><b style="flex:1;font-size:14px">' + esc(c.nombre) + '</b>' +
        '<button class="icon-btn" data-a="cat-del" data-id="' + c.id + '">' + ICO_TRASH + '</button></div>' +
      '<div class="chip-row">' +
        c.subs.map(s => '<button class="chip" data-a="sub-del" data-cat="' + c.id + '" data-id="' + s.id + '">' + esc(s.nombre) + ' ✕</button>').join('') +
        '<button class="chip gold" data-a="sub-nueva" data-id="' + c.id + '">+ sub</button>' +
      '</div></div>').join('');
  h += '<p class="hint">Toca una subcategoría para eliminarla (si no está en uso).</p></div>';

  h += '<div class="card"><div class="card-head"><span class="card-title">💾 Mis datos</span></div>' +
    '<div class="btn-row"><button class="btn-ghost btn-sm" data-a="exportar">Exportar copia</button>' +
    '<button class="btn-ghost btn-sm" data-a="importar">Importar</button></div>' +
    '<input type="file" id="fileImport" accept=".json,application/json" style="display:none">' +
    '<button class="btn-danger" style="margin-top:10px" data-a="borrar-todo">Borrar todos los datos</button>' +
    '<p class="hint">Tus datos viven en este navegador. Exporta una copia de vez en cuando por seguridad.</p></div>';
  return h;
}

/* ---------- Render principal ---------- */
function render() {
  $('#monthLabel').textContent = nombreMes(mes);
  const vistas = { inicio: vInicio, gastos: vGastos, rol: vRol, tarjeta: vTarjeta, deudas: vDeudas, asistente: vAsistente, config: vConfig };
  const v = $('#view');
  v.innerHTML = (vistas[vista] || vInicio)();
  v.style.animation = 'none'; void v.offsetWidth; v.style.animation = '';
}
function setVista(x) {
  vista = x;
  const tabDe = { inicio: 'inicio', gastos: 'gastos', rol: 'rol', tarjeta: 'tarjeta', deudas: 'mas', asistente: 'mas', config: 'mas' };
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabDe[x]));
  cerrarSheet();
  render();
  window.scrollTo({ top: 0 });
}
function sheetMas() {
  abrirSheet(
    '<h3 class="sheet-title">Más opciones</h3>' +
    '<div class="mas-list">' +
      '<button class="d-item" data-a="ir" data-v="deudas"><span>🏬</span>Deudas a plazos</button>' +
      '<button class="d-item" data-a="ir" data-v="asistente"><span>🤖</span>Asistente</button>' +
      '<button class="d-item" data-a="ir" data-v="config"><span>⚙️</span>Configuración</button>' +
      '<button class="d-item" data-a="bloquear-app"><span>🔒</span>Bloquear app</button>' +
    '</div>'
  );
}

/* ---------- Bloqueo por PIN ---------- */
function pintarDots() {
  $('#dots').innerHTML = Array.from({ length: 6 }, (_, i) =>
    '<span class="' + (i < pinBuf.length ? 'full' : '') + '"></span>').join('');
}
function tecla(k) {
  if (k === 'del') { pinBuf = pinBuf.slice(0, -1); pintarDots(); return; }
  if (pinBuf.length >= 6) return;
  pinBuf += k;
  pintarDots();
  if (pinBuf.length === 6) {
    if (pinBuf === String(D.perfil.pin)) {
      bloqueada = false; pinBuf = '';
      $('#lock').classList.add('hide');
      render();
      const pf = fijosPendientes(mes).length;
      burbuja('¡Hola, ' + nombre() + '! 👋 Tu saldo en Bancos: ' + fmt(saldoBanco()) + '.' + (pf ? ' Tienes ' + pf + ' fijo(s) pendientes este mes.' : ' Todo al día ✨'), '🤖');
    } else {
      $('#dots').classList.add('shake');
      toast('PIN incorrecto');
      setTimeout(() => { pinBuf = ''; pintarDots(); $('#dots').classList.remove('shake'); }, 420);
    }
  }
}
function bloquear() {
  bloqueada = true; pinBuf = '';
  pintarDots();
  cerrarSheet();
  $('#lock').classList.remove('hide');
}
function montarKeypad() {
  const teclas = ['1','2','3','4','5','6','7','8','9','','0','del'];
  $('#keypad').innerHTML = teclas.map(k => {
    if (k === '') return '<button class="ghost" disabled></button>';
    if (k === 'del') return '<button class="ghost" data-k="del">⌫</button>';
    return '<button data-k="' + k + '">' + k + '</button>';
  }).join('');
}

/* ============================================================
   HOJAS (formularios)
   ============================================================ */
function sheetMovimiento() {
  tipoMov = 'gasto';
  abrirSheet(
    '<h3 class="sheet-title">Nuevo movimiento · Banco 🏦</h3>' +
    '<div class="seg" style="margin-bottom:14px">' +
      '<button class="active" data-a="seg-tipo" data-t="gasto">Gasto</button>' +
      '<button data-a="seg-tipo" data-t="ingreso">Ingreso extra</button>' +
    '</div>' +
    '<div class="field"><label>Monto</label><input id="f_monto" type="number" inputmode="decimal" step="0.01" placeholder="0.00" autofocus></div>' +
    '<div class="row2">' +
      '<div class="field"><label>Categoría</label><select id="f_cat">' + opcionesCat() + '</select></div>' +
      '<div class="field"><label>Subcategoría</label><select id="f_sub"></select></div>' +
    '</div>' +
    '<div class="row2">' +
      '<div class="field"><label>Fecha</label><input id="f_fecha" type="date" value="' + hoy() + '"></div>' +
      '<div class="field"><label>Nota</label><input id="f_nota" placeholder="Opcional"></div>' +
    '</div>' +
    '<p class="hint" style="margin:-4px 0 12px">💡 Si es una compra con tarjeta, regístrala en el módulo 💳 Tarjeta.</p>' +
    '<button class="btn" data-a="mov-save">Guardar movimiento</button>'
  );
  poblarSubs('f_cat', 'f_sub');
}

function sheetMovEdit(m) {
  const vinculo = m.origen === 'tarjeta' ? 'Compra con tarjeta' : m.pagoTarjeta ? 'Pago de tarjeta' : m.deudaId ? 'Cuota de deuda' : '';
  abrirSheet(
    '<h3 class="sheet-title">✏️ Corregir movimiento</h3>' +
    (vinculo ? '<p class="pill" style="margin-bottom:14px">🔗 ' + vinculo + ' — al corregirlo también se ajusta la deuda</p>' : '') +
    '<div class="field"><label>Monto</label><input id="f_monto" type="number" inputmode="decimal" step="0.01" value="' + m.monto + '"></div>' +
    '<div class="row2">' +
      '<div class="field"><label>Categoría</label><select id="f_cat">' + opcionesCat(m.catId) + '</select></div>' +
      '<div class="field"><label>Subcategoría</label><select id="f_sub"></select></div>' +
    '</div>' +
    '<div class="row2">' +
      '<div class="field"><label>Fecha</label><input id="f_fecha" type="date" value="' + m.fecha + '"></div>' +
      '<div class="field"><label>Nota</label><input id="f_nota" value="' + esc(m.nota) + '"></div>' +
    '</div>' +
    '<button class="btn" data-a="mov-edit-save" data-id="' + m.id + '">Guardar cambios</button>'
  );
  poblarSubs('f_cat', 'f_sub', m.subId);
}

function sheetMes() {
  let h = '<h3 class="sheet-title">Elige el mes</h3>' +
    '<div class="ynav"><button data-a="anio" data-d="-1">‹</button><b>' + pickYear + '</b><button data-a="anio" data-d="1">›</button></div>' +
    '<div class="month-grid">';
  for (let i = 1; i <= 12; i++) {
    const ym = pickYear + '-' + String(i).padStart(2, '0');
    h += '<button class="' + (ym === mes ? 'active' : '') + '" data-a="mes-set" data-ym="' + ym + '">' + MESES[i - 1].slice(0, 3) + '</button>';
  }
  abrirSheet(h + '</div>');
}

function sheetRolLinea(tipo, nombre) {
  abrirSheet(
    '<h3 class="sheet-title">' + (tipo === 'ingreso' ? '💵 Nuevo ingreso' : '📉 Nuevo descuento') + '</h3>' +
    '<div class="field"><label>Concepto</label><input id="f_ln" value="' + esc(nombre === 'Otro' ? '' : nombre) + '" placeholder="Ej: ' + (tipo === 'ingreso' ? 'Horas extra' : 'Anticipo') + '"></div>' +
    '<div class="field"><label>Monto</label><input id="f_lm" type="number" inputmode="decimal" step="0.01" placeholder="0.00" autofocus></div>' +
    '<button class="btn" data-a="rol-linea-save" data-tipo="' + tipo + '">Agregar al rol</button>'
  );
}

function sheetTarjeta(d) {
  const esEdit = !!d;
  d = d || { nombre: '', cupo: '', usado: '' };
  abrirSheet(
    '<h3 class="sheet-title">' + (esEdit ? '✏️ Editar tarjeta' : '💳 Nueva tarjeta de crédito') + '</h3>' +
    '<div class="field"><label>Nombre</label><input id="f_tn" value="' + esc(d.nombre) + '" placeholder="Ej: Visa Pichincha"></div>' +
    '<div class="row2">' +
      '<div class="field"><label>Cupo total</label><input id="f_tc" type="number" inputmode="decimal" step="0.01" value="' + d.cupo + '" placeholder="0.00"></div>' +
      '<div class="field"><label>Deuda actual</label><input id="f_tu" type="number" inputmode="decimal" step="0.01" value="' + d.usado + '" placeholder="0.00"></div>' +
    '</div>' +
    (esEdit ? '<p class="hint" style="margin:-4px 0 12px">Corrige aquí el cupo o la deuda si algo no cuadra.</p>' : '') +
    '<button class="btn" data-a="tarjeta-save" data-id="' + (esEdit ? d.id : '') + '">Guardar</button>' +
    (esEdit ? '<button class="btn-danger" style="margin-top:8px" data-a="deuda-del" data-id="' + d.id + '">Eliminar esta tarjeta</button>' : '')
  );
}

function sheetCompra(d) {
  abrirSheet(
    '<h3 class="sheet-title">🛒 Compra con ' + esc(d.nombre) + '</h3>' +
    '<div class="row2">' +
      '<div class="field"><label>Monto</label><input id="f_dm" type="number" inputmode="decimal" step="0.01" placeholder="0.00" autofocus></div>' +
      '<div class="field"><label>Fecha</label><input id="f_df" type="date" value="' + hoy() + '"></div>' +
    '</div>' +
    '<div class="row2">' +
      '<div class="field"><label>Categoría</label><select id="f_cat">' + opcionesCat() + '</select></div>' +
      '<div class="field"><label>Subcategoría</label><select id="f_sub"></select></div>' +
    '</div>' +
    '<div class="field"><label>Nota</label><input id="f_dn" placeholder="Ej: zapatos, mercado…"></div>' +
    '<p class="hint" style="margin:-4px 0 12px">Sube tu deuda de tarjeta y cuenta en la categoría. No toca tu saldo de Bancos.</p>' +
    '<button class="btn" data-a="compra-save" data-id="' + d.id + '">Registrar compra</button>'
  );
  poblarSubs('f_cat', 'f_sub');
}

function sheetPagoT(d) {
  abrirSheet(
    '<h3 class="sheet-title">💰 Pagar ' + esc(d.nombre) + '</h3>' +
    '<p class="muted" style="margin:-6px 0 14px;font-size:13px">Deuda actual: <b class="mono">' + fmt(d.usado) + '</b></p>' +
    '<div class="row2">' +
      '<div class="field"><label>Monto</label><input id="f_dm" type="number" inputmode="decimal" step="0.01" value="' + (d.usado || '') + '"></div>' +
      '<div class="field"><label>Fecha</label><input id="f_df" type="date" value="' + hoy() + '"></div>' +
    '</div>' +
    '<div class="field"><label>Nota</label><input id="f_dn" placeholder="Opcional"></div>' +
    '<p class="hint" style="margin:-4px 0 12px">El pago sale de tu saldo de Bancos y baja la deuda de la tarjeta.</p>' +
    '<button class="btn" data-a="pagot-save" data-id="' + d.id + '">Registrar pago</button>'
  );
}

function sheetPlazo(d) {
  const esEdit = !!d;
  d = d || { nombre: '', total: '', meses: '', cuota: '' };
  abrirSheet(
    '<h3 class="sheet-title">' + (esEdit ? '✏️ Editar deuda' : '🏬 Nueva deuda a plazos') + '</h3>' +
    '<div class="field"><label>Nombre</label><input id="f_pn" value="' + esc(d.nombre) + '" placeholder="Ej: Electrodomésticos Almacén"></div>' +
    '<div class="row2">' +
      '<div class="field"><label>Deuda total</label><input id="f_pt" type="number" inputmode="decimal" step="0.01" value="' + d.total + '" placeholder="0.00"></div>' +
      '<div class="field"><label>N.º de meses</label><input id="f_pm" type="number" inputmode="numeric" value="' + d.meses + '" placeholder="12"></div>' +
    '</div>' +
    '<div class="row2">' +
      '<div class="field"><label>Cuota mensual</label><input id="f_pc" type="number" inputmode="decimal" step="0.01" value="' + d.cuota + '" placeholder="Se calcula sola"></div>' +
      (esEdit ? '<div></div>' : '<div class="field"><label>Ya pagado ($)</label><input id="f_pp" type="number" inputmode="decimal" step="0.01" placeholder="0.00"></div>') +
    '</div>' +
    '<p class="hint" style="margin:-4px 0 12px">Si dejas la cuota vacía, se calcula: total ÷ meses.</p>' +
    '<button class="btn" data-a="plazo-save" data-id="' + (esEdit ? d.id : '') + '">Guardar deuda</button>' +
    (esEdit ? '<button class="btn-danger" style="margin-top:8px" data-a="deuda-del" data-id="' + d.id + '">Eliminar esta deuda</button>' : '')
  );
}

function sheetCuota(d) {
  const sugerido = Math.min(+d.cuota || 0, saldoPlazo(d)) || saldoPlazo(d);
  abrirSheet(
    '<h3 class="sheet-title">💰 Pagar cuota · ' + esc(d.nombre) + '</h3>' +
    '<p class="muted" style="margin:-6px 0 14px;font-size:13px">Saldo pendiente: <b class="mono">' + fmt(saldoPlazo(d)) + '</b></p>' +
    '<div class="row2">' +
      '<div class="field"><label>Monto</label><input id="f_cm" type="number" inputmode="decimal" step="0.01" value="' + sugerido.toFixed(2) + '"></div>' +
      '<div class="field"><label>Fecha</label><input id="f_cf" type="date" value="' + hoy() + '"></div>' +
    '</div>' +
    '<p class="hint" style="margin:-4px 0 12px">La cuota sale de tu saldo de Bancos y baja la deuda.</p>' +
    '<button class="btn" data-a="cuota-save" data-id="' + d.id + '">Registrar pago</button>'
  );
}

function sheetHist(d) {
  let filas = '';
  if (d.tipo === 'tarjeta') {
    filas = (d.historial || []).slice().reverse().map(x =>
      '<div class="hist-row"><span>' + fechaBonita(x.fecha) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span>' +
      '<b class="mono ' + (x.t === 'pago' ? 'pos' : 'neg') + '">' + (x.t === 'pago' ? '−' : '+') + fmt(x.monto) + '</b></div>').join('');
  } else {
    filas = (d.pagos || []).slice().reverse().map(x =>
      '<div class="hist-row"><span>' + fechaBonita(x.fecha) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span>' +
      '<b class="mono pos">' + fmt(x.monto) + '</b></div>').join('');
  }
  abrirSheet(
    '<h3 class="sheet-title">Historial · ' + esc(d.nombre) + '</h3>' +
    (filas || '<p class="hint">Sin movimientos todavía.</p>') +
    '<p class="hint" style="margin-top:14px">Para corregir o eliminar esta deuda, ve a ⚙️ Configuración.</p>'
  );
}

function sheetFijo(f) {
  const esEdit = !!f;
  f = f || { nombre: '', monto: '', catId: D.categorias.length ? D.categorias[0].id : '', subId: '', dia: 1 };
  abrirSheet(
    '<h3 class="sheet-title">' + (esEdit ? '✏️ Editar' : '🔁 Nuevo') + ' gasto fijo</h3>' +
    '<div class="row2">' +
      '<div class="field"><label>Nombre</label><input id="f_fn" value="' + esc(f.nombre) + '" placeholder="Ej: Netflix"></div>' +
      '<div class="field"><label>Monto</label><input id="f_fm" type="number" inputmode="decimal" step="0.01" value="' + f.monto + '"></div>' +
    '</div>' +
    '<div class="row2">' +
      '<div class="field"><label>Categoría</label><select id="f_fcat">' + opcionesCat(f.catId) + '</select></div>' +
      '<div class="field"><label>Subcategoría</label><select id="f_fsub"></select></div>' +
    '</div>' +
    '<div class="field"><label>Día de cobro (1-31)</label><input id="f_fd" type="number" inputmode="numeric" min="1" max="31" value="' + f.dia + '"></div>' +
    '<button class="btn" data-a="fijo-save" data-id="' + (esEdit ? f.id : '') + '">Guardar</button>' +
    (esEdit ? '<button class="btn-danger" style="margin-top:8px" data-a="fijo-del" data-id="' + f.id + '">Eliminar este fijo</button>' : '')
  );
  poblarSubs('f_fcat', 'f_fsub', f.subId);
}

function sheetCategoria() {
  abrirSheet(
    '<h3 class="sheet-title">🏷️ Nueva categoría</h3>' +
    '<div class="row2">' +
      '<div class="field"><label>Emoji</label><input id="f_ce" maxlength="4" placeholder="🎯"></div>' +
      '<div class="field"><label>Nombre</label><input id="f_cn" placeholder="Ej: Mascotas"></div>' +
    '</div>' +
    '<button class="btn" data-a="cat-save">Crear categoría</button>'
  );
}

function sheetSub(catId) {
  abrirSheet(
    '<h3 class="sheet-title">Nueva subcategoría · ' + esc(catInfo(catId).nombre) + '</h3>' +
    '<div class="field"><label>Nombre</label><input id="f_sn" placeholder="Ej: Comida del perro" autofocus></div>' +
    '<button class="btn" data-a="sub-save" data-id="' + catId + '">Crear</button>'
  );
}

function sheetPin() {
  abrirSheet(
    '<h3 class="sheet-title">🔐 Cambiar PIN</h3>' +
    '<div class="field"><label>PIN actual</label><input id="f_pa" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>' +
    '<div class="row2">' +
      '<div class="field"><label>Nuevo PIN (6 dígitos)</label><input id="f_pnv" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>' +
      '<div class="field"><label>Repetir nuevo</label><input id="f_pr" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>' +
    '</div>' +
    '<button class="btn" data-a="pin-save">Cambiar PIN</button>'
  );
}

/* ============================================================
   ACCIONES
   ============================================================ */
function crearMov(o) {
  const m = {
    id: uid(), tipo: o.tipo, monto: +(+o.monto).toFixed(2), fecha: o.fecha || hoy(),
    catId: o.catId || '', subId: o.subId || '', nota: o.nota || '',
    origen: o.origen || 'banco', creado: Date.now()
  };
  if (o.pagoTarjeta) m.pagoTarjeta = true;
  if (o.deudaId) m.deudaId = o.deudaId;
  if (o.refId) m.refId = o.refId;
  D.movimientos.push(m);
  return m;
}

/* Revertir el efecto de un movimiento vinculado a una deuda (al borrarlo) */
function quitarVinculo(m) {
  if (!m.deudaId) return;
  const d = D.deudas.find(x => x.id === m.deudaId);
  if (!d) return;
  if (m.origen === 'tarjeta') {                 // compra: baja la deuda de la tarjeta
    d.usado = Math.max(0, +(d.usado - m.monto).toFixed(2));
    d.historial = (d.historial || []).filter(h => h.id !== m.refId);
  } else if (m.pagoTarjeta) {                   // pago: la deuda vuelve a subir
    d.usado = +(d.usado + m.monto).toFixed(2);
    d.historial = (d.historial || []).filter(h => h.id !== m.refId);
  } else if (d.tipo === 'plazo') {              // cuota: se quita el pago
    d.pagos = (d.pagos || []).filter(p => p.id !== m.refId);
  }
}
/* Sincronizar cambios de monto/fecha/nota con la deuda vinculada (al editarlo) */
function sincronizarVinculo(m, nuevoMonto, nuevaFecha, nuevaNota) {
  if (!m.deudaId) return;
  const d = D.deudas.find(x => x.id === m.deudaId);
  if (!d) return;
  const delta = +(nuevoMonto - m.monto).toFixed(2);
  if (m.origen === 'tarjeta') d.usado = Math.max(0, +(d.usado + delta).toFixed(2));
  else if (m.pagoTarjeta)     d.usado = Math.max(0, +(d.usado - delta).toFixed(2));
  if (d.tipo === 'tarjeta') {
    const hRef = (d.historial || []).find(x => x.id === m.refId);
    if (hRef) { hRef.monto = nuevoMonto; hRef.fecha = nuevaFecha; if (nuevaNota) hRef.nota = nuevaNota; }
  } else {
    const p = (d.pagos || []).find(x => x.id === m.refId);
    if (p) { p.monto = nuevoMonto; p.fecha = nuevaFecha; }
  }
}

function aplicarFijos() {
  const pend = fijosPendientes(mes);
  if (!pend.length) return toast('No hay fijos pendientes');
  const y = +mes.slice(0, 4), mm = +mes.slice(5, 7);
  const ultimo = new Date(y, mm, 0).getDate();
  let total = 0;
  pend.forEach(f => {
    const dia = Math.min(Math.max(1, +f.dia || 1), ultimo);
    crearMov({ tipo: 'gasto', monto: f.monto, fecha: mes + '-' + String(dia).padStart(2, '0'), catId: f.catId, subId: f.subId, nota: f.nombre });
    (D.fijosAplicados[mes] = D.fijosAplicados[mes] || []).push(f.id);
    total += +f.monto;
  });
  guardar(); render();
  asistir('Apliqué ' + pend.length + ' gastos fijos de ' + nombreMes(mes).split(' ')[0] + ' por ' + fmt(total) + '. Tu saldo en Bancos quedó en ' + fmt(saldoBanco()) + '.' + avisoUsoIngresos(mes), '📌');
}

function accion(a, ds) {
  const deuda = ds.id ? D.deudas.find(d => d.id === ds.id) : null;
  switch (a) {

    case 'ir': setVista(ds.v); break;
    case 'close': cerrarSheet(); break;
    case 'cfm-si': { const fn = window.__cfm; window.__cfm = null; cerrarSheet(); if (fn) fn(); break; }
    case 'filtro': filtroMov = ds.f; render(); break;
    case 'anio': pickYear += +ds.d; sheetMes(); break;
    case 'mes-set': mes = ds.ym; pickYear = +mes.slice(0, 4); cerrarSheet(); render(); break;
    case 'aplicar-fijos': aplicarFijos(); break;
    case 'chat-clear': D.asistente = []; guardar(); render(); break;
    case 'pin-abrir': sheetPin(); break;
    case 'bloquear-app': bloquear(); break;

    case 'pin-save': {
      const actual = $('#f_pa').value.trim(), nuevo = $('#f_pnv').value.trim(), rep = $('#f_pr').value.trim();
      if (actual !== String(D.perfil.pin)) return toast('El PIN actual no coincide');
      if (!/^\d{6}$/.test(nuevo)) return toast('El nuevo PIN debe tener 6 dígitos');
      if (nuevo !== rep) return toast('Los PIN nuevos no coinciden');
      D.perfil.pin = nuevo;
      guardar(); cerrarSheet();
      asistir('PIN cambiado 🔐 Guárdalo bien, ' + nombre() + ' — sin él no entras.', '🔐');
      break;
    }

    case 'seg-tipo':
      tipoMov = ds.t;
      $$('#sheetBody .seg button').forEach(b => b.classList.toggle('active', b.dataset.t === tipoMov));
      break;

    case 'mov-save': {
      const monto = num($('#f_monto').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      const m = crearMov({ tipo: tipoMov, monto, fecha: $('#f_fecha').value || hoy(), catId: $('#f_cat').value, subId: $('#f_sub').value, nota: $('#f_nota').value.trim() });
      guardar(); cerrarSheet(); render();
      if (m.tipo === 'gasto') {
        const c = catInfo(m.catId);
        const totCat = consumoPorCategoria(mes).find(x => x.cat.id === m.catId);
        asistir('Anoté ' + fmt(m.monto) + ' en ' + c.emoji + ' ' + c.nombre + '. Este mes llevas ' + fmt(totCat ? totCat.total : m.monto) + ' en esa categoría.' + avisoUsoIngresos(mes), '💸');
      } else {
        asistir('Ingreso de ' + fmt(m.monto) + ' registrado ✅ Tu saldo en Bancos: ' + fmt(saldoBanco()) + '.', '💵');
      }
      break;
    }

    case 'mov-edit': {
      const m = D.movimientos.find(x => x.id === ds.id);
      if (m) sheetMovEdit(m);
      break;
    }
    case 'mov-edit-save': {
      const m = D.movimientos.find(x => x.id === ds.id);
      if (!m) return;
      const monto = num($('#f_monto').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      const fecha = $('#f_fecha').value || m.fecha;
      const nota = $('#f_nota').value.trim();
      sincronizarVinculo(m, +monto.toFixed(2), fecha, nota);
      m.monto = +monto.toFixed(2); m.fecha = fecha; m.nota = nota;
      m.catId = $('#f_cat').value; m.subId = $('#f_sub').value;
      guardar(); cerrarSheet(); render();
      asistir(pick(['¡Listo, ' + nombre() + '!', 'Corregido ✅', 'Hecho 👌']) + ' El movimiento quedó en ' + fmt(m.monto) + (m.deudaId ? ' y ajusté la deuda vinculada.' : '.'), '✏️');
      break;
    }
    case 'mov-del': {
      const m = D.movimientos.find(x => x.id === ds.id);
      if (!m) return;
      const extra = m.deudaId ? ' También se revertirá en la deuda vinculada.' : '';
      pedirConfirm('Se eliminará este movimiento.' + extra, () => {
        quitarVinculo(m);
        D.movimientos = D.movimientos.filter(x => x.id !== ds.id);
        guardar(); render(); asistir('Eliminé ese movimiento 🗑️ Tu saldo en Bancos: ' + fmt(saldoBanco()) + '.', '✏️');
      });
      break;
    }
    case 'borrar-mes':
      pedirConfirm('Se borrarán todos los movimientos de ' + nombreMes(mes) + '. Tus deudas NO se modifican.', () => {
        D.movimientos = D.movimientos.filter(m => !m.fecha.startsWith(mes));
        guardar(); render(); asistir('Borré todos los movimientos de ' + nombreMes(mes).split(' ')[0] + ' 🧹 Tus deudas quedaron intactas.', '🧹');
      });
      break;
    case 'borrar-historial':
      pedirConfirm('Se borrará TODO el historial de movimientos de todos los meses. Tus deudas, roles y fijos NO se modifican.', () => {
        D.movimientos = [];
        guardar(); render(); asistir('Borré todo tu historial de movimientos 🧹 Deudas, roles y fijos siguen intactos.', '🧹');
      });
      break;

    /* ----- Rol de pago ----- */
    case 'rol-crear': {
      const ing = [];
      if (D.perfil.sueldo > 0) ing.push({ id: uid(), nombre: 'Sueldo', monto: +D.perfil.sueldo });
      D.roles[mes] = { ingresos: ing, descuentos: [] };
      guardar(); render();
      asistir('Rol de ' + nombreMes(mes).split(' ')[0] + ' creado con tu sueldo base. Agrega horas extra y descuentos cuando quieras.', '📄');
      break;
    }
    case 'rol-linea': sheetRolLinea(ds.tipo, ds.n); break;
    case 'rol-linea-save': {
      const rol = D.roles[mes]; if (!rol) return;
      const nombre = $('#f_ln').value.trim() || (ds.tipo === 'ingreso' ? 'Ingreso' : 'Descuento');
      const monto = num($('#f_lm').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      (ds.tipo === 'ingreso' ? rol.ingresos : rol.descuentos).push({ id: uid(), nombre, monto: +monto.toFixed(2) });
      guardar(); cerrarSheet(); render();
      asistir((ds.tipo === 'ingreso' ? 'Sumé ' : 'Anoté el descuento ') + nombre + ' de ' + fmt(monto) + ' a tu rol. Líquido: ' + fmt(liquidoRol(D.roles[mes])) + '.', '📄');
      break;
    }
    case 'rol-iess': {
      const rol = D.roles[mes]; if (!rol) return;
      const ti = sumar(rol.ingresos);
      if (!(ti > 0)) return toast('Primero agrega tus ingresos');
      const monto = Math.round(ti * 945 / 100) / 100;
      const ya = rol.descuentos.find(l => l.nombre.toUpperCase().startsWith('IESS'));
      if (ya) { ya.monto = monto; } else { rol.descuentos.push({ id: uid(), nombre: 'IESS 9.45%', monto }); }
      guardar(); render();
      asistir('Calculé tu IESS: ' + fmt(monto) + ' — el 9.45% de ' + fmt(ti) + '. Igualito a tu rol 😉', '⚡');
      break;
    }
    case 'rol-line-del': {
      const rol = D.roles[mes]; if (!rol) return;
      const arr = ds.tipo === 'ingreso' ? 'ingresos' : 'descuentos';
      rol[arr] = rol[arr].filter(l => l.id !== ds.id);
      guardar(); render();
      break;
    }
    case 'rol-del':
      pedirConfirm('Se eliminará el rol de ' + nombreMes(mes) + ' con todos sus valores.', () => {
        delete D.roles[mes]; guardar(); render();
        asistir('Eliminé el rol de ' + nombreMes(mes).split(' ')[0] + ' 📄 Puedes crearlo de nuevo cuando quieras.', '📄');
      });
      break;

    /* ----- Tarjeta ----- */
    case 'tarjeta-nueva': sheetTarjeta(); break;
    case 'tarjeta-edit': if (deuda) sheetTarjeta(deuda); break;
    case 'tarjeta-save': {
      const nombre = $('#f_tn').value.trim();
      const cupo = num($('#f_tc').value), usado = Math.max(0, num($('#f_tu').value));
      if (!nombre) return toast('Ponle un nombre a la tarjeta');
      if (!(cupo > 0)) return toast('Ingresa el cupo total');
      if (deuda) { deuda.nombre = nombre; deuda.cupo = cupo; deuda.usado = usado; asistir('Actualicé la tarjeta ' + nombre + ': cupo ' + fmt(cupo) + ', deuda ' + fmt(usado) + '.', '💳'); }
      else { D.deudas.push({ id: uid(), tipo: 'tarjeta', nombre, cupo, usado, historial: [] }); asistir('Tarjeta ' + nombre + ' registrada 💳 Cupo: ' + fmt(cupo) + '. Anota tus compras desde el módulo Tarjeta.', '💳'); }
      guardar(); cerrarSheet(); render();
      break;
    }
    case 'compra': if (deuda) sheetCompra(deuda); break;
    case 'compra-save': {
      if (!deuda) return;
      const monto = num($('#f_dm').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      const fecha = $('#f_df').value || hoy();
      const nota = $('#f_dn').value.trim();
      const histId = uid();
      deuda.historial.push({ id: histId, t: 'compra', monto: +monto.toFixed(2), fecha, nota });
      deuda.usado = +(deuda.usado + monto).toFixed(2);
      crearMov({ tipo: 'gasto', monto, fecha, catId: $('#f_cat').value, subId: $('#f_sub').value, nota: nota || ('Compra ' + deuda.nombre), origen: 'tarjeta', deudaId: deuda.id, refId: histId });
      guardar(); cerrarSheet(); render();
      const uso = deuda.cupo > 0 ? Math.round(deuda.usado / deuda.cupo * 100) : 0;
      asistir('Compra de ' + fmt(monto) + ' con ' + deuda.nombre + '. Cupo disponible: ' + fmt(Math.max(0, deuda.cupo - deuda.usado)) + (uso >= 80 ? '. ⚠️ Ya usaste el ' + uso + '% del cupo.' : ' (' + uso + '% usado).'), '🛒');
      break;
    }
    case 'pagot': if (deuda) sheetPagoT(deuda); break;
    case 'pagot-save': {
      if (!deuda) return;
      const monto = num($('#f_dm').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      const fecha = $('#f_df').value || hoy();
      const nota = $('#f_dn').value.trim();
      const histId = uid();
      deuda.historial.push({ id: histId, t: 'pago', monto: +monto.toFixed(2), fecha, nota });
      deuda.usado = Math.max(0, +(deuda.usado - monto).toFixed(2));
      const c = catPorNombre('Deudas');
      crearMov({ tipo: 'gasto', monto, fecha, catId: c ? c.id : '', nota: 'Pago ' + deuda.nombre, pagoTarjeta: true, deudaId: deuda.id, refId: histId });
      guardar(); cerrarSheet(); render();
      asistir('Pagaste ' + fmt(monto) + ' a ' + deuda.nombre + ' ✅ Deuda actual: ' + fmt(deuda.usado) + '. Saldo en Bancos: ' + fmt(saldoBanco()) + '.', '💳');
      break;
    }

    /* ----- Deudas a plazos ----- */
    case 'plazo-nueva': sheetPlazo(); break;
    case 'plazo-edit': if (deuda) sheetPlazo(deuda); break;
    case 'plazo-save': {
      const nombre = $('#f_pn').value.trim();
      const total = num($('#f_pt').value), meses = Math.max(1, Math.round(num($('#f_pm').value)));
      let cuota = num($('#f_pc').value);
      if (!nombre) return toast('Ponle un nombre a la deuda');
      if (!(total > 0)) return toast('Ingresa el total de la deuda');
      if (!(cuota > 0)) cuota = +(total / meses).toFixed(2);
      if (deuda) {
        deuda.nombre = nombre; deuda.total = total; deuda.meses = meses; deuda.cuota = cuota;
        asistir('Actualicé la deuda ' + nombre + ': total ' + fmt(total) + ', cuota ' + fmt(cuota) + '.', '🏬');
      } else {
        const yaPagado = num($('#f_pp') ? $('#f_pp').value : 0);
        const pagos = yaPagado > 0 ? [{ id: uid(), monto: +yaPagado.toFixed(2), fecha: hoy(), nota: 'Saldo inicial' }] : [];
        D.deudas.push({ id: uid(), tipo: 'plazo', nombre, total, meses, cuota, pagos });
        asistir('Deuda ' + nombre + ' registrada 🏬 ' + meses + ' cuotas de ' + fmt(cuota) + '. ¡Vamos a liquidarla!', '🏬');
      }
      guardar(); cerrarSheet(); render();
      break;
    }
    case 'cuota': if (deuda) sheetCuota(deuda); break;
    case 'cuota-save': {
      if (!deuda) return;
      const monto = num($('#f_cm').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      const fecha = $('#f_cf').value || hoy();
      const pagoId = uid();
      deuda.pagos.push({ id: pagoId, monto: +monto.toFixed(2), fecha });
      const c = catPorNombre('Deudas');
      crearMov({ tipo: 'gasto', monto, fecha, catId: c ? c.id : '', nota: 'Cuota ' + deuda.nombre, deudaId: deuda.id, refId: pagoId });
      guardar(); cerrarSheet(); render();
      const saldo = saldoPlazo(deuda);
      if (saldo <= 0) asistir('🎉 ¡Liquidaste ' + deuda.nombre + '! Una deuda menos. Tu saldo en Bancos: ' + fmt(saldoBanco()) + '.', '🎉');
      else asistir('Cuota de ' + deuda.nombre + ' pagada ✅ Van ' + deuda.pagos.length + ' de ' + deuda.meses + '. Te falta ' + fmt(saldo) + '.', '🏬');
      break;
    }
    case 'deuda-hist': if (deuda) sheetHist(deuda); break;
    case 'deuda-del':
      pedirConfirm('Se eliminará esta deuda y su historial (los gastos ya registrados no se borran).', () => {
        D.deudas = D.deudas.filter(d => d.id !== ds.id);
        guardar(); render(); asistir('Eliminé esa deuda y su historial ✅ Los gastos ya registrados no se tocaron.', '🗑️');
      });
      break;

    /* ----- Fijos ----- */
    case 'fijo-nuevo': sheetFijo(); break;
    case 'fijo-edit': sheetFijo(D.fijos.find(f => f.id === ds.id)); break;
    case 'fijo-save': {
      const nombre = $('#f_fn').value.trim();
      const monto = num($('#f_fm').value);
      if (!nombre) return toast('Ponle un nombre');
      if (!(monto > 0)) return toast('Ingresa un monto válido');
      const dato = {
        nombre, monto: +monto.toFixed(2),
        catId: $('#f_fcat').value, subId: $('#f_fsub').value,
        dia: Math.min(31, Math.max(1, Math.round(num($('#f_fd').value)) || 1))
      };
      const ex = D.fijos.find(f => f.id === ds.id);
      if (ex) Object.assign(ex, dato); else D.fijos.push(Object.assign({ id: uid() }, dato));
      guardar(); cerrarSheet(); render();
      asistir('Fijo ' + dato.nombre + ' guardado: ' + fmt(dato.monto) + ' cada día ' + dato.dia + ' 🔁', '🔁');
      break;
    }
    case 'fijo-del':
      pedirConfirm('Se eliminará este gasto fijo (no borra gastos ya aplicados).', () => {
        D.fijos = D.fijos.filter(f => f.id !== ds.id);
        guardar(); render(); asistir('Quité ese gasto fijo 👌 Ya no lo aplicaré en tus meses.', '🔁');
      });
      break;

    /* ----- Categorías ----- */
    case 'cat-nueva': sheetCategoria(); break;
    case 'cat-save': {
      const nombre = $('#f_cn').value.trim();
      if (!nombre) return toast('Ponle un nombre');
      D.categorias.push({ id: uid(), emoji: $('#f_ce').value.trim() || '🏷️', nombre, subs: [] });
      guardar(); cerrarSheet(); render();
      asistir('Categoría nueva lista 🏷️ Ya puedes usarla en tus gastos.', '🏷️');
      break;
    }
    case 'cat-del': {
      const usada = D.movimientos.some(m => m.catId === ds.id) || D.fijos.some(f => f.catId === ds.id);
      if (usada) return toast('No se puede: tiene movimientos o fijos');
      pedirConfirm('Se eliminará la categoría "' + catInfo(ds.id).nombre + '".', () => {
        D.categorias = D.categorias.filter(c => c.id !== ds.id);
        guardar(); render();
      });
      break;
    }
    case 'sub-nueva': sheetSub(ds.id); break;
    case 'sub-save': {
      const nombre = $('#f_sn').value.trim();
      if (!nombre) return toast('Ponle un nombre');
      catInfo(ds.id).subs.push({ id: uid(), nombre });
      guardar(); cerrarSheet(); render(); toast('✓ Subcategoría creada');
      break;
    }
    case 'sub-del': {
      const usada = D.movimientos.some(m => m.subId === ds.id) || D.fijos.some(f => f.subId === ds.id);
      if (usada) return toast('No se puede: está en uso');
      pedirConfirm('¿Eliminar esta subcategoría?', () => {
        const c = catInfo(ds.cat);
        c.subs = c.subs.filter(s => s.id !== ds.id);
        guardar(); render();
      });
      break;
    }

    /* ----- Datos ----- */
    case 'exportar': {
      const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
      const aEl = document.createElement('a');
      aEl.href = URL.createObjectURL(blob);
      aEl.download = 'abstergo-' + hoy() + '.json';
      aEl.click();
      asistir('Exporté tu copia de seguridad 📦 Guárdala en un lugar seguro.', '💾');
      break;
    }
    case 'importar': $('#fileImport').click(); break;
    case 'borrar-todo':
      pedirConfirm('Se borrará TODO: movimientos, roles, deudas y ajustes.', () => {
        localStorage.removeItem(LS_KEY);
        D = datosIniciales(); guardar(); render(); asistir('Reinicié Abstergo desde cero 🧹 Cuando quieras, empezamos de nuevo.', '🧹');
      });
      break;
  }
}

/* ---------- Eventos globales ---------- */
document.addEventListener('click', e => {
  const k = e.target.closest('[data-k]');
  if (k) { tecla(k.dataset.k); return; }
  const el = e.target.closest('[data-a]');
  if (el) { accion(el.dataset.a, el.dataset); return; }
  const tb = e.target.closest('.tab');
  if (tb) { if (tb.dataset.tab === 'mas') sheetMas(); else setVista(tb.dataset.tab); }
});
$('#fab').addEventListener('click', sheetMovimiento);
$('#monthBtn').addEventListener('click', () => { pickYear = +mes.slice(0, 4); sheetMes(); });
$('#backdrop').addEventListener('click', cerrarSheet);
$('#bubble').addEventListener('click', () => { $('#bubble').classList.remove('show'); setVista('asistente'); });

document.addEventListener('change', e => {
  if (e.target.id === 'p_nombre') asistir('¡Anotado! Desde ahora te llamo ' + nombre() + ' 😄', '⚙️');
  if (e.target.id === 'p_sueldo') asistir('Actualicé tu sueldo base a ' + fmt(D.perfil.sueldo) + '. Lo usaré al crear tus próximos roles.', '⚙️');
  if (e.target.id === 'p_saldo')  asistir('Ajusté tu saldo inicial. Tu saldo en Bancos ahora: ' + fmt(saldoBanco()) + '.', '🏦');
  if (e.target.id === 'f_cat') poblarSubs('f_cat', 'f_sub');
  if (e.target.id === 'f_fcat') poblarSubs('f_fcat', 'f_fsub');
  if (e.target.id === 'fileImport') {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.categorias || !data.movimientos) throw 0;
        D = migrar(data); guardar(); render(); asistir('¡Datos importados! Bienvenido de vuelta, ' + nombre() + ' ✨', '💾');
      } catch (_) { toast('Archivo no válido'); }
    };
    r.readAsText(file);
    e.target.value = '';
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'p_nombre') { D.perfil.nombre = e.target.value; guardar(); }
  if (e.target.id === 'p_sueldo') { D.perfil.sueldo = num(e.target.value); guardar(); }
  if (e.target.id === 'p_saldo')  { D.perfil.saldoInicial = num(e.target.value); guardar(); }
});

/* ---------- Arranque ---------- */
montarKeypad();
pintarDots();
render();
