import React from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export function DashboardHome() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="text-primary-600" size={36} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Selecione uma conversa
        </h2>
        <p className="text-gray-500 max-w-md">
          Clique em uma conversa na barra lateral para iniciar o atendimento.
        </p>
      </div>
    </div>
  );
}
