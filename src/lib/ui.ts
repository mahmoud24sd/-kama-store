// أصناف Tailwind مشتركة لتوحيد التصميم
const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

export const ui = {
  input:
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
  label: 'mb-1 block text-sm font-medium text-gray-700',
  btnPrimary: `${btn} bg-accent-400 text-gray-900 hover:bg-accent-500`,
  btnDark: `${btn} bg-brand-800 text-white hover:bg-brand-700`,
  btnOutline: `${btn} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`,
  btnDanger: `${btn} bg-red-600 text-white hover:bg-red-700`,
  btnGhost: `${btn} text-brand-700 hover:bg-brand-50`,
  card: 'rounded-xl border border-gray-200 bg-white shadow-sm',
  th: 'px-3 py-2 text-right text-xs font-semibold text-gray-500',
  td: 'px-3 py-2 text-sm text-gray-800',
  alertError: 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700',
  alertOk: 'rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700',
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'قيد المراجعة',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'غير مدفوع',
  paid: 'مدفوع',
  failed: 'فشل الدفع',
  refunded: 'مسترد',
};
