import { useState, useEffect, useCallback } from 'react';
import { checkForUpdates, UpdateCheckResult } from '../lib/api';
import { isTauri } from '../lib/runtime';

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const check = useCallback(async (isManual = false) => {
    if (!isTauri()) return null;

    setIsChecking(true);
    setCheckError(null);

    try {
      const res = await checkForUpdates();
      setUpdateInfo(res);
      setLastChecked(new Date());

      if (res.has_update) {
        setIsModalOpen(true);
      }
      return res;
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Gagal memeriksa pembaruan';
      setCheckError(msg);
      if (isManual) {
        console.error('[Updater] Check failed:', err);
      } else {
        // Silent in background
        console.warn('[Updater] Background check skipped:', msg);
      }
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Background check on startup (debounced 3.5s to let app initialize smoothly)
  useEffect(() => {
    if (!isTauri()) return;

    const timer = setTimeout(() => {
      check(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, [check]);

  return {
    updateInfo,
    isChecking,
    isModalOpen,
    lastChecked,
    checkError,
    checkUpdates: check,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
  };
}

