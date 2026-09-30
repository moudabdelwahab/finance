// UI layer (redesign). Data, forecast and utils modules are unchanged.
import { $, esc, fmt, toMinor, ymd, today, addDays } from './utils.js';
import * as db from './data.js';
import { summarize, monthStats, events } from './forecast.js';

let st, page = (location.hash || '#home').slice(1), txf = 'all';
const app = $('#app');
const CATS = ['طعام', 'مواصلات', 'فواتير', 'صحة', 'ترفيه', 'تسوق', 'أخرى'];

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  rec: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  set: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  up: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', dn: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
  al: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
  wal: '<path d="M4 7h14a2 2 0 012 2v10H6a2 2 0 01-2-2z"/><path d="M4 7V6a2 2 0 012-2h11"/><circle cx="16" cy="14" r="1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', moon: '<path d="M20 14A8 8 0 1110 4a7 7 0 0010 10z"/>',
  out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>', flask: '<path d="M9 3h6M10 3v6L4 20h16L14 9V3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chev: '<path d="M15 6l-6 6 6 6"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const chip = (n, t) => `<span class="chip t-${t}">${ic(n)}</span>`;
const empty = (n, t, h = '') => `<div class="empty">${chip(n, 'blu')}<span>${t}</span>${h}</div>`;

const ENT = {
  accounts: { t: 'الحسابات', ico: 'wal', f: [['name', 'اسم الحساب', 'text'], ['opening', 'الرصيد الحالي', 'money']], row: r => [r.name, 'رصيد افتتاحي ' + fmt(r.opening)] },
  income_sources: { t: 'مصادر الدخل الشهري', ico: 'up', f: [['name', 'المصدر (مثل: الراتب)', 'text'], ['expected', 'المبلغ المتوقع', 'money'], ['pay_day', 'يوم القبض', 'int']], row: r => [r.name, `${fmt(r.expected)} · يوم ${r.pay_day}`] },
  obligations: { t: 'الالتزامات الدورية', ico: 'rec', f: [['name', 'الاسم', 'text'], ['amount', 'المبلغ', 'money'], ['kind', 'النوع', 'sel:rent|إيجار,bill|فاتورة,sub|اشتراك,family|دعم أسرة'], ['freq', 'التكرار', 'sel:monthly|شهري,quarterly|ربع سنوي,yearly|سنوي'], ['next_due', 'الاستحقاق القادم', 'date']], row: r => [r.name, `${fmt(r.amount)} · ${r.next_due}`] },
  debts: { t: 'الديون', ico: 'card', f: [['name', 'الدائن', 'text'], ['total', 'إجمالي الدين', 'money'], ['remaining', 'المتبقي', 'money'], ['monthly', 'القسط الشهري', 'money'], ['due_day', 'يوم الاستحقاق', 'int']], row: r => [r.name, `متبقي ${fmt(r.remaining)} · قسط ${fmt(r.monthly)}`, r.total ? Math.round((1 - r.remaining / r.total) * 100) : 0] },
};

const field = ([k, l, ty]) => ty.startsWith('sel')
  ? `<label>${l}<select name="${k}">${ty.slice(4).split(',').map(x => x.split('|')).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>`
  : ty == 'money' ? `<label>${l}<div class="inp"><input name="${k}" required inputmode="decimal" placeholder="0.00"><em>ج.م</em></div></label>`
  : `<label>${l}<input name="${k}" required ${ty == 'int' ? 'type="number" min="1" max="31" inputmode="numeric"' : ty == 'date' ? `type="date" value="${ymd(today())}"` : ''}></label>`;
const form = e => `<form data-e="${e}" class="card fm"><div class="ch"><h2>إضافة: ${ENT[e].t}</h2>${chip(ENT[e].ico, 'blu')}</div>${ENT[e].f.map(field).join('')}<button>${ic('plus', 'sm')}إضافة</button></form>`;
const list = e => `<div class="card"><div class="ch"><h2>${ENT[e].t}</h2>${chip(ENT[e].ico, 'blu')}</div>${st[e].length ? st[e].map(r => { const [a, b, p] = ENT[e].row(r);
  return `<div class="row"><div class="l"><div style="min-width:0"><b>${esc(a)}</b><small>${esc(b)}</small>${p != null ? `<div class="bar" style="width:150px"><i style="width:${p}%"></i></div>` : ''}</div></div><div>${e == 'debts' ? `<button class="s" data-pay="${r.id}">سداد</button>` : ''}<button class="s g" data-del="${e}:${r.id}" aria-label="حذف">${ic('x', 'sm')}</button></div></div>`; }).join('')
  : empty('inbox', 'لا يوجد شيء بعد. أضف أول عنصر من النموذج أدناه.')}</div>`;

