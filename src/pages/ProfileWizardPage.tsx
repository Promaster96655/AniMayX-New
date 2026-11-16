import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Upload, ArrowLeft, ArrowRight, MailCheck, BookOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ANIME_GENRES,
  CURATED_AVATARS,
  CURATED_BANNERS,
  PROFILE_FRAMES,
  PROFILE_THEMES,
} from '../lib/presets';
import {
  checkUsernameAvailable,
  saveProfileWithAtomicUsername,
  uploadUserAsset,
} from '../lib/firestoreService';
import type { ThemeId } from '../lib/types';

const STEPS = [
  {
    label: 'Identity',
    hint: 'Choose a unique lowercase @username (saved atomically so no one else can claim it) and your public Display Name.',
  },
  {
    label: 'Avatar',
    hint: 'Pick one of our custom anime obsidian avatars or upload your own JPG, PNG, or WEBP image (max 2MB).',
  },
  {
    label: 'Banner',
    hint: 'Select a widescreen 16:9 backdrop for the top of your public profile card, or upload a custom landscape image.',
  },
  {
    label: 'Frame',
    hint: 'Pick an avatar ring frame that highlights your profile picture across watchlists and comments.',
  },
  {
    label: 'Theme',
    hint: 'Select one of six curated profile surface palettes, such as Classic Orange, Midnight Black, or Golden Legend.',
  },
  {
    label: 'Interests',
    hint: 'Select up to 10 favorite anime genres, add a short bio, and decide if your watchlist is Public or Private.',
  },
  {
    label: 'Preview',
    hint: 'Review your complete profile card below, verify your email if needed, and click Confirm & Save to unlock AniMayX.',
  },
];

