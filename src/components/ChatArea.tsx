import React, { useRef, useEffect, useState } from 'react';
import {
  Menu,
  Sparkles,
  Lock,
  Download,
  Trash2,
  Code2,
  Image as ImageIcon,
  Copy,
  Check,
  Zap,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  FileCode,
  Shield,
  Layers,
} from 'lucide-react';
import { ChatMessage, ChatSession } from '../types';
import { MessageRenderer } from './MessageRenderer';
import { ChatInput } from './ChatInput';
import { ConfirmModal } from './ConfirmModal';

interface ChatAreaProps {
  session: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, image?: { mimeType: string; base64: string }) => void;
  onRetryMessage: (lastPrompt: string) => void;
  onOpenSidebar: () => void;
  onOpenEncryptionModal: () => void;
  onSelectPrompt: (prompt: string) => void;
  onViewImage: (imageUrl: string) => void;
  onClearSession: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  session,
  messages,
  isLoading,
  onSendMessage,
  onRetryMessage,
  onOpenSidebar,
  onOpenEncryptionModal,
  onSelectPrompt,
  onViewImage,
  onClearSession,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportMarkdown = () => {
    if (!messages.length) return;
    let md = `# ${session?.title || 'CipherAI Chat Export'}\n\n`;
    messages.forEach(m => {
      const sender = m.role === 'user' ? '### User' : '### CipherAI';
      md += `${sender} (${new Date(m.createdAt).toLocaleString()}):\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session?.title || 'conversation').replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const starterPrompts = [
    {
      title: 'Analyze UI & Generate Code',
      badge: 'Vision AI',
      desc: 'Upload a website or app screenshot to get pixel-perfect HTML/Tailwind code',
      icon: <ImageIcon className="w-5 h-5 text-emerald-400" />,
      color: 'from-emerald-500/20 to-teal-500/5',
      borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
      prompt:
        'Here is my UI screenshot. Please analyze layout hierarchy, colors, typography, and components, then generate clean, modern HTML with Tailwind CSS.',
    },
    {
      title: 'Interactive React Component',
      badge: 'Frontend',
      desc: 'Modern TypeScript component with live preview, smooth animations & state',
      icon: <Code2 className="w-5 h-5 text-cyan-400" />,
      color: 'from-cyan-500/20 to-blue-500/5',
      borderColor: 'border-cyan-500/30 hover:border-cyan-500/60',
      prompt:
        'Write a complete, production-grade interactive React component with TypeScript and Tailwind CSS for an animated analytics dashboard metric card with a sparkline chart and tabs.',
    },
    {
      title: 'Algorithm & Logic Refactor',
      badge: 'Engineering',
      desc: 'Debug subtle edge cases, optimize performance, and write unit tests',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      color: 'from-amber-500/20 to-orange-500/5',
      borderColor: 'border-amber-500/30 hover:border-amber-500/60',
      prompt:
        'Explain and implement a high-performance LRU Cache in TypeScript with O(1) get and put time complexity, using a doubly linked list and hash map with unit tests.',
    },
  ];

  const quickActionChips = [
    { label: '📸 Upload Screenshot for UI Code', prompt: 'I would like to upload a screenshot. How should I prepare it for you to convert to React and Tailwind?' },
    { label: '⚡ Debug Code & Fix Errors', prompt: 'Here is some code that has bugs. Can you spot edge cases and optimize it for production?' },
    { label: '🎨 Modern Responsive Layout', prompt: 'Create a responsive modern landing page hero section with dark/light theme support, glassmorphism, and call to action buttons.' },
  ];

  // Find last user message for quick retry
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden transition-colors"
            title="Open conversation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {session?.title || 'New Conversation'}
            </h2>
            <button
              type="button"
              onClick={onOpenEncryptionModal}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-medium hover:bg-emerald-500/20 transition-all cursor-pointer shadow-xs"
              title="Click to inspect zero-knowledge encryption settings"
            >
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>AES-256 GCM</span>
            </button>
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full bg-zinc-50 dark:bg-zinc-900">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini Resilient Engine
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-xs cursor-pointer"
                title="Export as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-red-500 bg-zinc-100 dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/30 border border-zinc-200 dark:border-zinc-800 transition-all cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Clear</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {messages.length === 0 && !isLoading ? (
          <div className="max-w-3xl mx-auto h-full flex flex-col items-center justify-center text-center py-6">
            {/* Attractive Hero Glow Box */}
            <div className="relative mb-4 group">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-30 blur-lg group-hover:opacity-60 transition duration-500" />
              <div className="relative w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-700/80 flex items-center justify-center text-white shadow-2xl">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
              Welcome to <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 bg-clip-text text-transparent">CipherAI</span> Studio
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mb-8 leading-relaxed">
              Your high-performance AI assistant for software engineering, live component execution, and visual image inspection with{' '}
              <strong className="text-emerald-500 font-semibold">zero-knowledge AES-256 client encryption</strong>.
            </p>

            {/* Quick Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full text-left">
              {starterPrompts.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectPrompt(card.prompt)}
                  className={`relative p-4 rounded-2xl bg-gradient-to-b ${card.color} bg-white dark:bg-zinc-900/90 border ${card.borderColor} shadow-sm hover:shadow-lg transition-all duration-200 group cursor-pointer text-left flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 shadow-xs">
                      {card.icon}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono">
                      {card.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-500 transition-colors">
                      {card.title}
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick action chips */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {quickActionChips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectPrompt(chip.prompt)}
                  className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-emerald-500 transition-all shadow-2xs hover:scale-102 cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map(message => {
              const isUser = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 border border-zinc-700 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[88%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* User attached image */}
                    {message.imageUrl && (
                      <div className="mb-2 group relative">
                        <img
                          src={message.imageUrl}
                          alt="Visual input"
                          onClick={() => onViewImage(message.imageUrl!)}
                          className="max-h-64 max-w-xs rounded-2xl border-2 border-emerald-500/30 shadow-lg object-cover cursor-pointer hover:opacity-95 transition-all"
                        />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md text-[10px] text-zinc-300 pointer-events-none">
                          Click to enlarge
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`relative rounded-2xl px-4 py-3.5 shadow-sm leading-relaxed transition-all ${
                        isUser
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-normal rounded-tr-xs shadow-md'
                          : message.error
                          ? 'bg-red-950/70 border border-red-800 text-red-200 rounded-tl-xs w-full'
                          : 'bg-white dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-xs w-full shadow-xs'
                      }`}
                    >
                      {isUser ? (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
                      ) : message.error ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2 text-xs">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              <p className="font-semibold text-red-300">Model High Demand or Capacity Notice</p>
                              <p className="text-red-200/80 mt-1">{message.content.replace(/\*\*Error:\*\*/g, '')}</p>
                            </div>
                          </div>
                          {lastUserMessage && (
                            <button
                              type="button"
                              onClick={() => onRetryMessage(lastUserMessage.content)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Retry with Fallback Engine</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <MessageRenderer content={message.content} />
                      )}

                      {/* Model action footer */}
                      {!isUser && !message.error && (
                        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                            <Lock className="w-3 h-3 text-emerald-500" />
                            Encrypted & Synced
                          </span>

                          <div className="flex items-center gap-2">
                            {lastUserMessage && (
                              <button
                                type="button"
                                onClick={() => onRetryMessage(lastUserMessage.content)}
                                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Regenerate response"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Regenerate</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyMessage(message.id, message.content)}
                              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="Copy response"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-zinc-400 px-1 mt-1 font-mono">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3.5 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-600 border border-zinc-700 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-3 shadow-md">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium">CipherAI is processing code & visual tokens...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />

      {/* Confirmation Modal for Clearing Conversation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Current Conversation?"
        description="This will permanently wipe all messages in this session from your encrypted vault and Firebase storage."
        confirmText="Yes, Clear History"
        cancelText="Keep Messages"
        variant="danger"
        onConfirm={() => {
          setShowClearConfirm(false);
          onClearSession();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
