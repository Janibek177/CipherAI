/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, testConnection } from './firebase/config';
import { ChatMessage, ChatSession, UserProfile } from './types';
import {
  GUEST_USER_ID,
  getChatSessions,
  saveChatSession,
  getChatMessages,
  saveChatMessage,
  deleteChatSession,
  saveUserProfile,
  getUserProfile,
  migrateGuestChatsToUser,
} from './services/chatService';
import {
  getActiveLocalAccount,
  logoutUser,
} from './services/authService';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AuthModal } from './components/AuthModal';
import { EncryptionModal } from './components/EncryptionModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { ConfirmModal } from './components/ConfirmModal';

const GUEST_USER: UserProfile = {
  userId: GUEST_USER_ID,
  displayName: 'Гость (Guest Explorer)',
  email: '',
  isGuest: true,
  createdAt: new Date(0).toISOString(),
};

export default function App() {
  const [user, setUser] = useState<UserProfile>(() => {
    const local = getActiveLocalAccount();
    if (local) return local;
    try {
      const saved = localStorage.getItem('cipherai_logged_in_user');
      return saved ? JSON.parse(saved) : GUEST_USER;
    } catch {
      return GUEST_USER;
    }
  });

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEncryptionModalOpen, setIsEncryptionModalOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('cipherai_custom_gemini_key') || '';
  });
  const [passphrase, setPassphrase] = useState<string>(() => {
    return localStorage.getItem('cipherai_vault_passphrase') || '';
  });

  // Dark/Light Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('cipherai_theme');
    if (saved) return saved === 'dark';
    return true; // Default to sleek dark mode
  });

  // Sync theme to <html> tag and localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cipherai_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cipherai_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // 1. Initial boot test connection to Firestore
  useEffect(() => {
    testConnection();
  }, []);

  // 2. Load chat sessions for a specific user
  const loadUserSessions = useCallback(
    async (userId: string, userEmail: string | undefined, activePass: string) => {
      try {
        const chatSessions = await getChatSessions(userId, userEmail, activePass);
        setSessions(chatSessions);

        if (chatSessions.length > 0) {
          setCurrentSessionId(prev => {
            if (prev && chatSessions.some(s => s.id === prev)) {
              return prev;
            }
            return chatSessions[0].id;
          });
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
      }
    },
    []
  );

  // 3. Firebase Auth state listener + local account support
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        let name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        const profile: UserProfile = {
          userId: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: name,
          photoURL: firebaseUser.photoURL || undefined,
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          isGuest: false,
        };

        setUser(profile);
        setIsAuthModalOpen(false);
        try {
          localStorage.setItem('cipherai_logged_in_user', JSON.stringify(profile));
        } catch {}

        try {
          const remoteProfile = await getUserProfile(firebaseUser.uid, profile.email);
          if (remoteProfile?.displayName) {
            profile.displayName = remoteProfile.displayName;
            setUser({ ...profile });
          }
        } catch (e) {
          console.warn('Could not fetch remote profile', e);
        }

        try {
          await saveUserProfile(profile);
        } catch (e) {
          console.warn('Could not save user profile', e);
        }

        try {
          await migrateGuestChatsToUser(firebaseUser.uid, profile.email, passphrase);
        } catch (e) {
          console.warn('Could not migrate guest chats', e);
        }

        try {
          await loadUserSessions(firebaseUser.uid, profile.email, passphrase);
        } catch (e) {
          console.warn('Could not load user sessions', e);
        }
      } else {
        // If not in Firebase Auth, check if user logged in via Native Encrypted Account
        const localAccount = getActiveLocalAccount();
        if (localAccount) {
          setUser(localAccount);
          try {
            await migrateGuestChatsToUser(localAccount.userId, localAccount.email, passphrase);
            await loadUserSessions(localAccount.userId, localAccount.email, passphrase);
          } catch (e) {
            console.warn('Could not load local account sessions', e);
          }
        } else {
          localStorage.removeItem('cipherai_logged_in_user');
          setUser(GUEST_USER);
          try {
            await loadUserSessions(GUEST_USER.userId, undefined, passphrase);
          } catch (e) {
            console.warn('Could not load guest sessions', e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [passphrase, loadUserSessions]);

  // 4. Load messages for the active session
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const msgs = await getChatMessages(currentSessionId, user.userId, user.email, passphrase);
        if (isMounted) {
          setMessages(msgs);
        }
      } catch (err) {
        console.error(`Failed to load messages for chat ${currentSessionId}:`, err);
      }
    };

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [currentSessionId, user.userId, user.email, passphrase]);

  // 5. Actions: Create New Chat
  const handleNewChat = async () => {
    const newSessionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSession: ChatSession = {
      id: newSessionId,
      userId: user.userId,
      title: 'Новый диалог',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEncrypted: !!passphrase,
      messageCount: 0,
    };

    await saveChatSession(newSession, user.userId, user.email, passphrase);
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  // 6. Delete a chat session
  const handleDeleteSession = async (chatId: string) => {
    await deleteChatSession(chatId, user.userId, user.email);
    setSessions(prev => prev.filter(s => s.id !== chatId));

    if (currentSessionId === chatId) {
      const remaining = sessions.filter(s => s.id !== chatId);
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  };

  // 7. Rename chat session
  const handleRenameSession = async (chatId: string, newTitle: string) => {
    const session = sessions.find(s => s.id === chatId);
    if (!session) return;

    const updatedSession: ChatSession = {
      ...session,
      title: newTitle.trim() || 'Без названия',
      updatedAt: new Date().toISOString(),
    };

    await saveChatSession(updatedSession, user.userId, user.email, passphrase);
    setSessions(prev => prev.map(s => (s.id === chatId ? updatedSession : s)));
  };

  // 8. Clear current conversation messages
  const handleClearSession = async () => {
    if (!currentSessionId) return;
    setMessages([]);
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      const updated: ChatSession = {
        ...session,
        messageCount: 0,
        updatedAt: new Date().toISOString(),
      };
      await saveChatSession(updated, user.userId, user.email, passphrase);
      setSessions(prev => prev.map(s => (s.id === currentSessionId ? updated : s)));
    }
  };

  // 9. Send message to AI
  const handleSendMessage = async (text: string, image?: { mimeType: string; base64: string }) => {
    const imageBase64 = image?.base64;
    const imageMime = image?.mimeType;
    if (!text.trim() && !imageBase64) return;

    let activeChatId = currentSessionId;

    // Create session if none selected
    if (!activeChatId) {
      activeChatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const derivedTitle = text.trim()
        ? text.trim().slice(0, 32) + (text.length > 32 ? '...' : '')
        : 'Анализ изображения';

      const newSession: ChatSession = {
        id: activeChatId,
        userId: user.userId,
        title: derivedTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEncrypted: !!passphrase,
        messageCount: 1,
      };

      await saveChatSession(newSession, user.userId, user.email, passphrase);
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(activeChatId);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      chatId: activeChatId,
      userId: user.userId,
      role: 'user',
      content: text,
      isEncrypted: !!passphrase,
      hasImage: !!imageBase64,
      imageUrl: imageBase64,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    await saveChatMessage(userMessage, user.userId, user.email, passphrase);

    // Update session title on first message if needed
    const currentSess = sessions.find(s => s.id === activeChatId);
    if (currentSess && (currentSess.title === 'Новый диалог' || currentSess.messageCount === 0)) {
      const newTitle = text.trim()
        ? text.trim().slice(0, 32) + (text.length > 32 ? '...' : '')
        : 'Анализ изображения';
      const updatedSess = { ...currentSess, title: newTitle };
      await saveChatSession(updatedSess, user.userId, user.email, passphrase);
      setSessions(prev => prev.map(s => (s.id === activeChatId ? updatedSess : s)));
    }

    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const bodyPayload: any = {
        prompt: text,
        history: historyPayload,
        userName: user.displayName,
        userEmail: user.email,
        apiKey: customApiKey || undefined,
      };

      if (imageBase64 && imageMime) {
        bodyPayload.image = {
          mimeType: imageMime,
          base64: imageBase64.replace(/^data:[^;]+;base64,/, ''),
        };
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка при обращении к серверу');
      }

      const botMessage: ChatMessage = {
        id: `msg_${Date.now()}_m`,
        chatId: activeChatId,
        userId: user.userId,
        role: 'model',
        content: data.text || 'Ответ не получен.',
        isEncrypted: !!passphrase,
        hasImage: false,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, botMessage]);
      await saveChatMessage(botMessage, user.userId, user.email, passphrase);
    } catch (err: any) {
      console.error('Chat error:', err);
      const isMissingKey =
        err?.message?.includes('GEMINI_API_KEY is not configured') ||
        err?.message?.includes('API key not valid');

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        chatId: activeChatId,
        userId: user.userId,
        role: 'model',
        content: isMissingKey
          ? `⚠️ **API-ключ Gemini не настроен**\n\nПри запуске проекта локально на компьютере требуется бесплатный ключ Gemini:\n\n1. Получите бесплатный ключ: **[Google AI Studio](https://aistudio.google.com/app/apikey)**\n2. Добавьте его в файл \`.env\` в корне проекта:\n\`\`\`bash\nGEMINI_API_KEY="ваш_ключ"\n\`\`\`\nЗатем перезапустите сервер (\`npm run dev\`).`
          : `**Ошибка:** ${err?.message || 'Модель AI временно занята. Нажмите «Повторить» ниже.'}`,
        isEncrypted: false,
        hasImage: false,
        createdAt: new Date().toISOString(),
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryMessage = (lastPrompt: string) => {
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].error) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    handleSendMessage(lastPrompt);
  };

  // 10. Sign out without deleting account chats
  const handleSignOut = async () => {
    try {
      await logoutUser();
      localStorage.removeItem('cipherai_logged_in_user');
      setUser(GUEST_USER);
      setCurrentSessionId(null);
      setMessages([]);
      // Load clean guest sessions without touching user chats
      await loadUserSessions(GUEST_USER.userId, undefined, passphrase);
      setShowSignOutConfirm(false);
    } catch (e) {
      console.error('Sign out error', e);
    }
  };

  const handleSavePassphrase = (newPassphrase: string) => {
    setPassphrase(newPassphrase);
    if (newPassphrase) {
      localStorage.setItem('cipherai_vault_passphrase', newPassphrase);
    } else {
      localStorage.removeItem('cipherai_vault_passphrase');
    }
    if (user) {
      loadUserSessions(user.userId, user.email, newPassphrase);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden ${
        isDarkMode ? 'dark' : ''
      } bg-zinc-100 dark:bg-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-100`}
    >
      {/* Sidebar with Navigation & History */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={id => setCurrentSessionId(id)}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onRequestSignOut={() => setShowSignOutConfirm(true)}
        onOpenEncryptionModal={() => setIsEncryptionModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main Conversation & Vision Area */}
      <ChatArea
        session={currentSession}
        messages={messages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onOpenEncryptionModal={() => setIsEncryptionModalOpen(true)}
        onSelectPrompt={p => handleSendMessage(p)}
        onViewImage={url => setViewingImageUrl(url)}
        onClearSession={handleClearSession}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={async newUser => {
          await saveUserProfile(newUser);
          setUser(newUser);
          setIsAuthModalOpen(false);
          await migrateGuestChatsToUser(newUser.userId, newUser.email, passphrase);
          await loadUserSessions(newUser.userId, newUser.email, passphrase);
        }}
        onGuestMode={() => {
          setUser(GUEST_USER);
          setIsAuthModalOpen(false);
          loadUserSessions(GUEST_USER.userId, undefined, passphrase);
        }}
      />

      {/* Encryption & Privacy Vault Modal */}
      <EncryptionModal
        isOpen={isEncryptionModalOpen}
        onClose={() => setIsEncryptionModalOpen(false)}
        currentPassphrase={passphrase}
        onSavePassphrase={handleSavePassphrase}
        userId={user?.userId || 'guest'}
      />

      {/* Fullscreen Image Lightbox Modal */}
      <ImageViewerModal
        imageUrl={viewingImageUrl}
        onClose={() => setViewingImageUrl(null)}
      />

      {/* Exit / Sign Out Confirmation Dialog */}
      <ConfirmModal
        isOpen={showSignOutConfirm}
        title="Выйти из аккаунта?"
        description="Ваши чаты и история останутся в полной безопасности в вашем аккаунте. Вы сможете войти снова в любой момент и продолжить общение."
        confirmText="Выйти"
        cancelText="Остаться"
        variant="warning"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </div>
  );
}
