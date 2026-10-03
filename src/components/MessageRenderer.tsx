import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MessageRendererProps {
  content: string;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content }) => {
  // Parse code blocks with ```lang \n code ```
  const parts: Array<{ type: 'text' | 'code'; language?: string; code?: string; text?: string }> = [];

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        text: content.substring(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code',
      language: match[1] || 'plaintext',
      code: match[2]?.trimEnd(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      text: content.substring(lastIndex),
    });
  }

  const renderFormattedText = (rawText: string) => {
    // Process markdown headers, bold, bullet points, inline code
    const lines = rawText.split('\n');

    return (
      <div className="space-y-2 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Header 3: ###
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-4 mb-1">
                {trimmed.replace('### ', '')}
              </h3>
            );
          }
          // Header 2: ##
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-5 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">
                {trimmed.replace('## ', '')}
              </h2>
            );
          }
          // Header 1: #
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-6 mb-2">
                {trimmed.replace('# ', '')}
              </h1>
            );
          }
          // Bullet point
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 mt-2 shrink-0" />
                <span className="flex-1">{formatInline(trimmed.substring(2))}</span>
              </div>
            );
          }
          // Numbered list
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-2">
                <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {numMatch[1]}.
                </span>
                <span className="flex-1">{formatInline(numMatch[2])}</span>
              </div>
            );
          }

          // Empty line
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          return (
            <p key={idx} className="my-1">
              {formatInline(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const formatInline = (str: string) => {
    // Process `code` and **bold** and *italic*
    const segments: React.ReactNode[] = [];
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let curr = 0;
    let tMatch: RegExpExecArray | null;

    while ((tMatch = tokenRegex.exec(str)) !== null) {
      if (tMatch.index > curr) {
        segments.push(str.substring(curr, tMatch.index));
      }

      const matchText = tMatch[0];
      if (matchText.startsWith('`') && matchText.endsWith('`')) {
        segments.push(
          <code
            key={tMatch.index}
            className="px-1.5 py-0.5 mx-0.5 text-xs font-mono rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold"
          >
            {matchText.slice(1, -1)}
          </code>
        );
      } else if (matchText.startsWith('**') && matchText.endsWith('**')) {
        segments.push(
          <strong key={tMatch.index} className="font-semibold text-zinc-900 dark:text-zinc-50">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
        segments.push(
          <em key={tMatch.index} className="italic">
            {matchText.slice(1, -1)}
          </em>
        );
      }

      curr = tMatch.index + matchText.length;
    }

    if (curr < str.length) {
      segments.push(str.substring(curr));
    }

    return segments;
  };

  return (
    <div className="text-sm space-y-2 break-words">
      {parts.map((part, index) => {
        if (part.type === 'code' && part.code !== undefined) {
          return <CodeBlock key={index} language={part.language || ''} code={part.code} />;
        }
        return <React.Fragment key={index}>{renderFormattedText(part.text || '')}</React.Fragment>;
      })}
    </div>
  );
};
