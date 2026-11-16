import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion, MotionConfig } from 'motion/react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { CommunityProvider } from './contexts/CommunityContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DiscordFloatingButton } from './components/DiscordCommunitySection';
import { HomePage } from './pages/HomePage';
import { LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import { ProfileWizardPage } from './pages/ProfileWizardPage';
import { ProfilePage } from './pages/ProfilePage';
import { AnimeHubPage } from './pages/AnimeHubPage';
import { AnimeBrowsePage } from './pages/AnimeBrowsePage';
import { AnimeDetailPage } from './pages/AnimeDetailPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { MoviesSeriesPage } from './pages/MoviesSeriesPage';
import { MangaBrowsePage, MangaDetailPage } from './pages/MangaPage';
import { ComicsPage, LightNovelDetailPage, LightNovelsPage } from './pages/NovelsAndComicsPages';
import { AdminAnimePage } from './pages/AdminAnimePage';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <motion.main
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="flex-1"
    >
      <Routes location={location}>
          <Route
            path="/"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* Auth */}
          <Route path="/auth" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Profile & Guided Profile Building Tutorial */}
          <Route
            path="/setup-profile"
            element={
              <ProtectedRoute>
                <ProfileWizardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Dedicated Anime Module (Unlocked after Sign Up + Profile Setup) */}
          <Route
            path="/anime"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeHubPage mode="hub" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/browse"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeBrowsePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/trending"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeHubPage mode="trending" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/popular"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeHubPage mode="popular" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/movies"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeHubPage mode="movies" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/watchlist"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <WatchlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/:id"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeDetailPage watchMode={false} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/:id/watch"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <AnimeDetailPage watchMode={true} />
              </ProtectedRoute>
            }
          />

          {/* Separate Category Modules (Unlocked after Sign Up + Profile Setup) */}
          <Route
            path="/movies"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <MoviesSeriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manga"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <MangaBrowsePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manga/:id"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <MangaDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/novels"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <LightNovelsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/novels/:id"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <LightNovelDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/comics"
            element={
              <ProtectedRoute requireSetupComplete={true}>
                <ComicsPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Anime Admin Console */}
          <Route
            path="/admin/anime"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminAnimePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </motion.main>
  );
}

function AppShell() {
  const location = useLocation();
  const isAuthScreen = ['/auth', '/login', '/register', '/reset-password'].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] text-white">
      {!isAuthScreen && <Navbar />}
      <AnimatedRoutes />
      {!isAuthScreen && <Footer />}
      {!isAuthScreen && <DiscordFloatingButton />}
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AuthProvider>
          <CommunityProvider>
            <BrowserRouter>
              <AppShell />
            </BrowserRouter>
          </CommunityProvider>
        </AuthProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
