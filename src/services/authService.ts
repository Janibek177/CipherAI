import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { UserProfile } from '../types';

const REGISTERED_ACCOUNTS_KEY = 'cipherai_registered_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'cipherai_active_account_v1';

export interface StoredAccount {
  userId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

// Simple WebCrypto SHA-256 + salt hasher
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + '::cipherai_vault::' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredAccounts(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredAccount(account: StoredAccount): void {
  try {
    const accounts = getStoredAccounts();
    accounts[account.email.toLowerCase()] = account;
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('Failed to save account to storage', e);
  }
}

export function getActiveLocalAccount(): UserProfile | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveLocalAccount(profile: UserProfile | null): void {
  try {
    if (profile) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  } catch (e) {
    console.warn('Failed to persist active account', e);
  }
}

/**
 * Robust sign up with automatic fallback if Firebase Email/Password provider is disabled
 */
export async function registerUser(
  email: string,
  pass: string,
  displayName?: string
): Promise<{ user: UserProfile; isLocalFallback: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const name = displayName?.trim() || cleanEmail.split('@')[0];

  // 1. Try Firebase Auth first
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const profile: UserProfile = {
      userId: cred.user.uid,
      email: cred.user.email || cleanEmail,
      displayName: cred.user.displayName || name,
      createdAt: cred.user.metadata.creationTime || new Date().toISOString(),
      isGuest: false,
    };
    setActiveLocalAccount(profile);
    return { user: profile, isLocalFallback: false };
  } catch (fbErr: any) {
    console.warn('Firebase createUser failed, evaluating fallback:', fbErr?.code);

    // If already exists in Firebase, throw the standard error
    if (fbErr?.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please sign in instead.');
    }

    // If Firebase operation is not allowed or API error, seamlessly use Native Encrypted Account
    const accounts = getStoredAccounts();
    if (accounts[cleanEmail]) {
      throw new Error('This email is already registered. Please sign in instead.');
    }

    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const passwordHash = await hashPassword(pass, salt);
    // Deterministic userId based on email
    const userId = `usr_${btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '')}`;

    const newAccount: StoredAccount = {
      userId,
      email: cleanEmail,
      displayName: name,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    };

    saveStoredAccount(newAccount);

    const profile: UserProfile = {
      userId,
      email: cleanEmail,
      displayName: name,
      createdAt: newAccount.createdAt,
      isGuest: false,
    };
    setActiveLocalAccount(profile);
    return { user: profile, isLocalFallback: true };
  }
}

/**
 * Robust sign in with automatic fallback if Firebase Email/Password provider is disabled
 */
export async function loginUser(
  email: string,
  pass: string
): Promise<{ user: UserProfile; isLocalFallback: boolean }> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try Firebase Auth first
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const profile: UserProfile = {
      userId: cred.user.uid,
      email: cred.user.email || cleanEmail,
      displayName: cred.user.displayName || cleanEmail.split('@')[0],
      createdAt: cred.user.metadata.creationTime || new Date().toISOString(),
      isGuest: false,
    };
    setActiveLocalAccount(profile);
    return { user: profile, isLocalFallback: false };
  } catch (fbErr: any) {
    console.warn('Firebase signIn failed, evaluating fallback:', fbErr?.code);

    // Check stored native accounts
    const accounts = getStoredAccounts();
    const stored = accounts[cleanEmail];

    if (stored) {
      const inputHash = await hashPassword(pass, stored.salt);
      if (inputHash === stored.passwordHash) {
        const profile: UserProfile = {
          userId: stored.userId,
          email: stored.email,
          displayName: stored.displayName,
          createdAt: stored.createdAt,
          isGuest: false,
        };
        setActiveLocalAccount(profile);
        return { user: profile, isLocalFallback: true };
      } else {
        throw new Error('Incorrect password. Please try again.');
      }
    }

    if (fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password.');
    }
    if (fbErr?.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please create an account.');
    }

    // If Firebase operation is not allowed, guide user to register or sign up
    throw new Error('Account not found. Please click "Sign Up" to create your account.');
  }
}

/**
 * Google Sign In with Firebase
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const profile: UserProfile = {
    userId: result.user.uid,
    email: result.user.email || '',
    displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
    photoURL: result.user.photoURL || undefined,
    createdAt: result.user.metadata.creationTime || new Date().toISOString(),
    isGuest: false,
  };
  setActiveLocalAccount(profile);
  return profile;
}

/**
 * Clean sign out
 */
export async function logoutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth).catch(() => {});
  } finally {
    setActiveLocalAccount(null);
  }
}