const area = s => { const v = s.map(x => x.bal), mn = Math.min(...v, 0), r = (Math.max(...v) - mn) || 1, n = v.length - 1;
  const pts = v.map((y, i) => [(1 - i / n) * 300, 70 - ((y - mn) / r) * 62]), line = pts.map(p => p.join(',')).join(' ');
  const z = 70 - ((0 - mn) / r) * 62;
  return `<svg viewBox="0 0 300 80" preserveAspectRatio="none" style="width:100%;height:150px" role="img" aria-label="توقع الرصيد"><defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--blu)" stop-opacity=".3"/><stop offset="1" stop-color="var(--blu)" stop-opacity="0"/></linearGradient></defs>
  <line x1="0" x2="300" y1="${z}" y2="${z}" stroke="var(--bd)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><polygon points="0,80 ${line} 300,80" fill="url(#gr)"/><polyline points="${line}" fill="none" stroke="var(--blu)" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
  <div class="ch"><small>${s[n].d}</small><small>${s[0].d}</small></div>`; };

const tile = (n, t, l, v) => `<div class="stat">${chip(n, t)}<small>${l}</small><b class="num">${fmt(v)}</b></div>`;
const txRow = t => `<div class="row"><div class="l">${chip(t.kind == 'income' ? 'up' : 'dn', t.kind == 'income' ? 'ok' : 'bad')}<div><b>${esc(t.category || 'معاملة')}</b><small>${t.tx_date}${t.note ? ' · ' + esc(t.note) : ''}</small></div></div><span class="${t.kind == 'income' ? 'pos' : 'neg'} num">${t.kind == 'income' ? '+' : '-'}${fmt(t.amount)}</span></div>`;
const head = (t, extra = '') => `<div class="top"><h1>${t}</h1>${extra}</div>`;

