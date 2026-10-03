import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { ChatMessage, ChatSession, UserProfile } from '../types';
import { encryptText, decryptText, getDefaultVaultKey } from '../utils/crypto';

export const GUEST_USER_ID = 'guest_vault_user';

export function getEffectiveUserId(userId?: string): string {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  return userId && userId.trim() ? userId.trim() : GUEST_USER_ID;
}

export function getEffectiveUserEmail(userEmail?: string): string | undefined {
  if (auth.currentUser?.email) {
    return auth.currentUser.email.toLowerCase().trim();
  }
  return userEmail?.toLowerCase().trim() || undefined;
}

export function isFirestoreUser(userId?: string): boolean {
  return !!auth.currentUser && auth.currentUser.uid === userId;
}

function getLocalChatsKeys(userId: string, email?: string): string[] {
  const keys = new Set<string>();
  if (email && email.includes('@')) {
    keys.add(`cipherai_acc_${email.toLowerCase().trim()}_chats`);
  }
  if (userId && userId !== GUEST_USER_ID) {
    keys.add(`cipherai_chats_${userId}`);
  }
  if (keys.size === 0) {
    keys.add('cipherai_guest_chats_v2');
  }
  return Array.from(keys);
}

function getLocalMsgsKeys(userId: string, chatId: string, email?: string): string[] {
  const keys = new Set<string>();
  if (email && email.includes('@')) {
    keys.add(`cipherai_acc_${email.toLowerCase().trim()}_msgs_${chatId}`);
  }
  if (userId && userId !== GUEST_USER_ID) {
    keys.add(`cipherai_msgs_${userId}_${chatId}`);
  }
  if (keys.size === 0) {
    keys.add(`cipherai_guest_msgs_v2_${chatId}`);
  }
  return Array.from(keys);
}

/**
 * Saves user profile to local storage and Firestore
 */
export async function saveUserProfile(user: UserProfile): Promise<void> {
  const targetUserId = getEffectiveUserId(user.userId);
  const targetEmail = getEffectiveUserEmail(user.email);

  try {
    localStorage.setItem(`cipherai_profile_${targetUserId}`, JSON.stringify(user));
    if (targetEmail) {
      localStorage.setItem(`cipherai_profile_email_${targetEmail}`, JSON.stringify(user));
    }
  } catch (e) {
    console.warn('Could not save local user profile', e);
  }

  if (isFirestoreUser(targetUserId)) {
    try {
      await setDoc(
        doc(db, 'users', targetUserId),
        {
          userId: targetUserId,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    } catch {}
  }
}

/**
 * Fetches user profile from local cache or Firestore
 */
export async function getUserProfile(userId: string, email?: string): Promise<UserProfile | null> {
  const targetUserId = getEffectiveUserId(userId);
  const targetEmail = getEffectiveUserEmail(email);

  // 1. Check local cache
  try {
    if (targetEmail) {
      const rawByEmail = localStorage.getItem(`cipherai_profile_email_${targetEmail}`);
      if (rawByEmail) return JSON.parse(rawByEmail);
    }
    const raw = localStorage.getItem(`cipherai_profile_${targetUserId}`);
    if (raw) return JSON.parse(raw);
  } catch {}

  // 2. Try Firestore if authenticated
  if (isFirestoreUser(targetUserId)) {
    try {
      const docSnap = await getDoc(doc(db, 'users', targetUserId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          userId: data.userId || targetUserId,
          email: data.email || '',
          displayName: data.displayName || 'User',
          photoURL: data.photoURL || undefined,
          createdAt: data.updatedAt || new Date().toISOString(),
          isGuest: false,
        };
      }
    } catch {}
  }

  return null;
}

/**
 * Migrates local guest chats and messages to an authenticated user's account
 */
export async function migrateGuestChatsToUser(
  userId: string,
  email?: string,
  passphrase?: string
): Promise<void> {
  const targetUserId = getEffectiveUserId(userId);
  const targetEmail = getEffectiveUserEmail(email);
  if (targetUserId === GUEST_USER_ID) return;

  try {
    const guestKeys = ['cipherai_guest_chats_v2', 'cipherai_chats_guest_vault_user', 'cipherai_guest_chats_v1'];
    let guestChats: ChatSession[] = [];

    for (const k of guestKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            guestChats = [...guestChats, ...parsed];
          }
        } catch {}
      }
    }

    if (guestChats.length === 0) return;

    // Deduplicate guest chats
    const uniqueMap = new Map<string, ChatSession>();
    guestChats.forEach(c => uniqueMap.set(c.id, c));

    for (const chat of uniqueMap.values()) {
      const migratedSession: ChatSession = {
        ...chat,
        userId: targetUserId,
      };
      await saveChatSession(migratedSession, targetUserId, targetEmail, passphrase);

      // Migrate messages
      const possibleMsgKeys = [
        `cipherai_guest_msgs_v2_${chat.id}`,
        `cipherai_msgs_guest_vault_user_${chat.id}`,
        `cipherai_guest_msgs_v1_${chat.id}`,
      ];

      for (const mk of possibleMsgKeys) {
        const rawMsgs = localStorage.getItem(mk);
        if (rawMsgs) {
          try {
            const msgs: ChatMessage[] = JSON.parse(rawMsgs);
            if (Array.isArray(msgs)) {
              for (const m of msgs) {
                const migratedMsg: ChatMessage = {
                  ...m,
                  userId: targetUserId,
                };
                await saveChatMessage(migratedMsg, targetUserId, targetEmail, passphrase);
              }
            }
          } catch {}
          localStorage.removeItem(mk);
        }
      }
    }

    // Clear guest storage now that everything is migrated
    guestKeys.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Guest migration notice:', err);
  }
}

