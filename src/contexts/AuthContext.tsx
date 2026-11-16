import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiGet } from '../lib/apiClient';
import {
  ensureInitialUserDocuments,
  getUserPrivateInfo,
  getUserProfile,
} from '../lib/firestoreService';
import type { UserPrivateInfo, UserProfile } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  isAdmin: boolean;
  authReady: boolean;
  profileLoading: boolean;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<User>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAdminState: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadUserData = useCallback(async (firebaseUser: User) => {
    setProfileLoading(true);
    try {
      await ensureInitialUserDocuments(
        firebaseUser.uid,
        firebaseUser.email || '',
        firebaseUser.displayName || 'AniMayX Member'
      );
      const [prof, priv] = await Promise.all([
        getUserProfile(firebaseUser.uid),
        getUserPrivateInfo(firebaseUser.uid),
      ]);
      setProfile(prof);
      setPrivateInfo(priv);
    } catch (err) {
      console.error('[AuthContext] Failed loading user profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshAdminState = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) {
      setIsAdmin(false);
      return false;
    }
    try {
      const me = await apiGet<{ isAdmin: boolean }>('/api/admin/me', true);
      setIsAdmin(Boolean(me.isAdmin));
      return Boolean(me.isAdmin);
    } catch {
      setIsAdmin(false);
      return false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser } as User);
    await loadUserData(auth.currentUser);
    await refreshAdminState();
  }, [loadUserData, refreshAdminState]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserData(firebaseUser);
        await refreshAdminState();
      } else {
        setProfile(null);
        setPrivateInfo(null);
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadUserData, refreshAdminState]);

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    await sendEmailVerification(cred.user).catch(() => {});
    await ensureInitialUserDocuments(cred.user.uid, email, displayName.trim() || 'AniMayX Member');
    await loadUserData(cred.user);
    return cred.user;
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
  };

  const sendResetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (!auth.currentUser) throw new Error('No signed-in user');
    await sendEmailVerification(auth.currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        isAdmin,
        authReady,
        profileLoading,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        sendResetPassword,
        resendVerification,
        refreshProfile,
        refreshAdminState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