const home = () => {
  if (!st.accounts.length) return head('أهلاً بك') + `<div class="card"><div class="ch"><h2>ابدأ من هنا</h2>${chip('wal', 'blu')}</div><p class="mut" style="margin:0">أضف حسابك ورصيدك الحالي لنحسب لك المتاح فعليًا.</p></div>` + form('accounts');
  const s = summarize(st), m = monthStats(st), tx = st.transactions.slice(0, 6), ld = st.settings.living_daily, bud = ld * 30;
  const pct = bud ? Math.min(100, Math.round(m.exp / bud * 100)) : 0, cat = {};
  st.transactions.filter(t => t.kind == 'expense' && t.tx_date.startsWith(ymd(today()).slice(0, 7))).forEach(t => cat[t.category || 'أخرى'] = (cat[t.category || 'أخرى'] || 0) + t.amount);
  const cats = Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 4), cmax = cats[0]?.[1] || 1;
  return `<div class="card hero"><small>المتاح فعليًا</small><div class="big num">${fmt(s.available)}</div><div class="meta"><span class="pill">${ic('wal', 'sm')}الرصيد ${fmt(s.bal)}</span><span class="pill">${ic('clock', 'sm')}الراتب القادم بعد ${s.days} يوم</span></div></div>
  ${s.warn ? `<div class="card warn">${ic('al')}<span>قد ينفد رصيدك بتاريخ ${s.warn} قبل الراتب القادم.</span></div>` : ''}
  <div class="stats">${tile('wal', 'blu', 'الرصيد الحالي', s.bal)}${tile('clock', 'amb', 'الالتزامات القادمة', s.due)}${tile('dn', 'bad', 'مصروفات الشهر', m.exp)}${tile('up', 'ok', 'حد الصرف اليومي', s.daily)}</div>
  <div class="cols w"><div class="card"><div class="ch"><h2>حركة السيولة المتوقعة</h2><small>٣٥ يومًا</small></div>${area(s.series)}
  <div class="split"><div><small>دخل الشهر</small><b class="pos num">${fmt(m.inc)}</b></div><div><small>مصروف الشهر</small><b class="neg num">${fmt(m.exp)}</b></div><div><small>نهاية الشهر</small><b class="num ${s.eom < 0 ? 'neg' : ''}">${fmt(s.eom)}</b></div></div></div>
  <div class="card"><div class="ch"><h2>الالتزامات القادمة</h2><a href="#cal">الكل</a></div>${s.up.slice(0, 5).map(e => `<div class="row"><div class="l">${chip(e.amt < 0 ? 'clock' : 'up', e.amt < 0 ? 'amb' : 'ok')}<div><b>${esc(e.label)}</b><small>${e.date}</small></div></div><span class="${e.amt < 0 ? 'amb' : 'pos'} num">${fmt(Math.abs(e.amt))}</span></div>`).join('') || empty('cal', 'لا توجد استحقاقات قريبة.', '<a href="#cal" style="color:var(--blu)">أضف دخلك والتزاماتك</a>')}</div></div>
  <div class="cols two"><div class="card"><div class="ch"><h2>الديون</h2><small>${fmt(s.debt)}</small></div>${st.debts.map(d => `<div><div class="ch"><b style="font-weight:600">${esc(d.name)}</b><small>متبقي ${fmt(d.remaining)}</small></div><div class="bar b"><i style="width:${d.total ? Math.round((1 - d.remaining / d.total) * 100) : 0}%"></i></div></div>`).join('') || empty('card', 'لا توجد ديون مسجلة.')}</div>
  <div class="card"><div class="ch"><h2>ميزانية الشهر</h2><small>${bud ? fmt(bud) : ''}</small></div>${bud ? `<div><div class="ch"><b class="num">${fmt(m.exp)}</b><small>${pct}%</small></div><div class="bar ${pct > 90 ? 'r' : pct > 70 ? 'a' : ''}"><i style="width:${pct}%"></i></div></div>` : empty('set', 'حدد مصروف المعيشة اليومي لتظهر الميزانية.', '<a href="#more" style="color:var(--blu)">فتح الإعدادات</a>')}
  ${cats.map(([c, v]) => `<div><div class="ch"><span>${esc(c)}</span><small class="num">${fmt(v)}</small></div><div class="bar b"><i style="width:${Math.round(v / cmax * 100)}%"></i></div></div>`).join('')}</div></div>
  <div class="card"><div class="ch"><h2>آخر العمليات</h2><a href="#tx">الكل</a></div>${tx.map(txRow).join('') || empty('rec', 'لم تسجّل أي معاملة بعد.', '<a href="#add" style="color:var(--blu)">سجّل أول عملية</a>')}</div>`;
};
const add = () => head('إضافة عملية') + (!st.accounts.length ? form('accounts') : `<form id="qx" class="card"><div class="seg"><label><input type="radio" name="kind" value="expense" checked><span>${ic('dn', 'sm')}مصروف</span></label><label><input type="radio" name="kind" value="income"><span>${ic('up', 'sm')}دخل</span></label></div>
  <div class="inp"><input class="amt" name="amount" inputmode="decimal" placeholder="0" required aria-label="المبلغ"><em>ج.م</em></div>
  <div class="chips">${CATS.map((c, i) => `<label><input type="radio" name="category" value="${c}" ${i ? '' : 'checked'}><span>${c}</span></label>`).join('')}</div>
  <label>الحساب<select name="account_id">${st.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
  <label>ملاحظة<input name="note" placeholder="اختياري"></label><button>${ic('plus', 'sm')}حفظ العملية</button></form>`);
const tx = () => { let last = '';
  const rows = st.transactions.filter(t => txf == 'all' || t.kind == txf).map(t => { const h = t.tx_date != last ? `<div class="dh">${t.tx_date}</div>` : ''; last = t.tx_date; return h + txRow(t); }).join('');
  return head('المعاملات') + `<div class="chips" style="margin-bottom:14px">${[['all', 'الكل'], ['income', 'دخل'], ['expense', 'مصروف']].map(([k, l]) => `<label><input type="radio" name="f" ${k == txf ? 'checked' : ''} data-f="${k}"><span>${l}</span></label>`).join('')}</div><div class="card">${rows || empty('rec', 'لا توجد معاملات.')}</div>`; };
