// UI layer.
import { $, esc, fmt, toMinor, ymd, today } from './utils.js';
import * as db from './data.js';
import { summarize, monthStats } from './forecast.js';

let st, page = (location.hash || '#home').slice(1);
const app = $('#app');
const CATS = ['طعام', 'مواصلات', 'فواتير', 'صحة', 'ترفيه', 'تسوق', 'أخرى'];
const ENT = {
  accounts: { t: 'الحسابات', f: [['name', 'اسم الحساب', 'text'], ['opening', 'الرصيد الحالي', 'money']], row: r => [r.name, 'رصيد افتتاحي ' + fmt(r.opening)] },
  income_sources: { t: 'مصادر الدخل الشهري', f: [['name', 'المصدر (مثل: الراتب)', 'text'], ['expected', 'المبلغ المتوقع', 'money'], ['pay_day', 'يوم القبض', 'int']], row: r => [r.name, `${fmt(r.expected)} · يوم ${r.pay_day}`] },
  obligations: { t: 'الالتزامات الدورية', f: [['name', 'الاسم', 'text'], ['amount', 'المبلغ', 'money'], ['kind', 'النوع', 'sel:rent|إيجار,bill|فاتورة,sub|اشتراك,family|دعم أسرة'], ['freq', 'التكرار', 'sel:monthly|شهري,quarterly|ربع سنوي,yearly|سنوي'], ['next_due', 'الاستحقاق القادم', 'date']], row: r => [r.name, `${fmt(r.amount)} · ${r.next_due}`] },
  debts: { t: 'الديون', f: [['name', 'الدائن', 'text'], ['total', 'إجمالي الدين', 'money'], ['remaining', 'المتبقي', 'money'], ['monthly', 'القسط الشهري', 'money'], ['due_day', 'يوم الاستحقاق', 'int']], row: r => [r.name, `متبقي ${fmt(r.remaining)} · قسط ${fmt(r.monthly)}`, r.total ? Math.round((1 - r.remaining / r.total) * 100) : 0] },
};

const field = ([k, l, ty]) => ty.startsWith('sel')
  ? `<label>${l}<select name="${k}">${ty.slice(4).split(',').map(x => x.split('|')).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>`
  : `<label>${l}<input name="${k}" required ${ty == 'money' ? 'inputmode="decimal"' : ty == 'int' ? 'type="number" min="1" max="31"' : ty == 'date' ? `type="date" value="${ymd(today())}"` : ''}></label>`;
const form = e => `<form data-e="${e}" class="card"><b>${ENT[e].t}</b>${ENT[e].f.map(field).join('')}<button>إضافة</button></form>`;
const list = e => `<div class="card"><b>${ENT[e].t}</b>${st[e].length ? st[e].map(r => { const [a, b, p] = ENT[e].row(r);
  return `<div class="row"><div>${esc(a)}<br><small>${esc(b)}</small>${p != null ? `<div class="bar"><i style="width:${p}%"></i></div>` : ''}</div><div>${e == 'debts' ? `<button class="s" data-pay="${r.id}">سداد</button>` : ''}<button class="s g" data-del="${e}:${r.id}" aria-label="حذف">✕</button></div></div>`; }).join('')
  : '<p class="mut">لا يوجد شيء بعد — أضف أول عنصر من النموذج أدناه 🌱</p>'}</div>`;

const spark = s => { const v = s.map(x => x.bal), mn = Math.min(...v), r = (Math.max(...v) - mn) || 1;
  const pts = v.map((y, i) => `${(1 - i / (v.length - 1)) * 300},${58 - ((y - mn) / r) * 52}`).join(' ');
  return `<svg viewBox="0 0 300 60" style="width:100%;height:80px" role="img" aria-label="توقع الرصيد"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2.5"/></svg>`; };

