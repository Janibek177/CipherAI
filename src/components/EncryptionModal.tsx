import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, Check, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface EncryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPassphrase: string;
  onSavePassphrase: (passphrase: string) => void;
  userId: string;
}

export const EncryptionModal: React.FC<EncryptionModalProps> = ({
  isOpen,
  onClose,
  currentPassphrase,
  onSavePassphrase,
  userId,
}) => {
  const [passphraseInput, setPassphraseInput] = useState(currentPassphrase);
  const [showKey, setShowKey] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePassphrase(passphraseInput.trim());
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
  };

  const handleResetDefault = () => {
    setPassphraseInput('');
    onSavePassphrase('');
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Privacy & Cryptographic Vault</h2>
              <p className="text-xs text-zinc-400">Client-Side Zero-Knowledge Encryption</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Encryption status card */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>AES-GCM-256 Bit Active</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">PBKDF2 100k It.</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              All messages are encrypted directly inside your browser before transmission to Firebase
              Firestore. Even database administrators cannot read your prompts, code, or AI responses.
            </p>
          </div>

          {/* Passphrase Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Custom Encryption Passphrase (Optional)</span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[11px] text-zinc-400 hover:text-white transition-colors underline"
                >
                  {showKey ? 'Hide' : 'Reveal'}
                </button>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={passphraseInput}
                  onChange={e => setPassphraseInput(e.target.value)}
                  placeholder="Leave blank for automatic secure vault key"
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono transition-all"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                If left empty, your private account seed is automatically derived for seamless cross-device
                decryption.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetDefault}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Reset to Default Key
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95"
                >
                  {savedNotice ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Apply Passphrase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