const cal = () => { const t = today(), ev = events(st, t, addDays(t, 45)); let last = '';
  return head('التقويم') + `<div class="card"><div class="ch"><h2>الأيام القادمة</h2><small>٤٥ يومًا</small></div>${ev.map(e => { const h = e.date != last ? `<div class="dh">${e.date}</div>` : ''; last = e.date;
    return h + `<div class="row"><div class="l">${chip(e.type == 'income' ? 'up' : e.type == 'debt' ? 'card' : 'clock', e.type == 'income' ? 'ok' : 'amb')}<b>${esc(e.label)}</b></div><span class="${e.amt < 0 ? 'amb' : 'pos'} num">${fmt(Math.abs(e.amt))}</span></div>`; }).join('') || empty('cal', 'أضف مصادر الدخل والالتزامات لتظهر هنا.')}</div>` + ['income_sources', 'obligations', 'debts'].map(e => list(e) + form(e)).join(''); };
const sim = () => head('تجربة سيناريو', `<a href="#more" class="mut">${ic('chev')}</a>`) + `<div class="card"><small>لا يغيّر بياناتك الحقيقية</small>${[['s1', 'الراتب الجديد', '17000'], ['s2', 'دفعة إضافية للدين شهريًا', '1000'], ['s3', 'زيادة الإيجار', '500']].map(([i, l, p]) => `<label>${l}<div class="inp"><input id="${i}" inputmode="decimal" placeholder="مثال: ${p}"><em>ج.م</em></div></label>`).join('')}</div><div id="simres"></div>`;
function runSim() {
  const v = i => $('#' + i).value.trim(), o = { salary: v('s1') ? toMinor(v('s1')) : null, extraDebt: toMinor(v('s2')), rentDelta: toMinor(v('s3')) };
  const a = summarize(st), b = summarize(st, o), r = (l, x, y) => `<div class="row"><span>${l}</span><span class="num">${fmt(x)} ← <b class="${y >= x ? 'pos' : 'neg'}">${fmt(y)}</b></span></div>`;
  $('#simres').innerHTML = `<div class="card"><small>الآن ← بعد السيناريو</small>${r('المتاح فعليًا', a.available, b.available)}${r('حد الصرف اليومي', a.daily, b.daily)}${r('نهاية الشهر', a.eom, b.eom)}${b.warn ? `<div class="neg ch" style="justify-content:flex-start">${ic('al', 'sm')}سينفد الرصيد بتاريخ ${b.warn}</div>` : ''}</div>`;
}
const more = () => head('المزيد') + `<div class="cols two"><div>${`<form id="set" class="card"><div class="ch"><h2>مصروف المعيشة اليومي</h2>${chip('wal', 'blu')}</div><label>المبلغ اليومي المحجوز<div class="inp"><input name="living_daily" inputmode="decimal" value="${st.settings.living_daily / 100}" required><em>ج.م</em></div></label><button>حفظ</button></form>`}
  <a class="card lnk" href="#sim"><span class="l ch" style="justify-content:flex-start;gap:11px">${chip('flask', 'amb')}<b>تجربة سيناريو</b></span>${ic('chev')}</a>
  <div class="card"><button class="g" data-act="theme">${ic('moon', 'sm')}تبديل الوضع الداكن / الفاتح</button><button class="g" data-act="logout">${ic('out', 'sm')}تسجيل الخروج</button></div></div><div>${list('accounts')}${form('accounts')}</div></div>`;