const home = () => {
  if (!st.accounts.length) return `<div class="card"><h2>أهلاً بك 👋</h2><p>ابدأ بإضافة حسابك ورصيدك الحالي.</p></div>` + form('accounts');
  const s = summarize(st), m = monthStats(st), tx = st.transactions.slice(0, 6);
  const k = (l, v) => `<div class="card"><small>${l}</small><b>${fmt(v)}</b></div>`;
  return `<div class="card hero"><small>المتاح فعلياً</small><div class="big">${fmt(s.available)}</div><small>الرصيد ${fmt(s.bal)} · الراتب القادم بعد ${s.days} يوم</small></div>
  ${s.warn ? `<div class="card warn">⚠️ قد ينفد رصيدك بتاريخ ${s.warn} قبل الراتب القادم.</div>` : ''}
  <div class="grid">${k('الحد اليومي الآمن', s.daily)}${k('توقع نهاية الشهر', s.eom)}${k('دخل الشهر', m.inc)}${k('مصروف الشهر', m.exp)}${k('إجمالي الديون', s.debt)}${k('التزامات قبل الراتب', s.due)}</div>
  <div class="card"><b>توقع الرصيد (٣٥ يوماً)</b>${spark(s.series)}</div>
  <div class="card"><b>الاستحقاقات القادمة</b>${s.up.map(e => `<div class="row"><span>${e.date} · ${esc(e.label)}</span><span class="${e.amt < 0 ? 'neg' : 'pos'}">${fmt(e.amt)}</span></div>`).join('') || '<p class="mut">لا توجد استحقاقات قريبة. أضف دخلك والتزاماتك من تبويب الخطة.</p>'}</div>
  <div class="card"><b>آخر المعاملات</b>${tx.map(t => `<div class="row"><span>${esc(t.category || '')} <small>${t.tx_date} ${esc(t.note || '')}</small></span><span class="${t.kind == 'income' ? 'pos' : 'neg'}">${t.kind == 'income' ? '+' : '-'}${fmt(t.amount)}</span></div>`).join('') || '<p class="mut">لم تسجّل أي معاملة بعد. اضغط "إضافة" لتبدأ.</p>'}</div>`;
};
const add = () => !st.accounts.length ? form('accounts') : `<form id="qx" class="card"><div class="seg"><label><input type="radio" name="kind" value="expense" checked><span>مصروف</span></label><label><input type="radio" name="kind" value="income"><span>دخل</span></label></div>
  <input class="amt" name="amount" inputmode="decimal" placeholder="٠" required aria-label="المبلغ">
  <div class="chips">${CATS.map((c, i) => `<label><input type="radio" name="category" value="${c}" ${i ? '' : 'checked'}><span>${c}</span></label>`).join('')}</div>
  <select name="account_id" aria-label="الحساب">${st.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
  <input name="note" placeholder="ملاحظة (اختياري)"><button>حفظ</button></form>`;
const plan = () => ['income_sources', 'obligations', 'debts'].map(e => list(e) + form(e)).join('');
const sim = () => `<div class="card"><b>جرّب سيناريو — لا يغيّر بياناتك الحقيقية</b><label>الراتب الجديد<input id="s1" inputmode="decimal" placeholder="مثال: 17000"></label><label>دفعة إضافية للدين شهرياً<input id="s2" inputmode="decimal" placeholder="مثال: 1000"></label><label>زيادة الإيجار<input id="s3" inputmode="decimal" placeholder="مثال: 500"></label></div><div id="simres"></div>`;
function runSim() {
  const v = i => $('#' + i).value.trim(), o = { salary: v('s1') ? toMinor(v('s1')) : null, extraDebt: toMinor(v('s2')), rentDelta: toMinor(v('s3')) };
  const a = summarize(st), b = summarize(st, o), r = (l, x, y) => `<div class="row"><span>${l}</span><span>${fmt(x)} ← <b class="${y >= x ? 'pos' : 'neg'}">${fmt(y)}</b></span></div>`;
  $('#simres').innerHTML = `<div class="card"><small>الآن ← بعد السيناريو</small>${r('المتاح فعلياً', a.available, b.available)}${r('الحد اليومي الآمن', a.daily, b.daily)}${r('نهاية الشهر', a.eom, b.eom)}${b.warn ? `<p class="neg">⚠️ سينفد الرصيد بتاريخ ${b.warn}</p>` : ''}</div>`;
}
const more = () => `<form id="set" class="card"><b>مصروف المعيشة اليومي المحجوز</b><label>المبلغ يومياً<input name="living_daily" inputmode="decimal" value="${st.settings.living_daily / 100}" required></label><button>حفظ</button></form>`
  + list('accounts') + form('accounts') + `<div class="card"><button class="g" data-act="theme">تبديل الوضع الداكن/الفاتح</button><button class="g" data-act="logout">تسجيل الخروج</button></div>`;

