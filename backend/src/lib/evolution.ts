import { env } from '../config/env';
import { logger } from './logger';

const BASE_URL = env.EVOLUTION_API_URL;
const API_KEY = env.EVOLUTION_API_KEY;
const INSTANCE = env.EVOLUTION_INSTANCE_NAME;

interface SendTextParams {
  number: string;
  text: string;
  delay?: number;
}

interface SendTextResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    extendedTextMessage?: { text: string };
    conversation?: string;
  };
  status: string;
}

async function request<T>(endpoint: string, body: unknown): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Evolution API error', {
      endpoint,
      status: response.status,
      error: errorText,
    });
    throw new Error(`Evolution API error: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function sendText(params: SendTextParams): Promise<SendTextResponse> {
  return request<SendTextResponse>(`/message/sendText/${INSTANCE}`, {
    number: params.number,
    text: params.text,
    delay: params.delay ?? 1200,
  });
}

export async function sendImage(params: {
  number: string;
  imageUrl: string;
  caption?: string;
}) {
  return request(`/message/sendMedia/${INSTANCE}`, {
    number: params.number,
    mediatype: 'image',
    media: params.imageUrl,
    caption: params.caption,
  });
}

export async function sendDocument(params: {
  number: string;
  documentUrl: string;
  fileName?: string;
}) {
  return request(`/message/sendMedia/${INSTANCE}`, {
    number: params.number,
    mediatype: 'document',
    media: params.documentUrl,
    fileName: params.fileName,
  });
}

export async function checkInstanceStatus(): Promise<{ instance: { state: string } }> {
  const url = `${BASE_URL}/instance/connectionState/${INSTANCE}`;

  const response = await fetch(url, {
    headers: { apikey: API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Evolution API status check failed: ${response.status}`);
  }

  return response.json() as Promise<{ instance: { state: string } }>;
}
