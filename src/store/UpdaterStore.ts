import { create } from 'zustand';
import { checkForUpdates, UpdateCheckResult } from '../lib/api';
import { isTauri } from '../lib/runtime';

interface UpdaterState {
  updateInfo: UpdateCheckResult | null;
  isChecking: boolean;
  isModalOpen: boolean;
  lastChecked: Date | null;
  checkError: string | null;
  checkUpdates: (isManual?: boolean) => Promise<UpdateCheckResult | null>;
  openModal: () => void;
  closeModal: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  updateInfo: null,
  isChecking: false,
  isModalOpen: false,
  lastChecked: null,
  checkError: null,

  checkUpdates: async (isManual = false) => {
    if (!isTauri()) return null;

    set({ isChecking: true, checkError: null });

    try {
      const res = await checkForUpdates();
      set({
        updateInfo: res,
        lastChecked: new Date(),
        isModalOpen: res.has_update,
      });
      return res;
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Gagal memeriksa pembaruan';
      set({ checkError: msg });
      if (isManual) {
        console.error('[Updater] Check failed:', err);
      } else {
        console.warn('[Updater] Background check skipped:', msg);
      }
      return null;
    } finally {
      set({ isChecking: false });
    }
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));