/**
 * Saves a chat session to the user's permanent local storage and Firestore
 */
export async function saveChatSession(
  session: ChatSession,
  userId?: string,
  userEmail?: string,
  passphrase?: string
): Promise<void> {
  const targetUserId = getEffectiveUserId(userId || session.userId);
  const targetEmail = getEffectiveUserEmail(userEmail);
  const encKey = passphrase || getDefaultVaultKey(targetUserId);

  const sessionWithUser: ChatSession = {
    ...session,
    userId: targetUserId,
    updatedAt: session.updatedAt || new Date().toISOString(),
  };

  // 1. Save to ALL corresponding local keys (guaranteed persistence by UID and by Email)
  const keys = getLocalChatsKeys(targetUserId, targetEmail);
  for (const k of keys) {
    try {
      const existingRaw = localStorage.getItem(k);
      const chats: ChatSession[] = existingRaw ? JSON.parse(existingRaw) : [];
      const index = chats.findIndex(c => c.id === session.id);
      if (index >= 0) {
        chats[index] = sessionWithUser;
      } else {
        chats.unshift(sessionWithUser);
      }
      localStorage.setItem(k, JSON.stringify(chats));
    } catch (e) {
      console.warn(`Failed to save chat locally to key ${k}:`, e);
    }
  }

  // 2. Non-blocking Firestore cloud sync if authenticated
  if (isFirestoreUser(targetUserId)) {
    (async () => {
      try {
        const encryptedTitle = session.isEncrypted
          ? await encryptText(session.title, encKey)
          : session.title;

        await setDoc(doc(db, 'users', targetUserId, 'chats', session.id), {
          id: session.id,
          userId: targetUserId,
          title: encryptedTitle,
          isEncrypted: !!session.isEncrypted,
          createdAt: session.createdAt || new Date().toISOString(),
          updatedAt: sessionWithUser.updatedAt,
          messageCount: session.messageCount || 0,
        });
      } catch (err) {
        // Non-blocking
      }
    })().catch(() => {});
  }
}

/**
 * Fetches all chat sessions for a user, merging all local keys and Firestore
 */
