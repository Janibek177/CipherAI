import React, { useState } from 'react';
import { Copy, Check, Play, Code as CodeIcon, Eye } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code', e);
    }
  };

  const isPreviewable =
    ['html', 'xml', 'svg', 'javascript', 'js'].includes(language.toLowerCase()) ||
    code.includes('<!DOCTYPE html>') ||
    code.includes('<html') ||
    code.includes('<div') ||
    code.includes('<svg');

  const getPreviewDoc = () => {
    if (code.includes('<!DOCTYPE html>') || code.includes('<html')) {
      return code;
    }
    if (language.toLowerCase() === 'svg' || code.trim().startsWith('<svg')) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0d1117;color:#fff;font-family:sans-serif;}</style></head><body>${code}</body></html>`;
    }
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 1.5rem; background: #fafafa; color: #18181b; }
          </style>
        </head>
        <body>
          ${code}
          ${
            language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js'
              ? `<script>${code}</script>`
              : ''
          }
        </body>
      </html>
    `;
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-md">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-xs text-zinc-400 font-mono select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 uppercase tracking-wider font-semibold text-zinc-300">
            {language || 'code'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isPreviewable && (
            <div className="flex items-center bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700/50 mr-2">
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'code'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <CodeIcon className="w-3 h-3" />
                Code
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'preview'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs font-sans"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body or Sandboxed Live Preview */}
      {activeTab === 'code' ? (
        <div className="overflow-x-auto p-4 text-[13px] font-mono leading-relaxed bg-[#0d1117] text-zinc-200">
          <pre className="m-0 font-mono whitespace-pre">{code}</pre>
        </div>
      ) : (
        <div className="bg-white p-2 min-h-[220px] max-h-[420px] overflow-hidden">
          <iframe
            title="Code Preview"
            srcDoc={getPreviewDoc()}
            sandbox="allow-scripts allow-modals"
            className="w-full h-72 border-0 rounded-lg bg-white"
          />
        </div>
      )}
    </div>
  );
};
