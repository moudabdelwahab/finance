// Supabase access only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const ck = r => { if (r.error) throw r.error; return r; };
const T = ['accounts', 'transactions', 'income_sources', 'obligations', 'debts', 'settings'];
export async function loadAll() {
  const r = await Promise.all(T.map(t => {
    const q = sb.from(t).select('*');
    return t === 'transactions' ? q.order('tx_date', { ascending: false }).order('created_at', { ascending: false }) : q;
  }));
  const s = {}; r.forEach((x, i) => { s[T[i]] = ck(x).data; });
  s.settings = s.settings[0] || { living_daily: 0 };
  return s;
}
export const insert = (t, row) => sb.from(t).insert(row).then(ck);
export const remove = (t, id) => sb.from(t).delete().eq('id', id).then(ck);
export async function saveSettings(living_daily) {
  const { data } = await sb.auth.getUser();
  return sb.from('settings').upsert({ user_id: data.user.id, living_daily }).then(ck);
}
export async function payDebt(d, amount, accountId) {
  ck(await sb.from('debt_payments').insert({ debt_id: d.id, amount }));
  ck(await sb.from('debts').update({ remaining: Math.max(0, d.remaining - amount) }).eq('id', d.id));
  ck(await sb.from('transactions').insert({ kind: 'expense', amount, account_id: accountId, category: 'سداد دين', note: d.name }));
}
