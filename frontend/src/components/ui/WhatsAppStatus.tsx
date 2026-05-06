import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface WhatsAppStatusIndicatorProps {
  connectionState: 'disconnected' | 'connecting' | 'connected';
  onClick?: () => void;
}

export function WhatsAppStatusIndicator({ connectionState, onClick }: WhatsAppStatusIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-gray-100"
      title={
        connectionState === 'connected'
          ? 'WhatsApp conectado'
          : connectionState === 'connecting'
          ? 'Conectando ao WhatsApp...'
          : 'WhatsApp desconectado - clique para reconectar'
      }
    >
      {connectionState === 'connected' ? (
        <>
          <Wifi size={14} className="text-green-500" />
          <span className="text-green-600 font-medium">WhatsApp Online</span>
        </>
      ) : connectionState === 'connecting' ? (
        <>
          <Loader2 size={14} className="text-yellow-500 animate-spin" />
          <span className="text-yellow-600">Conectando...</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-red-400" />
          <span className="text-red-500">WhatsApp Offline</span>
        </>
      )}
    </button>
  );
}
