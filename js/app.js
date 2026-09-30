// UI layer. data.js / forecast.js / utils.js and the schema are unchanged.
import { $, esc, fmt, toMinor, ymd, today, addDays, parse } from './utils.js';
import * as db from './data.js';
import { summarize, monthStats, events } from './forecast.js';

let st, page = (location.hash || '#home').slice(1), txf = 'all', otab = 'obligations';
const app = $('#app');
const CATS = [['أكل', 'food'], ['مواصلات', 'car'], ['تسوق', 'bag'], ['فواتير', 'rec'], ['شخصي', 'user'], ['أخرى', 'dots']];
const FREQ = { monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي' }, STEP = { monthly: 1, quarterly: 3, yearly: 12 };

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  rec: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  set: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  up: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', dn: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
  al: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>', check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  wal: '<path d="M4 7h14a2 2 0 012 2v10H6a2 2 0 01-2-2z"/><path d="M4 7V6a2 2 0 012-2h11"/><circle cx="16" cy="14" r="1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', moon: '<path d="M20 14A8 8 0 1110 4a7 7 0 0010 10z"/>',
  out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>', flask: '<path d="M9 3h6M10 3v6L4 20h16L14 9V3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chev: '<path d="M15 6l-6 6 6 6"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  food: '<path d="M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>', car: '<path d="M5 16v-5l2-5h10l2 5v5M3 16h18M7 19v-3M17 19v-3"/>',
  bag: '<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 016 0"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  dots: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const chip = (n, t) => `<span class="chip t-${t}">${ic(n)}</span>`;
const empty = (n, t, h = '') => `<div class="empty">${chip(n, 'blu')}<span>${t}</span>${h}</div>`;
const head = (t, x = '') => `<div class="top"><h1>${t}</h1>${x}</div>`;
const addBtn = v => `<button class="s" data-do="add" data-v="${v}">${ic('plus', 'sm')}إضافة</button>`;
const bar = (v, max, c = '') => `<div class="bar ${c}"><i style="width:${max ? Math.max(0, Math.min(100, Math.round(v / max * 100))) : 0}%"></i></div>`;
const rel = ds => { const n = Math.round((parse(ds) - today()) / 864e5); return n <= 0 ? 'اليوم' : n == 1 ? 'غدًا' : n == 2 ? 'بعد يومين' : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`; };
const nextEv = () => { const t = today(); return events(st, t, addDays(t, 62)); };
const nextMonth = () => { const t = today(); return events(st, new Date(t.getFullYear(), t.getMonth() + 1, 1), new Date(t.getFullYear(), t.getMonth() + 2, 0)).filter(e => e.amt < 0); };

const ENT = {
  accounts: { t: 'الحسابات', s: 'حساب', f: [['name', 'اسم الحساب', 'text'], ['opening', 'الرصيد الحالي', 'money']] },
  income_sources: { t: 'الدخل الشهري', s: 'مصدر دخل', f: [['name', 'المصدر (مثل: الراتب)', 'text'], ['expected', 'المبلغ المتوقع', 'money'], ['pay_day', 'يوم القبض', 'int']] },
  obligations: { t: 'الالتزامات', s: 'التزام', f: [['name', 'الاسم', 'text'], ['amount', 'المبلغ', 'money'], ['next_due', 'الاستحقاق القادم', 'date'], ['kind', 'النوع', 'sel:bill|فاتورة,rent|إيجار,sub|اشتراك,family|دعم أسرة', 1], ['freq', 'التكرار', 'sel:monthly|شهري,quarterly|ربع سنوي,yearly|سنوي', 1]] },
  debts: { t: 'الديون', s: 'دين', f: [['name', 'الدائن', 'text'], ['total', 'إجمالي الدين', 'money'], ['monthly', 'القسط الشهري', 'money'], ['due_day', 'يوم الاستحقاق', 'int'], ['remaining', 'المتبقي (اتركه فارغًا إن كان كل الدين)', 'money', 1]] },
};
const field = ([k, l, ty, o], v) => ty.startsWith('sel')
  ? `<label>${l}<select name="${k}">${ty.slice(4).split(',').map(x => x.split('|')).map(([a, n]) => `<option value="${a}" ${a == v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
  : ty == 'money' ? `<label>${l}<div class="inp"><input name="${k}" ${o ? '' : 'required'} inputmode="decimal" placeholder="0.00" value="${v != null ? v / 100 : ''}"><em>ج.م</em></div></label>`
  : `<label>${l}<input name="${k}" ${o ? '' : 'required'} ${ty == 'int' ? 'type="number" min="1" max="31" inputmode="numeric"' : ty == 'date' ? 'type="date"' : ''} value="${v ?? (ty == 'date' ? ymd(today()) : '')}"></label>`;

/* ---------- sheets ---------- */
const closeSheet = () => { const o = $('#sh'); if (!o) return; o.id = ''; o.classList.add('out'); setTimeout(() => o.remove(), 150); };
const show = h => {
  const d = $('#sh .dlg'); if (d) { d.innerHTML = h; $('[autofocus]', d)?.focus(); return; }
  const o = document.createElement('div'); o.className = 'ov'; o.id = 'sh';
  o.innerHTML = `<div class="dlg sh" role="dialog" aria-modal="true">${h}</div>`; o.onclick = e => { if (e.target == o) closeSheet(); };
  document.body.append(o); $('[autofocus]', o)?.focus();
};
const shHead = t => `<div class="ch"><h2>${t}</h2><button class="s g" data-do="close" aria-label="إغلاق">${ic('x', 'sm')}</button></div>`;
const ask = (title, text, ok = 'حذف') => new Promise(res => {
  const o = document.createElement('div'); o.className = 'ov'; o.style.zIndex = 35;
  o.innerHTML = `<div class="dlg" role="alertdialog"><b>${title}</b><p>${text}</p><div class="acts"><button class="g" data-r="0">إلغاء</button><button class="d" data-r="1">${ok}</button></div></div>`;
  o.onclick = e => { const b = e.target.closest('button'); if (!b && e.target != o) return; o.classList.add('out'); setTimeout(() => o.remove(), 150); res(b?.dataset.r == '1'); };
  document.body.append(o);
});

function entSheet(e, r) {
  if (e == 'accounts') return accSheet(r);
  const E = ENT[e], req = E.f.filter(f => !f[3]), opt = E.f.filter(f => f[3]);
  show(shHead(`${r ? 'تعديل' : 'إضافة'} ${E.s}`) + `<form data-a="ent" data-e="${e}" data-id="${r?.id || ''}">${req.map(f => field(f, r?.[f[0]])).join('')}${opt.length ? `<details ${r ? 'open' : ''}><summary>تفاصيل إضافية</summary>${opt.map(f => field(f, r?.[f[0]])).join('')}</details>` : ''}<button>${r ? 'حفظ التعديل' : 'إضافة'}</button>${r ? `<button type="button" class="g neg" data-do="del" data-v="${e}:${r.id}">حذف</button>` : ''}</form>`);
}
const accSel = (n, sel) => `<select name="${n}">${st.accounts.map(a => `<option value="${a.id}" ${a.id == sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
const accNet = id => st.transactions.reduce((n, t) => t.account_id == id ? n + (t.kind == 'income' ? t.amount : -t.amount) : n, 0);
const accBal = a => a.opening + accNet(a.id);
function accSheet(a) {
  show(shHead(a ? 'تعديل الحساب' : 'إضافة حساب') + `<form data-a="acc" data-id="${a?.id || ''}">
  <label>اسم الحساب<input name="name" required value="${esc(a?.name || '')}"></label>
  <label>الرصيد الحالي<div class="inp"><input name="bal" required inputmode="decimal" value="${a ? accBal(a) / 100 : ''}"><em>ج.م</em></div></label>
  ${a ? '<small>الرصيد يُحسب من معاملاتك. تعديله هنا يضبط الرصيد الافتتاحي تلقائيًا.</small>' : ''}
  <button>${a ? 'حفظ التعديل' : 'إضافة'}</button>${a ? `<button type="button" class="g neg" data-do="del" data-v="accounts:${a.id}">حذف الحساب</button>` : ''}</form>`);
}
const TABS = [['exp', 'مصروف'], ['inc', 'دخل'], ['trf', 'تحويل'], ['pay', 'دفع دين']];
function addSheet(tab = 'exp', pre = {}) {
  if (!st.accounts.length) return entSheet('accounts');
  const amt = v => `<div class="inp"><input class="amt" name="amount" inputmode="decimal" placeholder="0" required autofocus aria-label="المبلغ" value="${v ?? ''}"><em>ج.م</em></div>`;
  const det = x => x ? `<details><summary>تفاصيل إضافية</summary>${x}</details>` : '';
  const dt = `<label>التاريخ<input type="date" name="tx_date" value="${ymd(today())}"></label>`, nt = '<label>ملاحظة<input name="note" placeholder="اختياري"></label>', ac = st.accounts.length > 1 ? `<label>الحساب${accSel('account_id')}</label>` : '';
  let body;
  if (tab == 'exp') body = `<form data-a="tx" data-k="expense">${amt(pre.amount)}<div class="cats">${CATS.map(([c, i], n) => `<label><input type="radio" name="category" value="${c}" ${n ? '' : 'checked'}><span>${ic(i)}${c}</span></label>`).join('')}</div>${det(ac + nt + dt)}<button>إضافة المصروف</button></form>`;
  else if (tab == 'inc') body = `<form data-a="tx" data-k="income">${amt(pre.amount)}<label>المصدر<input name="category" list="srcs" required placeholder="مثال: الراتب" value="${esc(st.income_sources[0]?.name || '')}"></label><datalist id="srcs">${st.income_sources.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>${dt}${det(ac + nt)}<button>إضافة الدخل</button></form>`;
  else if (tab == 'trf') body = st.accounts.length < 2 ? empty('wal', 'التحويل يحتاج حسابين على الأقل.', '<button class="s" data-do="add" data-v="ent:accounts">إضافة حساب</button>')
    : `<form data-a="trf">${amt(pre.amount)}<label>من${accSel('from', st.accounts[0].id)}</label><label>إلى${accSel('to', st.accounts[1].id)}</label><button>تحويل</button></form>`;
  else { const ds = st.debts.filter(d => d.remaining > 0), d0 = ds.find(d => d.id == pre.debt) || ds[0];
    body = !ds.length ? empty('card', 'لا توجد ديون مسجلة.', '<button class="s" data-do="add" data-v="ent:debts">إضافة دين</button>')
      : `<form data-a="pay"><label>الدين<select name="debt">${ds.map(d => `<option value="${d.id}" data-m="${Math.min(d.remaining, d.monthly) / 100}" ${d == d0 ? 'selected' : ''}>${esc(d.name)} · متبقي ${fmt(d.remaining)}</option>`).join('')}</select></label>${amt(pre.amount ?? Math.min(d0.remaining, d0.monthly) / 100)}${det(ac)}<button>تسجيل السداد</button></form>`; }
  show(`<div class="tabs">${TABS.map(([k, l]) => `<button type="button" class="${k == tab ? 'on' : ''}" data-do="tab" data-v="${k}">${l}</button>`).join('')}</div>` + body);
}
function txSheet(t) {
  if (!t) return;
  show(shHead(esc(t.category || 'معاملة')) + `<div><div class="amt2 num ${t.kind == 'income' ? 'pos' : 'neg'}">${t.kind == 'income' ? '+' : '-'}${fmt(t.amount)}</div><small>${t.tx_date}${t.note ? ' · ' + esc(t.note) : ''}</small></div><button class="g neg" data-do="del" data-v="transactions:${t.id}">حذف المعاملة</button>`);
}
function debtSheet(id) {
  const d = st.debts.find(x => x.id == id); if (!d) return; const p = d.total ? Math.round((1 - d.remaining / d.total) * 100) : 0;
  show(shHead(esc(d.name)) + `<div><small>المتبقي</small><div class="amt2 num">${fmt(d.remaining)}</div>${bar(p, 100, 'b')}<small>تم سداد ${p}% من ${fmt(d.total)}</small></div>
  <div><div class="row"><span>القسط الشهري</span><b class="num">${fmt(d.monthly)}</b></div><div class="row"><span>يوم الاستحقاق</span><b>يوم ${d.due_day}</b></div></div>
  ${d.remaining > 0 ? `<button data-do="payopen" data-v="${d.id}">سداد دفعة</button>` : ''}<button class="g" data-do="edit" data-v="debts:${d.id}">تعديل البيانات</button>`);
}

/* ---------- pages ---------- */
const txRow = t => `<div class="row" data-do="open" data-v="transactions:${t.id}"><div class="l">${chip(t.kind == 'income' ? 'up' : 'dn', t.kind == 'income' ? 'ok' : 'bad')}<div><b>${esc(t.category || 'معاملة')}</b><small>${t.tx_date}${t.note ? ' · ' + esc(t.note) : ''}</small></div></div><span class="${t.kind == 'income' ? 'pos' : 'neg'} num">${t.kind == 'income' ? '+' : '-'}${fmt(t.amount)}</span></div>`;
const monthCats = () => { const pre = ymd(today()).slice(0, 7), c = {};
  st.transactions.filter(x => x.kind == 'expense' && x.tx_date.startsWith(pre)).forEach(x => { const k = x.category || 'أخرى'; c[k] = (c[k] || 0) + x.amount; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]); };

const home = () => {
  if (!st.accounts.length) return head('أهلاً بك') + `<section class="card"><div class="ch"><h2>ابدأ بإضافة حسابك</h2>${chip('wal', 'blu')}</div><p class="mut" style="margin:0">أضف حسابك ورصيدك الحالي لنحسب لك المتاح فعليًا.</p><button data-do="add" data-v="ent:accounts">إضافة حساب</button></section>`;
  const s = summarize(st), m = monthStats(st), bud = st.settings.living_daily * 30, nb = nextEv().filter(e => e.amt < 0).slice(0, 4), cats = monthCats().slice(0, 3), nm = nextMonth(), nmt = nm.reduce((a, e) => a - e.amt, 0);
  const all = st.debts.reduce((a, d) => a + d.total, 0), bad = s.warn || s.eom < 0;
  const status = s.warn ? `قد ينفد رصيدك ${rel(s.warn)}` : s.eom < 0 ? 'متوقع عجز نهاية الشهر' : `متوقع نهاية الشهر ${fmt(s.eom)}`;
  return `<div class="dash"><div class="m">
  <section class="card hero"><small>المتاح فعليًا</small><div class="big num">${fmt(s.available)}</div>
  <p>${s.daily > 0 ? `ممكن تصرف حوالي <b>${fmt(s.daily)}</b> يوميًا خلال الـ ${s.days} يوم القادمة` : 'لا يوجد هامش صرف آمن حاليًا'}</p>
  <div class="meta"><span class="pill">${ic('wal', 'sm')}رصيدك ${fmt(s.bal)}</span><span class="pill ${bad ? 'bad' : ''}">${ic(bad ? 'al' : 'check', 'sm')}${status}</span></div></section>
  <section class="sec"><div class="ch"><h2>الأيام القادمة</h2></div><div class="tl"><div class="ev now"><i></i><div><b>اليوم</b><br><small class="num">رصيدك ${fmt(s.bal)}</small></div></div>
  ${s.up.slice(0, 5).map(e => `<div class="ev ${e.amt < 0 ? 'out' : 'in'}"><i></i><b>${rel(e.date)} — ${esc(e.label)}</b><span class="${e.amt < 0 ? 'amb' : 'pos'} num">${e.amt < 0 ? '-' : '+'}${fmt(Math.abs(e.amt))}</span></div>`).join('')}</div></section>
  <section class="sec"><div class="ch"><h2>أقرب التزاماتك</h2><a class="lk" href="#obl">الكل</a></div>${nb.map(e => `<div class="row"><div class="l">${chip(e.type == 'debt' ? 'card' : 'clock', 'amb')}<div><b>${esc(e.label)}</b><small>${rel(e.date)}</small></div></div><span class="num">${fmt(-e.amt)}</span></div>`).join('') || empty('cal', 'لا توجد التزامات قريبة.', '<button class="s" data-do="add" data-v="ent:obligations">إضافة التزام</button>')}</section>
  <section class="sec"><div class="ch"><h2>الشهر القادم</h2><b class="num">${fmt(nmt)}</b></div>${nm.slice(0, 4).map(e => `<div class="row"><div class="l">${chip(e.type == 'debt' ? 'card' : 'clock', 'amb')}<div><b>${esc(e.label)}</b><small>${e.date}</small></div></div><span class="num">${fmt(-e.amt)}</span></div>`).join('') || empty('cal', 'لا توجد التزامات للشهر القادم.')}</section></div>
  <div class="sd"><section class="sec"><div class="ch"><h2>مصروفاتك هذا الشهر</h2><b class="num">${fmt(m.exp)}</b></div>
  ${bud ? `${bar(m.exp, bud, m.exp > bud * .9 ? 'r' : m.exp > bud * .7 ? 'a' : '')}<small>من ميزانية ${fmt(bud)}</small>` : '<a class="lk" href="#more">حدد مصروفك اليومي لتظهر الميزانية</a>'}
  ${cats.map(([c, v]) => `<div class="row"><span>${esc(c)}</span><span class="num">${fmt(v)}</span></div>`).join('')}</section>
  <section class="sec"><div class="ch"><h2>الديون</h2><a class="lk" href="#debts">الكل</a></div>${st.debts.length ? `<div class="ch"><b class="num">${fmt(s.debt)}</b><small>تم سداد ${all ? Math.round((1 - s.debt / all) * 100) : 0}%</small></div>${bar(all - s.debt, all, 'b')}` : empty('card', 'لا توجد ديون مسجلة.')}</section>
  <section class="sec"><div class="ch"><h2>آخر العمليات</h2><a class="lk" href="#tx">الكل</a></div>${st.transactions.slice(0, 4).map(txRow).join('') || empty('rec', 'لم تسجّل أي معاملة بعد.', '<button class="s" data-do="add" data-v="exp">سجّل مصروفًا</button>')}</section></div></div>`;
};
const txp = () => { let last = ''; const m = monthStats(st);
  const rows = st.transactions.filter(t => txf == 'all' || t.kind == txf).map(t => { const h = t.tx_date != last ? `<div class="dh">${t.tx_date}</div>` : ''; last = t.tx_date; return h + txRow(t); }).join('');
  return head('المعاملات', `<button class="s" data-do="add" data-v="exp">${ic('plus', 'sm')}إضافة</button>`) + `<div class="dash"><div class="sd"><div class="stats2"><div class="stat"><small>دخل الشهر</small><b class="pos num">${fmt(m.inc)}</b></div><div class="stat"><small>مصروف الشهر</small><b class="neg num">${fmt(m.exp)}</b></div></div></div>
  <div class="m"><div class="tabs">${[['all', 'الكل'], ['income', 'دخل'], ['expense', 'مصروف']].map(([k, l]) => `<button class="${k == txf ? 'on' : ''}" data-do="flt" data-v="${k}">${l}</button>`).join('')}</div><div class="sec f">${rows || empty('rec', 'لا توجد معاملات.')}</div></div></div>`; };
const obl = () => { const nx = {}; nextEv().filter(e => e.type == 'bill').forEach(e => { nx[e.label] ??= e.date; }); const isO = otab == 'obligations';
  const L = isO ? [...st.obligations].sort((a, b) => (nx[a.name] || a.next_due) < (nx[b.name] || b.next_due) ? -1 : 1) : st.income_sources;
  const mo = st.obligations.reduce((a, o) => a + o.amount / (STEP[o.freq] || 1), 0), inc = st.income_sources.reduce((a, i) => a + i.expected, 0);
  return head('الالتزامات', addBtn('ent:' + otab)) + `<div class="dash"><div class="sd"><section class="card"><small>${isO ? 'إجمالي الالتزامات شهريًا' : 'إجمالي الدخل الشهري'}</small><div class="amt2 num">${fmt(Math.round(isO ? mo : inc))}</div>${isO && inc ? `<small>${Math.round(mo / inc * 100)}% من دخلك الشهري</small>` : ''}</section></div>
  <div class="m"><div class="tabs">${[['obligations', 'الالتزامات'], ['income_sources', 'الدخل الشهري']].map(([k, l]) => `<button class="${k == otab ? 'on' : ''}" data-do="otab" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="sec f">${L.map(r => isO ? `<div class="row" data-do="open" data-v="obligations:${r.id}"><div class="l">${chip('clock', 'amb')}<div><b>${esc(r.name)}</b><small>${rel(nx[r.name] || r.next_due)} · ${FREQ[r.freq] || ''}</small></div></div><span class="num">${fmt(r.amount)}</span></div>`
    : `<div class="row" data-do="open" data-v="income_sources:${r.id}"><div class="l">${chip('up', 'ok')}<div><b>${esc(r.name)}</b><small>يوم ${r.pay_day} من كل شهر</small></div></div><span class="pos num">${fmt(r.expected)}</span></div>`).join('') || empty('inbox', 'لا يوجد شيء بعد. اضغط "إضافة" للبدء.')}</div></div></div>`; };
const debtsP = () => { const ds = st.debts.filter(d => d.remaining > 0), rem = st.debts.reduce((a, d) => a + d.remaining, 0), all = st.debts.reduce((a, d) => a + d.total, 0), p = all ? Math.round((1 - rem / all) * 100) : 0;
  const due = ds.reduce((a, d) => a + Math.min(d.remaining, d.monthly), 0), nx = nextEv().find(e => e.type == 'debt');
  return head('الديون', addBtn('ent:debts')) + `<div class="dash"><div class="sd"><section class="card"><small>إجمالي الديون</small><div class="amt2 num">${fmt(rem)}</div>${bar(p, 100, 'b')}<small>تم سداد ${p}% من ${fmt(all)}</small></section>
  <div class="stats2"><div class="stat"><small>المطلوب هذا الشهر</small><b class="num">${fmt(due)}</b></div><div class="stat"><small>أقرب قسط</small><b>${nx ? rel(nx.date) : '—'}</b>${nx ? `<small>${esc(nx.label)} · ${fmt(-nx.amt)}</small>` : ''}</div></div></div>
  <div class="m sec f">${st.debts.map(d => `<div class="row" data-do="open" data-v="debts:${d.id}"><div class="l">${chip('card', 'blu')}<div><b>${esc(d.name)}</b><small>قسط ${fmt(d.monthly)} · يوم ${d.due_day}</small>${bar(d.total - d.remaining, d.total, 'b')}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="num">${fmt(d.remaining)}</span>${d.remaining > 0 ? `<button class="s" data-do="payopen" data-v="${d.id}">سداد</button>` : ''}</div></div>`).join('') || empty('card', 'لا توجد ديون مسجلة. اضغط "إضافة" لتسجيل أول دين.')}</div></div>`; };
const more = () => head('المزيد') + `<div class="dash"><div class="m"><form id="set" class="sec f"><h2>مصروف المعيشة اليومي</h2><small>نحجزه من المتاح فعليًا كل يوم.</small><div class="inline"><div class="inp"><input name="living_daily" inputmode="decimal" value="${st.settings.living_daily / 100}" required aria-label="المبلغ اليومي"><em>ج.م</em></div><button>حفظ</button></div></form>
  <div class="sec"><div class="ch"><h2>الحسابات</h2>${addBtn('ent:accounts')}</div>${st.accounts.map(a => `<div class="row" data-do="open" data-v="accounts:${a.id}"><div class="l">${chip('wal', 'blu')}<div><b>${esc(a.name)}</b><small>الرصيد الحالي ${fmt(accBal(a))}</small></div></div>${ic('chev', 'sm')}</div>`).join('')}</div></div>
  <div class="sd"><div class="sec f"><a class="row" href="#sim"><span class="l">${chip('flask', 'amb')}<b>تجربة سيناريو</b></span>${ic('chev', 'sm')}</a><button class="g" data-do="theme">${ic('moon', 'sm')}الوضع الداكن / الفاتح</button><button class="g" data-do="logout">${ic('out', 'sm')}تسجيل الخروج</button></div></div></div>`;
const sim = () => head('تجربة سيناريو', `<a href="#more" class="lk">${ic('chev')}</a>`) + `<div class="card" style="max-width:560px"><small>لا يغيّر بياناتك الحقيقية</small>${[['s1', 'الراتب الجديد', '17000'], ['s2', 'دفعة إضافية للدين شهريًا', '1000'], ['s3', 'زيادة الإيجار', '500']].map(([i, l, p]) => `<label>${l}<div class="inp"><input id="${i}" inputmode="decimal" placeholder="مثال: ${p}"><em>ج.م</em></div></label>`).join('')}</div><div id="simres" style="max-width:560px"></div>`;
function runSim() {
  const v = i => $('#' + i).value.trim(), o = { salary: v('s1') ? toMinor(v('s1')) : null, extraDebt: toMinor(v('s2')), rentDelta: toMinor(v('s3')) };
  const a = summarize(st), b = summarize(st, o), r = (l, x, y) => `<div class="row"><span>${l}</span><span class="num">${fmt(x)} ← <b class="${y >= x ? 'pos' : 'neg'}">${fmt(y)}</b></span></div>`;
  $('#simres').innerHTML = `<div class="card"><small>الآن ← بعد السيناريو</small>${r('المتاح فعليًا', a.available, b.available)}${r('حد الصرف اليومي', a.daily, b.daily)}${r('نهاية الشهر', a.eom, b.eom)}${r('الرصيد بعد ٣٥ يومًا', a.series.at(-1).bal, b.series.at(-1).bal)}${b.warn ? `<div class="neg ch" style="justify-content:flex-start">${ic('al', 'sm')}سينفد الرصيد بتاريخ ${b.warn}</div>` : ''}</div>`;
}

const PAGES = { home, tx: txp, obl, debts: debtsP, more, sim };
const NAV = [['home', 'home', 'الرئيسية'], ['tx', 'rec', 'المعاملات'], ['obl', 'cal', 'الالتزامات'], ['debts', 'card', 'الديون'], ['more', 'set', 'المزيد']];
function render() {
  if (!PAGES[page]) page = 'home';
  const cur = page == 'sim' ? 'more' : page;
  app.innerHTML = `<main>${PAGES[page]()}</main><nav><div class="brand logo"><i>${ic('wal')}</i>My Finance</div><button class="navadd" data-do="add" data-v="exp">${ic('plus', 'sm')}إضافة</button>${NAV.map(([k, i, l]) => `<a href="#${k}" class="${k == cur ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('')}</nav><button class="fab" data-do="add" data-v="exp" aria-label="إضافة">${ic('plus')}</button>`;
  if (page == 'sim') runSim();
}
const say = t => { $('#toast')?.remove(); const d = document.createElement('div'); d.id = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2200); };
async function refresh() {
  try { st = await db.loadAll(); render(); }
  catch (e) { app.innerHTML = `<main><div class="card warn">${ic('al')}<span>تعذّر تحميل بياناتك. تأكد من الاتصال وإعدادات Supabase ثم أعد المحاولة.<br><small>${esc(e.message)}</small></span></div></main>`; }
}
const authView = () => `<main><form id="auth" class="card auth"><div class="logo"><i>${ic('wal')}</i>My Finance</div><p class="mut" style="margin:0">اعرف كم تملك فعليًا بعد الإيجار والديون والفواتير.</p><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="email"></label><label>كلمة المرور<input name="password" type="password" minlength="6" required autocomplete="current-password"></label><button>دخول</button><button type="button" class="g" data-do="signup">إنشاء حساب جديد</button></form></main>`;

/* ---------- events ---------- */
const done = async m => { closeSheet(); await refresh(); say(m); };
document.addEventListener('submit', async ev => {
  ev.preventDefault(); const f = ev.target, d = Object.fromEntries(new FormData(f)), b = f.querySelector('button:not([type=button])'); if (b) b.disabled = true;
  try {
    if (f.id == 'auth') { const { error } = await db.sb.auth.signInWithPassword(d); if (error) return say('بيانات الدخول غير صحيحة'); return refresh(); }
    if (f.id == 'set') { await db.saveSettings(toMinor(d.living_daily)); await refresh(); return say('تم الحفظ'); }
    const a = f.dataset.a, amount = toMinor(d.amount);
    if (a && a != 'ent' && a != 'acc' && amount <= 0) return say('أدخل مبلغًا صحيحًا');
    if (a == 'tx') { const row = { kind: f.dataset.k, amount, category: d.category, account_id: d.account_id || st.accounts[0].id }; if (d.note) row.note = d.note; if (d.tx_date) row.tx_date = d.tx_date;
      await db.insert('transactions', row); await done(f.dataset.k == 'income' ? 'تمت إضافة الدخل' : 'تمت إضافة المصروف'); }
    else if (a == 'trf') { if (d.from == d.to) return say('اختر حسابين مختلفين'); const n = id => st.accounts.find(x => x.id == id).name;
      await db.insert('transactions', { kind: 'expense', amount, account_id: d.from, category: 'تحويل', note: 'إلى ' + n(d.to) });
      await db.insert('transactions', { kind: 'income', amount, account_id: d.to, category: 'تحويل', note: 'من ' + n(d.from) }); await done('تم التحويل'); }
    else if (a == 'pay') { const debt = st.debts.find(x => x.id == d.debt); await db.payDebt(debt, Math.min(amount, debt.remaining), d.account_id || st.accounts[0].id); await done('تم تسجيل السداد'); }
    else if (a == 'acc') { const bal = toMinor(d.bal), cur = st.accounts.find(x => x.id == f.dataset.id);
      if (cur) { const { error } = await db.sb.from('accounts').update({ name: d.name, opening: bal - accNet(cur.id) }).eq('id', cur.id); if (error) throw error; }
      else await db.insert('accounts', { name: d.name, opening: bal });
      await done(cur ? 'تم حفظ التعديل' : 'تمت الإضافة'); }
    else if (a == 'ent') { const e = f.dataset.e, row = {};
      for (const [k, , ty, o] of ENT[e].f) { if (o && d[k] === '') continue; row[k] = ty == 'money' ? toMinor(d[k]) : ty == 'int' ? Number(d[k]) : d[k]; }
      if (e == 'debts' && row.remaining == null) row.remaining = row.total;
      if (f.dataset.id) { const { error } = await db.sb.from(e).update(row).eq('id', f.dataset.id); if (error) throw error; } else await db.insert(e, row);
      await done(f.dataset.id ? 'تم حفظ التعديل' : 'تمت الإضافة'); }
  } catch (e) { say('حدث خطأ: ' + e.message); } finally { if (b) b.disabled = false; }
});
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-do]'); if (!el) return; const v = el.dataset.v || '', [x, id] = v.split(':');
  try {
    switch (el.dataset.do) {
      case 'add': v.startsWith('ent:') ? entSheet(x == 'ent' ? id : x) : addSheet(v); break;
      case 'tab': addSheet(v, { amount: $('#sh [name=amount]')?.value || undefined }); break;
      case 'open': x == 'debts' ? debtSheet(id) : x == 'transactions' ? txSheet(st.transactions.find(r => r.id == id)) : entSheet(x, st[x].find(r => r.id == id)); break;
      case 'edit': entSheet(x, st[x].find(r => r.id == id)); break;
      case 'payopen': addSheet('pay', { debt: v }); break;
      case 'del': if (!await ask('حذف هذا العنصر؟', x == 'accounts' ? 'سيُحذف الحساب مع كل معاملاته. لا يمكن التراجع.' : 'لا يمكن التراجع عن الحذف.')) return; await db.remove(x, id); await done('تم الحذف'); break;
      case 'flt': txf = v; render(); break;
      case 'otab': otab = v; render(); break;
      case 'close': closeSheet(); break;
      case 'theme': { const t = document.documentElement.dataset.theme == 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.theme = t; break; }
      case 'logout': await db.sb.auth.signOut(); st = null; app.innerHTML = authView(); break;
      case 'signup': { const { error } = await db.sb.auth.signUp(Object.fromEntries(new FormData($('#auth')))); say(error ? error.message : 'تم إنشاء الحساب. تحقق من بريدك إن طُلب التأكيد'); break; }
    }
  } catch (e) { say('حدث خطأ: ' + e.message); }
});
document.addEventListener('change', ev => { const s = ev.target; if (s.name == 'debt') { const a = $('#sh [name=amount]'); if (a) a.value = s.selectedOptions[0].dataset.m; } });
document.addEventListener('input', () => { if (page == 'sim') runSim(); });
document.addEventListener('keydown', ev => { if (ev.key == 'Escape') closeSheet(); });
addEventListener('hashchange', () => { page = location.hash.slice(1); if (st) { render(); scrollTo(0, 0); } });
(async () => {
  app.innerHTML = '<main><p class="mut" style="text-align:center">جارٍ التحميل…</p></main>';
  const { data } = await db.sb.auth.getSession();
  data.session ? refresh() : app.innerHTML = authView();
})();
