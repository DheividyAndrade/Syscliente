import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';

interface MessageBubbleProps {
  content: string;
  senderType: 'CLIENT' | 'AGENT' | 'SYSTEM';
  senderName?: string;
  timestamp: string;
  status?: string;
  contentType?: string;
  mediaUrl?: string;
}

export function MessageBubble({ content, senderType, senderName, timestamp, status, contentType, mediaUrl }: MessageBubbleProps) {
  if (senderType === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span className="chat-bubble-system">{content}</span>
      </div>
    );
  }

  const isAgent = senderType === 'AGENT';
  const time = new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const signedUrl = mediaUrl && token ? `${mediaUrl}?token=${encodeURIComponent(token)}` : mediaUrl;

  const statusIcon = isAgent ? (
    status === 'READ' ? <CheckCheck size={12} className="text-blue-300" />
    : status === 'DELIVERED' ? <CheckCheck size={12} className="text-white/60" />
    : status === 'FAILED' ? <Clock size={12} className="text-red-300" />
    : <Check size={12} className="text-white/60" />
  ) : null;

  return (
    <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} px-4 mb-1`}>
      <div className={isAgent ? 'chat-bubble-agent' : 'chat-bubble-client'}>
        {!isAgent && senderName && (
          <p className="text-xs font-semibold text-primary-600 mb-0.5">{senderName}</p>
        )}
        {contentType === 'IMAGE' && signedUrl ? (
          <div className="mb-1">
            <img
              src={signedUrl}
              alt={content}
              className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(signedUrl, '_blank')}
              title="Clique para ampliar"
            />
            {content !== '\u{1F4F7} Imagem' && (
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{content}</p>
            )}
          </div>
        ) : contentType === 'AUDIO' && signedUrl ? (
          <div className="mb-1">
            <audio controls className="max-w-[250px] h-10" src={signedUrl}>
              Seu navegador nao suporta audio.
            </audio>
            <p className="text-xs mt-1">🎵 Áudio</p>
          </div>
        ) : contentType === 'VIDEO' && signedUrl ? (
          <div className="mb-1">
            <video controls className="rounded-lg max-w-[250px] max-h-[300px]" src={signedUrl}>
              Seu navegador nao suporta video.
            </video>
            {content !== '\u{1F3AC} Video' && (
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{content}</p>
            )}
          </div>
        ) : contentType === 'DOCUMENT' && signedUrl ? (
          <div className="mb-1">
            <a
              href={signedUrl}
              download
              className="inline-flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 hover:bg-white/30 transition-colors"
            >
              <span className="text-lg">📎</span>
              <span className="text-sm underline">{content}</span>
            </a>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
        <div className={`flex items-center gap-1 mt-0.5 ${isAgent ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-[10px] ${isAgent ? 'text-white/70' : 'text-gray-400'}`}>
            {time}
          </span>
          {statusIcon}
        </div>
      </div>
    </div>
  );
}
