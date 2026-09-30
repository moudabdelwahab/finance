export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Money is integer minor units. Parse text (incl. Arabic digits) without floats.
export const toMinor = v => {
  const s = String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace('٫', '.').replace(/[^\d.]/g, '');
  const [a, b = ''] = s.split('.');
  return Number(a || 0) * 100 + Number((b + '00').slice(0, 2));
};
const nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
export const fmt = m => nf.format(m / 100) + ' ج.م';
const p = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dim = (y, m) => new Date(y, m + 1, 0).getDate();
