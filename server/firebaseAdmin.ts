import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

interface AppletFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
}

let cachedConfig: AppletFirebaseConfig | null = null;
let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminInitialized = false;
let hasServiceAccount = false;

export const INITIAL_ADMIN_EMAIL = (process.env.INITIAL_ADMIN_EMAIL || 'mrzorvixofficial@gmail.com').toLowerCase();

export function getAppletFirebaseConfig(): AppletFirebaseConfig {
  if (cachedConfig) return cachedConfig;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  cachedConfig = JSON.parse(raw) as AppletFirebaseConfig;
  return cachedConfig;
}

export function initFirebaseAdmin() {
  if (adminInitialized) {
    return { adminApp, adminAuth, adminDb, hasServiceAccount };
  }
  adminInitialized = true;

  const config = getAppletFirebaseConfig();
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  try {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else if (saEnv) {
      let serviceAccount: Record<string, string>;
      if (saEnv.startsWith('{')) {
        serviceAccount = JSON.parse(saEnv);
      } else {
        const resolved = path.resolve(process.cwd(), saEnv);
        serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
      }
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: config.projectId,
      });
      hasServiceAccount = true;
    } else {
      // Attempt initialization with projectId (works on GCP/Cloud Run ADC if attached)
      adminApp = initializeApp({ projectId: config.projectId });
      hasServiceAccount = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }

    adminAuth = getAuth(adminApp);
    if (hasServiceAccount) {
      adminDb = getFirestore(adminApp, config.firestoreDatabaseId);
    }
  } catch (err) {
    console.warn('[FirebaseAdmin] Limited initialization (service account not provided):', err instanceof Error ? err.message : String(err));
  }

  return { adminApp, adminAuth, adminDb, hasServiceAccount };
}

export interface VerifiedUserContext {
  uid: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  claimsAdmin: boolean;
}

/**
 * Verifies a Firebase ID Token using Admin SDK when available, or Firebase Identity Toolkit lookup
 * against the configured project API key so tokens are always verified against Firebase Auth.
 */
export async function verifyFirebaseToken(idToken: string): Promise<VerifiedUserContext> {
  if (!idToken || idToken.length > 8192) {
    throw new Error('Invalid authentication token');
  }

  const { adminAuth: authClient, adminDb: dbClient } = initFirebaseAdmin();
  const config = getAppletFirebaseConfig();

  let uid = '';
  let email = '';
  let emailVerified = false;
  let claimsAdmin = false;

  if (authClient && hasServiceAccount) {
    const decoded = await authClient.verifyIdToken(idToken, true);
    uid = decoded.uid;
    email = (decoded.email || '').toLowerCase();
    emailVerified = Boolean(decoded.email_verified);
    claimsAdmin = decoded.admin === true || decoded.role === 'super_admin';
  } else {
    // Cryptographically verified by Firebase Identity Toolkit server
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) {
      throw new Error('Unauthorized: Firebase ID token verification failed');
    }
    const payload = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        customAttributes?: string;
      }>;
    };
    const user = payload.users?.[0];
    if (!user?.localId) {
      throw new Error('Unauthorized: User not found for token');
    }
    uid = user.localId;
    email = (user.email || '').toLowerCase();
    emailVerified = Boolean(user.emailVerified);
    if (user.customAttributes) {
      try {
        const attrs = JSON.parse(user.customAttributes) as Record<string, unknown>;
        claimsAdmin = attrs.admin === true || attrs.role === 'super_admin';
      } catch {
        claimsAdmin = false;
      }
    }
  }

  let dbAdmin = false;
  if (dbClient) {
    try {
      const adminSnap = await dbClient.collection('admins').doc(uid).get();
      dbAdmin = adminSnap.exists;
    } catch {
      dbAdmin = false;
    }
  }

  const isBootstrappedInitialAdmin = emailVerified && email === INITIAL_ADMIN_EMAIL;
  const isAdmin = claimsAdmin || dbAdmin || isBootstrappedInitialAdmin;

  return {
    uid,
    email,
    emailVerified,
    isAdmin,
    claimsAdmin,
  };
}