export async function getChatSessions(
  userId?: string,
  userEmail?: string,
  passphrase?: string
): Promise<ChatSession[]> {
  const targetUserId = getEffectiveUserId(userId);
  const targetEmail = getEffectiveUserEmail(userEmail);
  const encKey = passphrase || getDefaultVaultKey(targetUserId);

  // 1. Immediately read and aggregate all local sessions across all user keys
  const keys = getLocalChatsKeys(targetUserId, targetEmail);
  const localMap = new Map<string, ChatSession>();

  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            const existing = localMap.get(s.id);
            if (!existing || new Date(s.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
              localMap.set(s.id, s);
            }
          }
        }
      }
    } catch {}
  }

  const localSessions = Array.from(localMap.values());

  // 2. Decrypt titles
  const decryptedSessions = await Promise.all(
    localSessions.map(async s => {
      if (s.isEncrypted && s.title && s.title.startsWith('{')) {
        try {
          const dec = await decryptText(s.title, encKey);
          return { ...s, title: dec };
        } catch {
          return s;
        }
      }
      return s;
    })
  );

  const sortedSessions = decryptedSessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // 3. Cloud sync with fast 1.5s timeout (never blocks or freezes the UI)
  if (isFirestoreUser(targetUserId)) {
    const fetchCloud = async () => {
      try {
        const chatsRef = collection(db, 'users', targetUserId, 'chats');
        const snap = await getDocs(chatsRef);
        const cloudSessions: ChatSession[] = [];

        for (const d of snap.docs) {
          const data = d.data();
          let displayTitle = data.title;
          if (data.isEncrypted && data.title) {
            try {
              displayTitle = await decryptText(data.title, encKey);
            } catch {
              displayTitle = '🔒 [Encrypted Session]';
            }
          }

          cloudSessions.push({
            id: data.id || d.id,
            userId: targetUserId,
            title: displayTitle,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            isEncrypted: !!data.isEncrypted,
            messageCount: data.messageCount || 0,
          });
        }

        if (cloudSessions.length > 0) {
          const mergedMap = new Map<string, ChatSession>();
          sortedSessions.forEach(s => mergedMap.set(s.id, s));
          cloudSessions.forEach(s => mergedMap.set(s.id, s));
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          // Update local storage
          for (const k of keys) {
            try {
              localStorage.setItem(k, JSON.stringify(merged));
            } catch {}
          }
          return merged;
        }
      } catch {}
      return sortedSessions;
    };

    // Fast timeout wrapper
    const timeoutPromise = new Promise<ChatSession[]>(res => setTimeout(() => res(sortedSessions), 1500));
    return Promise.race([fetchCloud(), timeoutPromise]);
  }

  return sortedSessions;
}

/**
 * Saves a chat message to permanent local storage and Firestore
 */
export async function saveChatMessage(
  message: ChatMessage,
  userId?: string,
  userEmail?: string,
  passphrase?: string
): Promise<void> {
  const targetUserId = getEffectiveUserId(userId || message.userId);
  const targetEmail = getEffectiveUserEmail(userEmail);
  const encKey = passphrase || getDefaultVaultKey(targetUserId);

  const msgWithUser: ChatMessage = {
    ...message,
    userId: targetUserId,
  };

  // 1. ALWAYS save to local storage keys immediately
  const msgKeys = getLocalMsgsKeys(targetUserId, message.chatId, targetEmail);
  for (const mk of msgKeys) {
    try {
      const existingRaw = localStorage.getItem(mk);
      const messages: ChatMessage[] = existingRaw ? JSON.parse(existingRaw) : [];
      const index = messages.findIndex(m => m.id === message.id);
      if (index >= 0) {
        messages[index] = msgWithUser;
      } else {
        messages.push(msgWithUser);
      }
      localStorage.setItem(mk, JSON.stringify(messages));
    } catch (e) {
      console.warn(`Failed to save message to ${mk}:`, e);
    }
  }

  // Update parent session updatedAt and messageCount
  const chatKeys = getLocalChatsKeys(targetUserId, targetEmail);
  for (const ck of chatKeys) {
    try {
      const existingChatsRaw = localStorage.getItem(ck);
      if (existingChatsRaw) {
        const chats: ChatSession[] = JSON.parse(existingChatsRaw);
        const cIdx = chats.findIndex(c => c.id === message.chatId);
        if (cIdx >= 0) {
          chats[cIdx].updatedAt = message.createdAt || new Date().toISOString();
          chats[cIdx].messageCount = (chats[cIdx].messageCount || 0) + 1;
          localStorage.setItem(ck, JSON.stringify(chats));
        }
      }
    } catch {}
  }

  // 2. Non-blocking Firestore save if authenticated
  if (isFirestoreUser(targetUserId)) {
    (async () => {
      try {
        const encryptedContent = message.isEncrypted
          ? await encryptText(message.content, encKey)
          : message.content;

        await setDoc(
          doc(db, 'users', targetUserId, 'chats', message.chatId, 'messages', message.id),
          {
            id: message.id,
            chatId: message.chatId,
            userId: targetUserId,
            role: message.role,
            content: encryptedContent,
            isEncrypted: !!message.isEncrypted,
            hasImage: !!message.hasImage,
            imageUrl: message.imageUrl || null,
            createdAt: message.createdAt || new Date().toISOString(),
            error: !!message.error,
          }
        );

        await updateDoc(doc(db, 'users', targetUserId, 'chats', message.chatId), {
          updatedAt: message.createdAt || new Date().toISOString(),
        }).catch(() => {});
      } catch {}
    })().catch(() => {});
  }
}

