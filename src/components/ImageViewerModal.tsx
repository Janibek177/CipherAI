import React from 'react';
import { X, ZoomIn, Download } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 text-zinc-300">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ZoomIn className="w-4 h-4 text-zinc-400" />
            <span>Visual Inspection</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              download="cipherai-visual-analysis.png"
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-auto flex items-center justify-center bg-black/60">
          <img
            src={imageUrl}
            alt="Enlarged visual input"
            className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};
