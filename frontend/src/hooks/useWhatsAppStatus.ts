import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface WhatsAppStatus {
  connectionState: ConnectionState;
  hasQR: boolean;
}

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connectionState: 'disconnected',
    hasQR: false,
  });
  const [qrCode, setQrCode] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/status');
      setStatus(data);
    } catch {
      // ignore
    }
  }, []);

  const fetchQR = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/qr');
      setQrCode(data.qr);
    } catch {
      setQrCode(null);
    }
  }, []);

  const reconnect = useCallback(async () => {
    try {
      await api.post('/whatsapp/reconnect');
      setTimeout(fetchStatus, 3000);
    } catch {
      // ignore
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, qrCode, fetchQR, reconnect };
}
