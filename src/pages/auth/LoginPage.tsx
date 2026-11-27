import { useState } from 'react';
import { Loader2, Lock, User, Eye, EyeOff, Store, Sun, Moon, Radio, Server } from 'lucide-react';
import { loginUser } from '../../lib/api';
import { useAuthStore } from '../../store/AuthStore';
import { supabase } from '../../lib/supabase';
import KivoLogo from '../../components/common/KivoLogo';
import { useTheme } from '../../components/ThemeProvider';
import { isRemoteClient, isMobilePlatform, getHostUrl, clearSkipAutoJoin } from '../../lib/runtime';
import Button from '../../components/ui/Button';

interface LoginPageProps {
  onOpenSetupWizard?: () => void;
  /** Android app only: go back to the "connect to cashier PC" screen. */
  onChangeHost?: () => void;
}

const INPUT_CLASS =
  'w-full h-12 sm:h-10 pl-9 pr-9 bg-input border border-line rounded-lg text-heading text-base sm:text-sm placeholder:text-dim focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function LoginPage({ onOpenSetupWizard, onChangeHost }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncingHost, setSyncingHost] = useState(false);
  const { setAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await loginUser(username, password);
      if (res.supabase_token) {
        await supabase.auth.setSession({ access_token: res.supabase_token, refresh_token: '' });
      }
      clearSkipAutoJoin();
      setAuth(res.token, res.user);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectHostSession = async () => {
    setSyncingHost(true);
    setError('');
    try {
      const hostUrl = getHostUrl();
      const res = await fetch(`${hostUrl}/api/lan/active_session`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`Host error (${res.status})`);
      const data = await res.json();
      if (data.success && data.token && data.user) {
        clearSkipAutoJoin();
        setAuth(data.token, data.user);
        return;
      }
      throw new Error('Belum ada sesi aktif di komputer host.');
    } catch (err: any) {
      setError(`Gagal terhubung ke host: ${err.message || err}`);
    } finally {
      setSyncingHost(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-background flex flex-col items-center justify-center p-4 py-8 overflow-y-auto select-none">
      <div className="w-full max-w-[380px] bg-card rounded-2xl sm:rounded-xl border border-line overflow-hidden my-auto animate-pop-in">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KivoLogo size={34} />
            <div>
              <h1 className="text-base font-bold text-heading leading-tight">Masuk Kivo</h1>
              <p className="text-xs text-dim">v{__APP_VERSION__}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Ganti tema"
            className="w-8 h-8 flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-danger text-xs font-medium">
              {error}
            </div>
          )}

          {isRemoteClient() && (
            <div className="space-y-3 pb-3 border-b border-line">
              {onChangeHost && (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-muted/60 border border-line">
                  <span className="flex items-center gap-2 min-w-0 text-xs text-dim">
                    <Server size={14} className="text-success shrink-0" />
                    <span className="font-mono text-heading truncate">{getHostUrl().replace(/^http:\/\//, '')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={onChangeHost}
                    className="text-xs font-semibold text-primary h-8 px-2 -mr-1 rounded-md cursor-pointer active:bg-muted"
                  >
                    Ganti
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                onClick={handleConnectHostSession}
                disabled={syncingHost}
              >
                {syncingHost ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} className="text-primary" />}
                Masuk dari Host LAN
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="login-username" className="text-xs font-semibold text-heading block">
              Username
            </label>
            <div className="relative flex items-center">
              <User size={15} className="absolute left-3 text-dim pointer-events-none" />
              <input
                id="login-username"
                type="text"
                autoFocus={!isMobilePlatform()}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold text-heading block">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-3 text-dim pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                className="absolute right-2.5 text-dim hover:text-heading p-1 rounded-md transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!username || !password}
            className="mt-1 h-12 sm:h-11"
          >
            Masuk
          </Button>

          {onOpenSetupWizard && (
            <div className="pt-2 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                onClick={onOpenSetupWizard}
              >
                <Store size={15} />
                Buat Toko Baru
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
