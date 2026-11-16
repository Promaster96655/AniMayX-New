import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Mail, Lock, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiGet } from '../lib/apiClient';
import { HERO_KEY_VISUALS } from '../lib/presets';
import type { AnimeItem } from '../lib/types';

type AuthMode = 'login' | 'register';

function AniMayXMark() {
  return (
    <div className="w-10 h-10 rounded-xl bg-[#080808] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
      <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden="true">
        <path
          d="M7 24L15.5 7L20.5 16.5L15.8 18.2L14 14.5L10.6 21.5H23L25 25H7Z"
          fill="#FF6A00"
        />
        <path d="M18 19L25 14L22.5 22.5L18 19Z" fill="#FFFFFF" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

function AuthBackdrop({
  imageUrl,
  featuredTitle,
}: {
  imageUrl: string;
  featuredTitle: string;
}) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#080808]">
      <AnimatePresence mode="wait">
        <motion.img
          key={imageUrl}
          src={imageUrl}
          alt={featuredTitle}
          referrerPolicy="no-referrer"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 0.65, scale: 1.0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </AnimatePresence>

      {/* Balanced obsidian scrim so the anime artwork remains clearly visible while keeping text crisp */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/95 via-[#080808]/40 to-[#080808]/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(8,8,8,0.22)_0%,rgba(8,8,8,0.72)_100%)]" />

      <div className="absolute bottom-4 left-5 z-10 text-xs text-[#D0D3DC]/90 tracking-wide select-none">
        Featured · <span className="text-white font-medium">{featuredTitle}</span>
      </div>
    </div>
  );
}

interface FeaturedSlide {
  url: string;
  title: string;
}

const FALLBACK_AUTH_SLIDES: FeaturedSlide[] = [
  { url: HERO_KEY_VISUALS[0], title: 'Neo-Tokyo Twilight' },
  { url: HERO_KEY_VISUALS[1], title: 'Eclipse Citadel' },
];

function UnifiedAuthScreen({ initialMode }: { initialMode: AuthMode }) {
  const { user, profile, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: string } | null)?.from || '/';
  const from = ['/auth', '/login', '/register', '/reset-password'].includes(rawFrom) ? '/' : rawFrom;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [slides, setSlides] = useState<FeaturedSlide[]>(FALLBACK_AUTH_SLIDES);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (user && profile) {
      const target = profile.setupCompleted ? from : '/setup-profile';
      if (location.pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [user, profile, from, location.pathname, navigate]);

  useEffect(() => {
    let active = true;
    apiGet<{ items: AnimeItem[] }>('/api/anime/discover?sort=trending&perPage=20')
      .then((res) => {
        if (!active) return;
        const liveSlides: FeaturedSlide[] = (res.items || [])
          .filter((item) => Boolean(item.bannerUrl))
          .slice(0, 6)
          .map((item) => ({
            url: item.bannerUrl,
            title: item.titleEnglish || item.titleRomaji,
          }));
        if (liveSlides.length > 0) {
          setSlides([...liveSlides, ...FALLBACK_AUTH_SLIDES]);
          setSlideIndex(0);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const activeSlide = slides[slideIndex] || FALLBACK_AUTH_SLIDES[0];

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    navigate(nextMode === 'login' ? '/login' : '/register', {
      replace: true,
      state: location.state,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && password.length < 8) {
      showToast('Password too short', 'warning', 'Use at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
        showToast('Signed in to AniMayX', 'success');
      } else {
        await registerWithEmail(email.trim(), password, displayName.trim());
        showToast('Account created', 'success', 'Starting your Profile Building Tutorial...');
        navigate('/setup-profile', { replace: true });
      }
    } catch (err) {
      showToast(
        mode === 'login' ? 'Sign-in failed' : 'Registration failed',
        'error',
        err instanceof Error ? err.message : 'Please check your details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
      showToast(
        mode === 'login' ? 'Signed in with Google' : 'Welcome to AniMayX',
        'success',
        mode === 'register' ? 'Let’s build your profile next.' : undefined
      );
    } catch (err) {
      showToast('Google Sign-In failed', 'error', err instanceof Error ? err.message : 'Popup closed or unavailable.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 bg-[#080808] text-white">
      <AuthBackdrop imageUrl={activeSlide.url} featuredTitle={activeSlide.title} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[430px] rounded-2xl bg-[#0F1014]/95 border border-white/10 shadow-2xl backdrop-blur-md p-6 sm:p-8 space-y-5"
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3.5">
          <AniMayXMark />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-white leading-tight">
              AniMay<span className="text-[#FF6A00]">X</span>
            </h1>
            <p className="text-xs text-[#A0A0A0] mt-0.5">
              {mode === 'login'
                ? 'Sign in to continue watching'
                : 'Create an account to start watching'}
            </p>
          </div>
        </div>

        {/* Segmented Tab Switcher */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="grid grid-cols-2 p-1 rounded-xl bg-[#16181F] border border-white/8"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => switchMode('login')}
            className={`h-9 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              mode === 'login'
                ? 'bg-[#FF6A00] text-black shadow-sm'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => switchMode('register')}
            className={`h-9 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              mode === 'register'
                ? 'bg-[#FF6A00] text-black shadow-sm'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence initial={false}>
            {mode === 'register' && (
              <motion.label
                key="display-name-field"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="block space-y-1.5"
              >
                <span className="text-xs font-medium text-[#D0D3DC]">Display name</span>
                <div className="relative">
                  <User className="w-4 h-4 text-[#7E8391] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your anime handle or name"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#1A1C23] border border-white/10 text-sm text-white placeholder-[#7E8391] focus:outline-none focus:border-[#FF6A00] transition-colors"
                  />
                </div>
              </motion.label>
            )}
          </AnimatePresence>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#D0D3DC]">Email address</span>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#7E8391] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#1A1C23] border border-white/10 text-sm text-white placeholder-[#7E8391] focus:outline-none focus:border-[#FF6A00] transition-colors"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#D0D3DC]">Password</span>
              {mode === 'login' ? (
                <Link to="/reset-password" className="text-xs font-medium text-[#FF6A00] hover:underline">
                  Forgot password?
                </Link>
              ) : (
                <span className="text-[11px] text-[#A0A0A0]">Min 8 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#7E8391] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Your password' : 'Create a password'}
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#1A1C23] border border-white/10 text-sm text-white placeholder-[#7E8391] focus:outline-none focus:border-[#FF6A00] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8391] hover:text-white transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-[#FF6A00] hover:bg-[#FF7E24] disabled:opacity-50 text-black text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            {submitting
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
              ? 'Sign in to AniMayX'
              : 'Create account & Start Tutorial'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Google Sign-In */}
        <div className="space-y-3 pt-1">
          <div className="relative flex items-center justify-center">
            <div className="border-t border-white/8 w-full" />
            <span className="px-3 text-[11px] text-[#7E8391] bg-[#0F1014] shrink-0">or</span>
            <div className="border-t border-white/8 w-full" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="w-full h-10 rounded-xl bg-[#16181F] border border-white/10 hover:border-white/25 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            Continue with Google
          </button>
        </div>

        {/* Footer Switch */}
        <div className="border-t border-white/8 pt-4 text-center">
          {mode === 'login' ? (
            <p className="text-xs text-[#A0A0A0]">
              New to AniMayX?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-white font-semibold underline underline-offset-4 hover:text-[#FF6A00] transition-colors"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p className="text-xs text-[#A0A0A0]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-white font-semibold underline underline-offset-4 hover:text-[#FF6A00] transition-colors"
              >
                Sign in to AniMayX
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function LoginPage() {
  return <UnifiedAuthScreen initialMode="login" />;
}

export function RegisterPage() {
  return <UnifiedAuthScreen initialMode="register" />;
}

export function ResetPasswordPage() {
  const { sendResetPassword } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendResetPassword(email.trim());
      setSent(true);
      showToast('Reset email sent', 'success', 'Check your inbox for password reset instructions.');
    } catch (err) {
      showToast('Could not send reset email', 'error', err instanceof Error ? err.message : 'Try again.');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 bg-[#080808] text-white">
      <AuthBackdrop imageUrl={HERO_KEY_VISUALS[0]} featuredTitle="Neo-Tokyo Twilight" />

      <div className="relative z-10 w-full max-w-[430px] rounded-2xl bg-[#0F1014]/95 border border-white/10 shadow-2xl backdrop-blur-md p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3.5">
          <AniMayXMark />
          <div>
            <h1 className="font-display text-xl font-bold text-white">Reset Password</h1>
            <p className="text-xs text-[#A0A0A0] mt-0.5">
              We’ll send a Firebase recovery link to your email
            </p>
          </div>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-400">
              Password reset link dispatched to <span className="font-medium text-white">{email}</span>.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-11 rounded-xl bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#D0D3DC]">Email address</span>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#7E8391] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#1A1C23] border border-white/10 text-sm text-white placeholder-[#7E8391] focus:outline-none focus:border-[#FF6A00]"
                />
              </div>
            </label>
            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold transition-colors"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <div className="border-t border-white/8 pt-4 text-center">
          <Link to="/login" className="text-xs text-[#A0A0A0] hover:text-white underline underline-offset-4">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
