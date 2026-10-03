import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Lock,
  Moon,
  Sun,
  Shield,
  LogOut,
  LogIn,
  Edit2,
  Check,
  X,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react';
import { ChatSession, UserProfile } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onRequestSignOut: () => void;
  onOpenEncryptionModal: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  user,
  onOpenAuth,
  onRequestSignOut,
  onOpenEncryptionModal,
  isDarkMode,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const isGuest = !user || user.isGuest;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 sm:w-80 bg-zinc-950 text-zinc-100 border-r border-zinc-800/90 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header Branding & New Chat */}
        <div className="p-4 border-b border-zinc-800/80 space-y-3 bg-zinc-950/90 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-cyan-500 p-0.5 shadow-md">
                <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  CipherAI
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                    AES-256
                  </span>
                </h1>
                <p className="text-[11px] text-zinc-400 font-medium">Encrypted Intelligence</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-zinc-100 to-zinc-200 hover:from-white hover:to-zinc-100 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-98 cursor-pointer hover:shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4 text-zinc-950" />
            <span>New Conversation</span>
          </button>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chat history..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all font-sans"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-900 border border-zinc-800">
              {filteredSessions.length}
            </span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-zinc-500">
              {searchQuery ? 'No matching chats found' : 'No conversations yet'}
            </div>
          ) : (
            filteredSessions.map(session => {
              const isSelected = session.id === currentSessionId;
              const isEditing = session.id === editingId;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectSession(session.id);
                      if (window.innerWidth < 768) onClose();
                    }
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                    isSelected
                      ? 'bg-zinc-800/90 text-white font-medium border border-zinc-700/60 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-700 text-xs text-white focus:outline-none w-full"
                      />
                    ) : (
                      <span className="truncate flex-1">{session.title}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={e => saveRename(session.id, e)}
                          className="p-1 rounded hover:bg-zinc-700 text-emerald-400"
                          title="Save title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-400"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {session.isEncrypted && (
                          <span title="End-to-end encrypted">
                            <Lock className="w-3 h-3 text-emerald-500/80 shrink-0" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={e => startRename(session, e)}
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="Rename chat"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer User & Security Panel */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 space-y-2">
          {/* Privacy Vault trigger */}
          <button
            type="button"
            onClick={onOpenEncryptionModal}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 text-xs transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-300 font-medium">Privacy Vault</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 font-mono">
              Zero-Knowledge
            </span>
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {isDarkMode ? (
                <Moon className="w-4 h-4 text-cyan-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              <span>Theme Appearance</span>
            </div>
            <span className="text-[11px] font-semibold text-zinc-400 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700">
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>

          {/* User Account Section */}
          <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
            {!isGuest ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-cyan-600 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-xs">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user?.displayName?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1">
                      {user?.displayName}
                      <UserCheck className="w-3 h-3 text-emerald-400 inline shrink-0" />
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onRequestSignOut}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                  title="Sign Out / Exit Account"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-zinc-500" />
                    Guest Session
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Local Storage</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition-all shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In or Create Account</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Delete Conversation Confirmation Modal */}
      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="Delete Conversation?"
        description={
          sessionToDelete
            ? `Are you sure you want to permanently delete "${sessionToDelete.title}"? All messages in this conversation will be permanently wiped.`
            : ''
        }
        confirmText="Delete Conversation"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (sessionToDelete) {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </>
  );
};
