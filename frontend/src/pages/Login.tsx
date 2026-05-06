import React from 'react';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
  return (
    <div
      className="min-h-full flex items-center justify-center px-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/login-bg.png')` }}
    >
      <div className="w-full max-w-sm bg-white/90 rounded-2xl shadow-lg p-8">
        <LoginForm />
      </div>
    </div>
  );
}
