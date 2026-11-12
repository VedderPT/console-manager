'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('Email ou palavra-passe incorretos.');
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card mt-16 space-y-3">
      <h1 className="text-xl font-semibold">Star Tech · Entrar</h1>
      <input className="input" type="email" placeholder="Email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Palavra-passe" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</button>
    </form>
  );
}
