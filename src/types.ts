export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  isEncrypted: boolean;
  hasImage: boolean;
  imageUrl?: string;
  createdAt: string;
  error?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isEncrypted: boolean;
  messageCount?: number;
  lastMessageSnippet?: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  isGuest?: boolean;
}

export interface EncryptedEnvelope {
  v: 1;
  iv: string; // base64
  salt: string; // base64
  ct: string; // base64 ciphertext
}

export interface ChatApiRequest {
  prompt: string;
  userName?: string;
  userEmail?: string;
  history?: Array<{
    role: 'user' | 'model';
    content: string;
  }>;
  image?: {
    mimeType: string;
    base64: string;
  };
  systemInstruction?: string;
}

export interface ChatApiResponse {
  text: string;
  error?: string;
}