const PAGES = { home, add, tx, cal, sim, more };
const NAV = [['home', 'home', 'الرئيسية'], ['add', 'plus', 'إضافة'], ['tx', 'rec', 'المعاملات'], ['cal', 'cal', 'التقويم'], ['more', 'set', 'المزيد']];
function render() {
  if (!PAGES[page]) page = 'home';
  const cur = page == 'sim' ? 'more' : page;
  app.innerHTML = `<main>${PAGES[page]()}</main><nav><div class="brand logo"><i>${ic('wal')}</i>My Finance</div>${NAV.map(([k, i, l]) => `<a href="#${k}" class="${k == cur ? 'on' : ''} ${k == 'add' ? 'add' : ''}">${ic(i)}<span>${l}</span></a>`).join('')}</nav>`;
  if (page == 'sim') runSim();
}
const say = t => { $('#toast')?.remove(); const d = document.createElement('div'); d.id = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2200); };
const ask = (title, { text, value, danger, ok = 'تأكيد' } = {}) => new Promise(res => {
  const o = document.createElement('div'); o.className = 'ov';
  o.innerHTML = `<div class="dlg" role="dialog" aria-modal="true"><b>${title}</b>${text ? `<p>${esc(text)}</p>` : ''}${value != null ? `<div class="inp"><input id="mi" inputmode="decimal" value="${value}"><em>ج.م</em></div>` : ''}<div class="acts"><button class="g" data-r="0">إلغاء</button><button class="${danger ? 'd' : ''}" data-r="1">${ok}</button></div></div>`;
  o.onclick = e => { const b = e.target.closest('button'); if (!b && e.target != o) return; const yes = b?.dataset.r == '1', val = $('#mi', o)?.value;
    o.classList.add('out'); setTimeout(() => o.remove(), 150); res(yes ? (value != null ? val : true) : null); };
  document.body.append(o); $('#mi', o)?.focus();
});
async function refresh() {
  try { st = await db.loadAll(); render(); }
  catch (e) { app.innerHTML = `<main><div class="card warn">${ic('al')}<span>تعذّر تحميل بياناتك. تأكد من الاتصال وإعدادات Supabase ثم أعد المحاولة.<br><small>${esc(e.message)}</small></span></div></main>`; }
}
const authView = () => `<main><form id="auth" class="card auth"><div class="logo"><i>${ic('wal')}</i>My Finance</div><p class="mut" style="margin:0">اعرف كم تملك فعليًا بعد الإيجار والديون والفواتير.</p><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="email"></label><label>كلمة المرور<input name="password" type="password" minlength="6" required autocomplete="current-password"></label><button>دخول</button><button type="button" class="g" data-act="signup">إنشاء حساب جديد</button></form></main>`;

app.addEventListener('submit', async ev => {
  ev.preventDefault(); const f = ev.target, d = Object.fromEntries(new FormData(f));
  try {
    if (f.id == 'auth') { const { error } = await db.sb.auth.signInWithPassword(d); if (error) return say('بيانات الدخول غير صحيحة'); return refresh(); }
    if (f.id == 'qx') { d.amount = toMinor(d.amount); if (d.amount <= 0) return say('أدخل مبلغًا صحيحًا'); await db.insert('transactions', d); await refresh(); return say('تم الحفظ'); }
    if (f.id == 'set') { await db.saveSettings(toMinor(d.living_daily)); await refresh(); return say('تم الحفظ'); }
    if (f.dataset.e) { for (const [k, , ty] of ENT[f.dataset.e].f) d[k] = ty == 'money' ? toMinor(d[k]) : ty == 'int' ? Number(d[k]) : d[k];
      await db.insert(f.dataset.e, d); await refresh(); say('تمت الإضافة'); }
  } catch (e) { say('حدث خطأ: ' + e.message); }
});
app.addEventListener('input', ev => { if (page == 'sim') runSim(); });
app.addEventListener('change', ev => { if (ev.target.dataset.f) { txf = ev.target.dataset.f; render(); } });
app.addEventListener('click', async ev => {
  const b = ev.target.closest('button'); if (!b) return; const D = b.dataset;
  try {
    if (D.del) { if (!await ask('حذف هذا العنصر؟', { text: 'لا يمكن التراجع عن الحذف.', danger: true, ok: 'حذف' })) return; const [t, id] = D.del.split(':'); await db.remove(t, id); await refresh(); }
    else if (D.pay) { const debt = st.debts.find(x => x.id == D.pay), v = await ask('سداد دفعة', { text: debt.name, value: debt.monthly / 100, ok: 'سداد' }); if (!v) return;
      await db.payDebt(debt, toMinor(v), st.accounts[0]?.id); await refresh(); say('تم تسجيل السداد'); }
    else if (D.act == 'theme') { const t = document.documentElement.dataset.theme == 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.theme = t; }
    else if (D.act == 'logout') { await db.sb.auth.signOut(); app.innerHTML = authView(); }
    else if (D.act == 'signup') { const d = Object.fromEntries(new FormData($('#auth'))); const { error } = await db.sb.auth.signUp(d); say(error ? error.message : 'تم إنشاء الحساب. تحقق من بريدك إن طُلب التأكيد'); }
  } catch (e) { say('حدث خطأ: ' + e.message); }
});
addEventListener('hashchange', () => { page = location.hash.slice(1); if (st) { render(); scrollTo(0, 0); } });
(async () => {
  app.innerHTML = '<main><p class="mut" style="text-align:center">جارٍ التحميل…</p></main>';
  const { data } = await db.sb.auth.getSession();
  data.session ? refresh() : app.innerHTML = authView();
})();
