import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string, image?: { mimeType: string; base64: string }) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{
    file: File;
    previewUrl: string;
    mimeType: string;
    base64: string;
  } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    setInputError(null);
    if (!file.type.startsWith('image/')) {
      setInputError('Please upload an image file (PNG, JPG, WEBP, or GIF).');
      setTimeout(() => setInputError(null), 3500);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setSelectedImage({
        file,
        previewUrl: dataUrl,
        mimeType: file.type,
        base64,
      });
    };
    reader.readAsDataURL(file);
  };

  // Clipboard paste support for screenshots
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed && !selectedImage) return;

    onSendMessage(
      trimmed,
      selectedImage
        ? {
            mimeType: selectedImage.mimeType,
            base64: selectedImage.base64,
          }
        : undefined
    );

    setText('');
    setSelectedImage(null);
    setInputError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-1 select-none">
      {inputError && (
        <div className="mb-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{inputError}</span>
        </div>
      )}

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg dark:shadow-2xl transition-all focus-within:border-emerald-500/80 dark:focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20">
        {/* Attached image preview banner */}
        {selectedImage && (
          <div className="p-3 pb-0 flex items-center gap-3">
            <div className="relative group w-16 h-16 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-black/50 shadow-inner">
              <img
                src={selectedImage.previewUrl}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/80 text-white hover:bg-red-600 transition-colors shadow-xs"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]">
                {selectedImage.file.name}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                <Sparkles className="w-3 h-3" />
                Image ready for visual AI inspection & coding
              </p>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-2 p-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              selectedImage
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95'
            }`}
            title="Attach image for visual analysis (or paste screenshot Ctrl+V)"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            placeholder={
              selectedImage
                ? 'Ask questions about this image or request code generation...'
                : 'Ask anything, request code, or paste an image (Ctrl+V)...'
            }
            rows={1}
            className="flex-1 max-h-44 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none py-1.5 leading-relaxed font-sans"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || (!text.trim() && !selectedImage)}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold transition-all disabled:opacity-40 disabled:hover:bg-zinc-900 dark:disabled:hover:bg-white active:scale-95 shadow-md flex items-center justify-center shrink-0 cursor-pointer"
            title="Send message (Enter)"
          >
            {disabled ? (
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400 dark:text-zinc-700" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-zinc-500 select-none">
        <span className="hidden sm:inline">
          Press <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-[10px] text-zinc-700 dark:text-zinc-300 font-mono">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-[10px] text-zinc-700 dark:text-zinc-300 font-mono">Shift + Enter</kbd> for newline
        </span>
        <span className="text-zinc-500 dark:text-zinc-400 ml-auto flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Zero-Knowledge Encrypted & Firebase Synced
        </span>
      </div>
    </div>
  );
};
