import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Smile } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder = 'Digite sua mensagem...' }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current && !pickerRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmoji]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!content.trim() || sending || disabled) return;

    setSending(true);
    try {
      await onSend(content.trim());
      setContent('');
      setShowEmoji(false);
      inputRef.current?.focus();
    } catch {
      // error handled by parent
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: EmojiClickData) => {
    setContent((prev) => prev + emoji.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 relative">
      {showEmoji && (
        <div ref={pickerRef} className="absolute bottom-full right-4 mb-2 z-50 shadow-xl rounded-xl overflow-hidden">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            height={380}
            width={320}
            searchPlaceholder="Buscar emoji..."
            lazyLoadEmojis
          />
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          ref={btnRef}
          onClick={() => { setShowEmoji(!showEmoji); inputRef.current?.focus(); }}
          disabled={disabled}
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            showEmoji ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Emojis"
        >
          <Smile size={20} />
        </button>
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed max-h-32"
          style={{ minHeight: '40px' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 128) + 'px';
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-lg flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
