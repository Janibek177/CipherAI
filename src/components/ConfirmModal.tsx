import React from 'react';
import { AlertTriangle, Trash2, X, LogOut, Check } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700/90 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col scale-100 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 text-center flex flex-col items-center">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 border ${
              variant === 'danger'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {variant === 'danger' ? (
              <Trash2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">{description}</p>

          <div className="flex items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md active:scale-98 text-white ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