export function ProfileWizardPage() {
  const { user, profile, resendVerification, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [showTutorialOverview, setShowTutorialOverview] = useState(true);
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [avatarUrl, setAvatarUrl] = useState(CURATED_AVATARS[0].url);
  const [bannerUrl, setBannerUrl] = useState(CURATED_BANNERS[0].url);
  const [frameId, setFrameId] = useState(PROFILE_FRAMES[1].id);
  const [themeId, setThemeId] = useState<ThemeId>('classic-orange');
  const [bio, setBio] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(['Action', 'Sci-Fi']);
  const [watchlistVisibility, setWatchlistVisibility] = useState<'public' | 'private'>('public');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.setupCompleted) {
        setShowTutorialOverview(false);
      }
      setUsername(profile.username.startsWith('user_') ? '' : profile.username);
      setDisplayName(profile.displayName || user?.displayName || '');
      if (profile.avatarUrl) setAvatarUrl(profile.avatarUrl);
      if (profile.bannerUrl) setBannerUrl(profile.bannerUrl);
      if (profile.frameId) setFrameId(profile.frameId);
      if (profile.themeId) setThemeId(profile.themeId);
      if (profile.bio) setBio(profile.bio);
      if (profile.favoriteGenres?.length) setFavoriteGenres(profile.favoriteGenres);
      setWatchlistVisibility(profile.watchlistVisibility);
    }
  }, [profile, user]);

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(clean, user?.uid);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username, user?.uid]);

  const handleUpload = async (kind: 'avatars' | 'banners', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadUserAsset(user.uid, kind, file);
      if (kind === 'avatars') setAvatarUrl(url);
      else setBannerUrl(url);
      showToast('Asset uploaded', 'success');
    } catch (err) {
      showToast('Upload failed', 'error', err instanceof Error ? err.message : 'Verify Firebase Storage rules and file limits.');
    } finally {
      setUploading(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setFavoriteGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= 10) {
        showToast('Maximum 10 genres allowed', 'warning');
        return prev;
      }
      return [...prev, genre];
    });
  };

  const handleConfirmSave = async () => {
    if (!user) return;
    if (!user.emailVerified) {
      showToast(
        'Email verification required',
        'warning',
        'Please verify your email address first, then click I Verified.'
      );
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username.trim().toLowerCase())) {
      showToast('Invalid username', 'error', 'Use 3-30 lowercase letters, numbers, or underscores.');
      setStep(0);
      return;
    }
    if (usernameStatus === 'taken') {
      showToast('Username already taken', 'error');
      setStep(0);
      return;
    }

    setSaving(true);
    try {
      await saveProfileWithAtomicUsername(user.uid, profile?.username || null, {
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || 'AniMayX Member',
        avatarUrl,
        bannerUrl,
        frameId,
        themeId,
        bio,
        favoriteGenres,
        watchlistVisibility,
        setupCompleted: true,
      });
      await refreshProfile();
      showToast('Profile built!', 'success', 'All AniMayX categories are now unlocked.');
      navigate('/', { replace: true });
    } catch (err) {
      showToast('Save failed', 'error', err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const activeTheme = PROFILE_THEMES.find((t) => t.id === themeId) || PROFILE_THEMES[0];
  const activeFrame = PROFILE_FRAMES.find((f) => f.id === frameId) || PROFILE_FRAMES[0];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#080808] overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src={bannerUrl || CURATED_BANNERS[0].url}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/80 via-[#080808]/92 to-[#080808]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#FF6A00]">
            {profile?.setupCompleted ? 'Profile Editor' : 'Step 2 of 2 · Profile Building Tutorial'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            {showTutorialOverview ? 'How to Build Your AniMayX Profile' : 'Profile Setup Wizard'}
          </h1>
          <p className="text-sm text-[#A0A0A0]">
            {showTutorialOverview
              ? 'Follow these 7 quick steps to personalize your profile and unlock Anime, Movies, Manga, Light Novels, and Comics.'
              : 'Personalize your identity in seven guided steps.'}
          </p>
        </div>

        {!showTutorialOverview && (
          <button
            type="button"
            onClick={() => setShowTutorialOverview(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#121212] border border-white/12 text-xs font-medium text-white hover:border-[#FF6A00] whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#FF6A00]" />
            View Tutorial Guide
          </button>
        )}
      </div>

      {/* Email Verification Gate Banner */}
      {user && !user.emailVerified && (
        <div className="rounded-xl bg-[#121212] border border-[#FF6A00]/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <MailCheck className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Verify your email address before saving</p>
              <p className="text-xs text-[#A0A0A0] mt-0.5">
                Security rules require a verified email to reserve your unique username and save your profile. Click the link sent to {user.email}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await resendVerification();
                showToast('Verification email sent', 'success');
              }}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white hover:border-white/30"
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={async () => {
                await refreshProfile();
                showToast('Verification status checked', 'info');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#FF6A00] text-black text-xs font-semibold"
            >
              I Verified
            </button>
          </div>
        </div>
      )}

      {/* Interactive Tutorial Overview */}
      {showTutorialOverview ? (
        <div className="rounded-xl bg-[#121212] border border-white/10 p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STEPS.map((s, idx) => (
              <div
                key={s.label}
                className="rounded-lg bg-[#080808] border border-white/8 p-4 space-y-1.5"
              >
                <p className="text-xs font-mono text-[#FF6A00]">
                  0{idx + 1}. {s.label}
                </p>
                <p className="text-xs text-[#A0A0A0] leading-relaxed">{s.hint}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/8">
            <p className="text-xs text-[#A0A0A0]">
              Once you save Step 7, you will automatically unlock full access to watch & browse anything on AniMayX.
            </p>
            <button
              type="button"
              onClick={() => setShowTutorialOverview(false)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold"
            >
              Start Building My Profile
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stepper */}
          <div className="grid grid-cols-7 gap-2">
            {STEPS.map((s, idx) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStep(idx)}
                className={`py-2 px-1 rounded-lg text-xs font-medium border transition-colors text-center truncate ${
                  idx === step
                    ? 'bg-[#FF6A00] text-black border-[#FF6A00] font-semibold'
                    : idx < step
                    ? 'bg-[#121212] text-white border-[#FF6A00]/40'
                    : 'bg-[#121212] text-[#A0A0A0] border-white/8'
                }`}
              >
                {idx + 1}. {s.label}
              </button>
            ))}
          </div>

          {/* Contextual Tutorial Hint for Active Step */}
          <div className="rounded-lg bg-[#121212] border border-white/8 px-4 py-3 text-xs text-[#A0A0A0]">
            <span className="text-[#FF6A00] font-semibold">Step {step + 1} Guide:</span> {STEPS[step].hint}
          </div>

          {/* Step Panel */}
          <div className="rounded-xl bg-[#121212] border border-white/10 p-6 sm:p-8 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {step === 0 && (
                  <div className="space-y-4 max-w-lg">
                    <h2 className="font-display text-lg font-bold text-white">Step 1: Username & Display Name</h2>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#A0A0A0]">Unique Handle (lowercase a-z, 0-9, _)</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="kitsune_99"
                        className="w-full h-11 px-3.5 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
                      />
                      {usernameStatus === 'checking' && <p className="text-xs text-[#A0A0A0]">Checking availability...</p>}
                      {usernameStatus === 'available' && <p className="text-xs text-emerald-400">Username is available</p>}
                      {usernameStatus === 'taken' && <p className="text-xs text-rose-400">Username is already reserved</p>}
                      {usernameStatus === 'invalid' && (
                        <p className="text-xs text-amber-400">Use 3-30 lowercase letters, numbers, or underscores.</p>
                      )}
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#A0A0A0]">Display Name</span>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Kitsune"
                        className="w-full h-11 px-3.5 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
                      />
                    </label>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-bold text-white">Step 2: Choose Avatar</h2>
                    <div className="flex flex-wrap items-center gap-5">
                      {CURATED_AVATARS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setAvatarUrl(av.url)}
                          className={`p-2 rounded-xl border transition-colors text-left ${
                            avatarUrl === av.url ? 'border-[#FF6A00] bg-[#FF6A00]/10' : 'border-white/10 bg-[#080808]'
                          }`}
                        >
                          <img src={av.url} alt={av.label} className="w-24 h-24 rounded-lg object-cover" />
                          <p className="mt-2 text-xs font-medium text-white">{av.label}</p>
                        </button>
                      ))}

                      <label className="cursor-pointer w-28 h-32 rounded-xl border border-dashed border-white/20 hover:border-[#FF6A00] flex flex-col items-center justify-center p-3 text-center gap-2">
                        <Upload className="w-5 h-5 text-[#FF6A00]" />
                        <span className="text-xs text-[#A0A0A0]">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => handleUpload('avatars', e)} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-bold text-white">Step 3: Select Profile Banner</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {CURATED_BANNERS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBannerUrl(b.url)}
                          className={`rounded-xl overflow-hidden border text-left transition-colors ${
                            bannerUrl === b.url ? 'border-[#FF6A00]' : 'border-white/10'
                          }`}
                        >
                          <img src={b.url} alt={b.label} className="w-full h-28 object-cover" />
                          <div className="px-3 py-2 bg-[#080808] flex items-center justify-between">
                            <span className="text-xs font-medium text-white">{b.label}</span>
                            {bannerUrl === b.url && <Check className="w-4 h-4 text-[#FF6A00]" />}
                          </div>
                        </button>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-xs font-medium text-white cursor-pointer hover:border-[#FF6A00]">
                      <Upload className="w-4 h-4 text-[#FF6A00]" />
                      {uploading ? 'Uploading banner...' : 'Upload Custom Banner (max 4MB)'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleUpload('banners', e)} className="hidden" />
                    </label>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-bold text-white">Step 4: Select Profile Frame</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {PROFILE_FRAMES.map((frame) => (
                        <button
                          key={frame.id}
                          type="button"
                          onClick={() => setFrameId(frame.id)}
                          className={`p-4 rounded-xl bg-[#080808] border flex flex-col items-center gap-3 transition-colors ${
                            frameId === frame.id ? 'border-[#FF6A00]' : 'border-white/10'
                          }`}
                        >
                          <img
                            src={avatarUrl}
                            alt={frame.name}
                            className={`w-16 h-16 rounded-full object-cover ${frame.ringStyle}`}
                          />
                          <span className="text-xs font-medium text-white">{frame.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-bold text-white">Step 5: Profile Theme</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {PROFILE_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setThemeId(theme.id)}
                          className={`p-4 rounded-xl text-left border transition-colors ${theme.surfaceClass} ${
                            themeId === theme.id ? 'border-[#FF6A00]' : 'border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{theme.name}</span>
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.accentHex }} />
                          </div>
                          <p className="mt-1 text-xs text-[#A0A0A0]">{theme.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-bold text-white">Step 6: Favourite Genres & Bio</h2>
                    <div className="flex flex-wrap gap-2">
                      {ANIME_GENRES.map((genre) => {
                        const active = favoriteGenres.includes(genre);
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => toggleGenre(genre)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-[#FF6A00] text-black border-[#FF6A00] font-semibold'
                                : 'bg-[#080808] text-[#A0A0A0] border-white/10 hover:text-white'
                            }`}
                          >
                            {genre}
                          </button>
                        );
                      })}
                    </div>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#A0A0A0]">Short Bio</span>
                      <textarea
                        rows={3}
                        maxLength={400}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell fellow viewers what genres or studios you follow..."
                        className="w-full p-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#A0A0A0]">Watchlist Visibility:</span>
                      {(['public', 'private'] as const).map((vis) => (
                        <button
                          key={vis}
                          type="button"
                          onClick={() => setWatchlistVisibility(vis)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${
                            watchlistVisibility === vis
                              ? 'bg-white text-black border-white'
                              : 'bg-[#080808] text-[#A0A0A0] border-white/10'
                          }`}
                        >
                          {vis}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 6 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-bold text-white">Step 7: Live Profile Preview</h2>
                    <div className={`rounded-xl overflow-hidden border ${activeTheme.borderClass} ${activeTheme.surfaceClass}`}>
                      <div className="h-36 relative">
                        <img src={bannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      </div>
                      <div className="px-6 pb-6 -mt-10 relative flex flex-col sm:flex-row sm:items-end gap-4">
                        <img
                          src={avatarUrl}
                          alt="Avatar preview"
                          className={`w-20 h-20 rounded-full object-cover bg-[#080808] ${activeFrame.ringStyle}`}
                        />
                        <div className="flex-1">
                          <h3 className="font-display text-xl font-bold text-white">
                            {displayName || 'AniMayX Member'}
                          </h3>
                          <p className="text-xs text-[#A0A0A0]">
                            @{username || 'username'} · {activeTheme.name} · {watchlistVisibility} watchlist
                          </p>
                        </div>
                      </div>
                      {bio && <p className="px-6 pb-4 text-sm text-[#A0A0A0]">{bio}</p>}
                      {favoriteGenres.length > 0 && (
                        <p className="px-6 pb-6 text-xs text-white/80">
                          Interests: {favoriteGenres.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Footer */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/12 text-sm text-white disabled:opacity-35 hover:border-white/30"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold"
              >
                Next Step
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmSave}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] disabled:opacity-50 text-black text-sm font-semibold"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving Profile...' : 'Confirm & Unlock AniMayX'}
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
