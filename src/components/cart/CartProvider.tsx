'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLineInput } from '@/lib/types';

const KEY = 'kama_cart_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CartContextValue = {
  lines: CartLineInput[];
  ready: boolean;
  count: number;
  /** max = المخزون المتاح؛ لا تتجاوز الكمية هذا الحد */
  add: (line: CartLineInput, max: number) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const same = (a: CartLineInput, productId: string, variantId: string | null) =>
  a.productId === productId && a.variantId === variantId;

function isValid(x: unknown): x is CartLineInput {
  if (!x || typeof x !== 'object') return false;
  const l = x as CartLineInput;
  return (
    typeof l.productId === 'string' &&
    UUID.test(l.productId) &&
    (l.variantId === null || (typeof l.variantId === 'string' && UUID.test(l.variantId))) &&
    Number.isInteger(l.qty) &&
    l.qty >= 1 &&
    l.qty <= 99
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLineInput[]>([]);
  const [ready, setReady] = useState(false);

  // تحميل السلة المحفوظة (تبقى بعد تحديث الصفحة)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed.filter(isValid));
      }
    } catch {
      /* تجاهل بيانات تالفة */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* التخزين غير متاح */
    }
  }, [lines, ready]);

  // مزامنة بين التبويبات
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        const parsed: unknown = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) setLines(parsed.filter(isValid));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((line: CartLineInput, max: number) => {
    if (max < 1) return;
    setLines((prev) => {
      const i = prev.findIndex((l) => same(l, line.productId, line.variantId));
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(max, 99, next[i].qty + line.qty) };
        return next;
      }
      return [...prev, { ...line, qty: Math.min(max, 99, line.qty) }];
    });
  }, []);

  const setQty = useCallback((productId: string, variantId: string | null, qty: number) => {
    setLines((prev) =>
      prev.flatMap((l) => (same(l, productId, variantId) ? (qty < 1 ? [] : [{ ...l, qty: Math.min(99, qty) }]) : [l])),
    );
  }, []);

  const remove = useCallback((productId: string, variantId: string | null) => {
    setLines((prev) => prev.filter((l) => !same(l, productId, variantId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({ lines, ready, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear }),
    [lines, ready, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