const PAGES = { home, add, plan, sim, more };
const NAV = [['home', '🏠', 'الرئيسية'], ['add', '➕', 'إضافة'], ['plan', '📅', 'الخطة'], ['sim', '🧪', 'تجربة'], ['more', '⚙️', 'المزيد']];
function render() {
  if (!PAGES[page]) page = 'home';
  app.innerHTML = `<main>${PAGES[page]()}</main><nav>${NAV.map(([k, i, l]) => `<a href="#${k}" class="${k == page ? 'on' : ''}"><span>${i}</span>${l}</a>`).join('')}</nav>`;
  if (page == 'sim') runSim();
}
const say = t => { const d = document.createElement('div'); d.id = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2200); };
async function refresh() {
  try { st = await db.loadAll(); render(); }
  catch (e) { app.innerHTML = `<main><div class="card warn">تعذّر تحميل بياناتك 😕 تأكد من الاتصال وإعدادات Supabase ثم أعد المحاولة.<br><small>${esc(e.message)}</small></div></main>`; }
}
const authView = () => `<main><form id="auth" class="card"><h2>My Finance 💰</h2><p class="mut">اعرف كم تملك فعلاً بعد الإيجار والديون والفواتير.</p><input name="email" type="email" placeholder="البريد الإلكتروني" required><input name="password" type="password" minlength="6" placeholder="كلمة المرور" required><button>دخول</button><button type="button" class="g" data-act="signup">إنشاء حساب جديد</button></form></main>`;

app.addEventListener('submit', async ev => {
  ev.preventDefault(); const f = ev.target, d = Object.fromEntries(new FormData(f));
  try {
    if (f.id == 'auth') { const { error } = await db.sb.auth.signInWithPassword(d); if (error) return say('بيانات الدخول غير صحيحة'); return refresh(); }
    if (f.id == 'qx') { d.amount = toMinor(d.amount); if (d.amount <= 0) return say('أدخل مبلغاً صحيحاً'); await db.insert('transactions', d); await refresh(); return say('تم الحفظ ✅'); }
    if (f.id == 'set') { await db.saveSettings(toMinor(d.living_daily)); await refresh(); return say('تم الحفظ ✅'); }
    if (f.dataset.e) { for (const [k, , ty] of ENT[f.dataset.e].f) d[k] = ty == 'money' ? toMinor(d[k]) : ty == 'int' ? Number(d[k]) : d[k];
      await db.insert(f.dataset.e, d); await refresh(); say('تمت الإضافة ✅'); }
  } catch (e) { say('حدث خطأ: ' + e.message); }
});
app.addEventListener('input', () => { if (page == 'sim') runSim(); });
app.addEventListener('click', async ev => {
  const b = ev.target.closest('button'); if (!b) return; const D = b.dataset;
  try {
    if (D.del) { if (!confirm('حذف هذا العنصر؟')) return; const [t, id] = D.del.split(':'); await db.remove(t, id); await refresh(); }
    else if (D.pay) { const debt = st.debts.find(x => x.id == D.pay), v = prompt('مبلغ السداد', debt.monthly / 100); if (!v) return;
      await db.payDebt(debt, toMinor(v), st.accounts[0]?.id); await refresh(); say('تم تسجيل السداد ✅'); }
    else if (D.act == 'theme') { const t = document.documentElement.dataset.theme == 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.theme = t; }
    else if (D.act == 'logout') { await db.sb.auth.signOut(); app.innerHTML = authView(); }
    else if (D.act == 'signup') { const d = Object.fromEntries(new FormData($('#auth'))); const { error } = await db.sb.auth.signUp(d); say(error ? error.message : 'تم إنشاء الحساب — تحقق من بريدك إن طُلب التأكيد'); }
  } catch (e) { say('حدث خطأ: ' + e.message); }
});
addEventListener('hashchange', () => { page = location.hash.slice(1); if (st) render(); });
(async () => {
  app.innerHTML = '<main><p class="mut c">جارٍ التحميل…</p></main>';
  const { data } = await db.sb.auth.getSession();
  data.session ? refresh() : app.innerHTML = authView();
})();
