import { create } from 'zustand';

// Number of pieces currently in the POS cart, shown as a badge on the mobile Kasir tab.
interface CartBadgeState {
  count: number;
  setCount: (count: number) => void;
}

export const useCartBadgeStore = create<CartBadgeState>((set) => ({
  count: 0,
  setCount: (count) => set((s) => (s.count === count ? s : { count })),
}));
