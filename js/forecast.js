// Pure financial calculations + forecasting. No DOM, no network. `sim` overrides never touch real data.
import { ymd, parse, addDays, dim, today } from './utils.js';
const STEP = { monthly: 1, quarterly: 3, yearly: 12 };
const mAdd = (d, n, a) => { const y = d.getFullYear(), m = d.getMonth() + n; return new Date(y, m, Math.min(a, dim(y, m))); };

export function events(st, from, to, sim = {}) {
  const ev = [], add = (d, amt, label, type) => { if (d >= from && d <= to) ev.push({ date: ymd(d), amt, label, type }); };
  const top = st.income_sources.reduce((a, b) => !a || b.expected > a.expected ? b : a, null);
  const fd = st.debts.find(d => d.remaining > 0);
  for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const y = m.getFullYear(), mo = m.getMonth(), day = n => new Date(y, mo, Math.min(n, dim(y, mo)));
    for (const i of st.income_sources) add(day(i.pay_day), i === top && sim.salary != null ? sim.salary : i.expected, i.name, 'income');
    for (const d of st.debts) if (d.remaining > 0) add(day(d.due_day), -Math.min(d.remaining, d.monthly + (d === fd ? sim.extraDebt || 0 : 0)), 'قسط ' + d.name, 'debt');
  }
  for (const o of st.obligations) {
    const base = parse(o.next_due), a = base.getDate(), n = STEP[o.freq] || 1; let k = 0, d = base;
    while (d < from) { k += n; d = mAdd(base, k, a); }
    while (d <= to) { add(d, -(o.amount + (o.kind === 'rent' ? sim.rentDelta || 0 : 0)), o.name, 'bill'); k += n; d = mAdd(base, k, a); }
  }
  return ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

export const balance = st => st.accounts.reduce((s, a) => s + a.opening, 0) + st.transactions.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0);

export function monthStats(st) {
  const pre = ymd(today()).slice(0, 7); let inc = 0, exp = 0;
  for (const t of st.transactions) if (t.tx_date.startsWith(pre)) t.kind === 'income' ? inc += t.amount : exp += t.amount;
  return { inc, exp };
}

// Actually Available = balance - obligations due before next payday - reserved living costs until then.
export function summarize(st, sim = {}) {
  const t = today(), bal = balance(st), T = ymd(t), ld = st.settings.living_daily;
  const ev = events(st, t, addDays(t, 62), sim);
  const pay = ev.find(e => e.type === 'income' && e.date > T);
  const eom = ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0));
  const hz = pay ? pay.date : eom;
  const days = Math.max(1, Math.round((parse(hz) - t) / 864e5));
  const due = -ev.filter(e => e.amt < 0 && e.date < hz).reduce((s, e) => s + e.amt, 0);
  const available = bal - due - ld * days;
  let run = bal, warn = null, eomBal = bal; const series = [];
  for (let i = 0; i <= 35; i++) {
    const d = ymd(addDays(t, i));
    for (const e of ev) if (e.date === d) run += e.amt;
    run -= ld; series.push({ d, bal: run });
    if (!warn && run < 0 && d < hz) warn = d;
    if (d === eom) eomBal = run;
  }
  return { bal, available, due, days, hz, series, warn, eom: eomBal, daily: available > 0 ? Math.floor(available / days) : 0,
    debt: st.debts.reduce((s, d) => s + d.remaining, 0), up: ev.slice(0, 8) };
}