/**
 * Fetches all messages for a chat session from local storage and Firestore
 */
export async function getChatMessages(
  chatId: string,
  userId?: string,
  userEmail?: string,
  passphrase?: string
): Promise<ChatMessage[]> {
  const targetUserId = getEffectiveUserId(userId);
  const targetEmail = getEffectiveUserEmail(userEmail);
  const encKey = passphrase || getDefaultVaultKey(targetUserId);

  // 1. Read from all corresponding local message keys
  const msgKeys = getLocalMsgsKeys(targetUserId, chatId, targetEmail);
  const msgMap = new Map<string, ChatMessage>();

  for (const mk of msgKeys) {
    try {
      const raw = localStorage.getItem(mk);
      if (raw) {
        const parsed: ChatMessage[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const m of parsed) {
            msgMap.set(m.id, m);
          }
        }
      }
    } catch {}
  }

  const localMessages = Array.from(msgMap.values());

  // Decrypt local messages
  const decryptedMessages = await Promise.all(
    localMessages.map(async m => {
      if (m.isEncrypted && m.content && m.content.startsWith('{')) {
        try {
          const dec = await decryptText(m.content, encKey);
          return { ...m, content: dec };
        } catch {
          return m;
        }
      }
      return m;
    })
  );

  const sortedMessages = decryptedMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // 2. Cloud sync with fast 1.5s timeout
  if (isFirestoreUser(targetUserId)) {
    const fetchCloud = async () => {
      try {
        const msgsRef = collection(db, 'users', targetUserId, 'chats', chatId, 'messages');
        const snap = await getDocs(msgsRef);
        const cloudMessages: ChatMessage[] = [];

        for (const d of snap.docs) {
          const data = d.data();
          let displayContent = data.content;
          if (data.isEncrypted && data.content) {
            try {
              displayContent = await decryptText(data.content, encKey);
            } catch {
              displayContent = '🔒 [Unable to decrypt message]';
            }
          }

          cloudMessages.push({
            id: data.id || d.id,
            chatId: data.chatId || chatId,
            userId: targetUserId,
            role: data.role || 'user',
            content: displayContent,
            isEncrypted: !!data.isEncrypted,
            hasImage: !!data.hasImage,
            imageUrl: data.imageUrl || undefined,
            createdAt: data.createdAt || new Date().toISOString(),
            error: !!data.error,
          });
        }

        if (cloudMessages.length > 0) {
          const map = new Map<string, ChatMessage>();
          sortedMessages.forEach(m => map.set(m.id, m));
          cloudMessages.forEach(m => map.set(m.id, m));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          for (const mk of msgKeys) {
            try {
              localStorage.setItem(mk, JSON.stringify(merged));
            } catch {}
          }
          return merged;
        }
      } catch {}
      return sortedMessages;
    };

    const timeoutPromise = new Promise<ChatMessage[]>(res => setTimeout(() => res(sortedMessages), 1500));
    return Promise.race([fetchCloud(), timeoutPromise]);
  }

  return sortedMessages;
}

/**
 * Deletes a chat session from local storage and Firestore
 */
export async function deleteChatSession(
  chatId: string,
  userId?: string,
  userEmail?: string
): Promise<void> {
  const targetUserId = getEffectiveUserId(userId);
  const targetEmail = getEffectiveUserEmail(userEmail);

  // 1. Delete from local storage across all keys
  const chatKeys = getLocalChatsKeys(targetUserId, targetEmail);
  for (const ck of chatKeys) {
    try {
      const existingRaw = localStorage.getItem(ck);
      if (existingRaw) {
        const chats: ChatSession[] = JSON.parse(existingRaw);
        const filtered = chats.filter(c => c.id !== chatId);
        localStorage.setItem(ck, JSON.stringify(filtered));
      }
    } catch {}
  }

  const msgKeys = getLocalMsgsKeys(targetUserId, chatId, targetEmail);
  for (const mk of msgKeys) {
    try {
      localStorage.removeItem(mk);
    } catch {}
  }

  // 2. Delete from Firestore if authenticated
  if (isFirestoreUser(targetUserId)) {
    (async () => {
      try {
        const msgsRef = collection(db, 'users', targetUserId, 'chats', chatId, 'messages');
        const snap = await getDocs(msgsRef);
        for (const d of snap.docs) {
          await deleteDoc(d.ref).catch(() => {});
        }
        await deleteDoc(doc(db, 'users', targetUserId, 'chats', chatId)).catch(() => {});
      } catch {}
    })().catch(() => {});
  }
}
