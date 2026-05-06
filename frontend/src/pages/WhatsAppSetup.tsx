import React, { useEffect, useState } from 'react';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import { useAuth } from '../hooks/useAuth';
import { Wifi, WifiOff, RefreshCw, QrCode } from 'lucide-react';

export function WhatsAppSetupPage() {
  const { user } = useAuth();
  const { status, qrCode, fetchQR, reconnect } = useWhatsAppStatus();
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (status.hasQR) {
      fetchQR();
    }
  }, [status.hasQR, fetchQR]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    await reconnect();
    setTimeout(() => {
      fetchQR();
      setIsReconnecting(false);
    }, 3000);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/logo.png" alt="Syscliente" className="w-8 h-8 rounded" />
            <h2 className="text-xl font-semibold text-gray-900">WhatsApp</h2>
          </div>
          <p className="text-sm text-gray-500">Conexão do WhatsApp Business</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Status da Conexão</h3>
            {status.connectionState === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                <Wifi size={14} /> Conectado
              </span>
            ) : status.connectionState === 'connecting' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
                <RefreshCw size={14} className="animate-spin" /> Conectando
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">
                <WifiOff size={14} /> Desconectado
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-4">
            {status.connectionState === 'connected'
              ? 'O WhatsApp está conectado e pronto para receber e enviar mensagens.'
              : status.connectionState === 'connecting'
              ? 'Aguardando conexão com o WhatsApp...'
              : 'O WhatsApp não está conectado. É necessário escanear o QR code.'}
          </p>

          {status.connectionState !== 'connected' && isAdmin && (
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={16} className={isReconnecting ? 'animate-spin' : ''} />
              {isReconnecting ? 'Reconectando...' : 'Reconectar WhatsApp'}
            </button>
          )}

          {status.connectionState !== 'connected' && !isAdmin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              Apenas administradores podem reconectar o WhatsApp. Solicite ao admin.
            </div>
          )}
        </div>

        {/* QR Code Card */}
        {status.hasQR && qrCode && isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode size={20} className="text-primary-600" />
              <h3 className="text-sm font-semibold text-gray-700">Escanear QR Code</h3>
            </div>

            <div className="flex justify-center mb-4">
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="w-64 h-64 border-2 border-gray-200 rounded-xl p-2"
              />
            </div>

            <div className="text-sm text-gray-500 space-y-2 bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>Abra o <strong>WhatsApp</strong> no celular</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>Vá em <strong>Aparelhos conectados</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>Toque em <strong>Conectar um aparelho</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">4</span>
                <span>Escaneie o QR code acima</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              A sessão é salva automaticamente. Você não precisará escanear novamente ao reiniciar o servidor.
            </p>
          </div>
        )}

        {status.connectionState === 'connected' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm text-green-700 font-medium">
              Tudo pronto! As mensagens do WhatsApp aparecerão automaticamente na lista de conversas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
