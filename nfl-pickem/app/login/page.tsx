"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [userColor, setUserColor] = useState('#E31837');

  const router = useRouter();
  const supabase = createClient();

useEffect(() => {
    async function checkSession() {
      // 1. Limpa o storage se for necessário (opcional)
      const { data: { session }, error } = await supabase.auth.getSession();

      // Se houver erro de token (400), o Supabase retornará erro aqui
      if (error || !session) {
        await supabase.auth.signOut(); // Força a limpeza local
        setLoading(false);
        return;
      }

      // Se a sessão for válida, redireciona
      router.push('/dashboard');
    }
    checkSession();
  }, [router, supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (isSignUp && password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords do not match." });
      return;
    }

    setSubmitting(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });

        if (error) throw error;

        if (data.session) {
          router.push('/dashboard');
          router.refresh();
        } else {
          setMessage({ type: 'success', text: "Success! Check your email to confirm your account." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "An error occurred during authentication." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${userColor} var(--tw-border-opacity)` }}></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-600/5 blur-[150px] pointer-events-none z-0"></div>

      <div className="w-full max-w-md bg-neutral-900/80 border border-white/5 rounded-2xl p-8 shadow-2xl backdrop-blur-md z-10 animate-fadeIn">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            Blitz<span style={{ color: userColor }}>Picks</span>
          </h1>
          <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">
            {isSignUp ? 'Create your new account' : 'Sign in to manage your predictions'}
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 border rounded-xl text-[10px] font-bold text-center uppercase tracking-wider ${
            message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
          }`}>
            {message.type === 'error' ? '⚠️ ' : '✓ '} {message.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" className="w-full h-11 bg-black border border-white/10 rounded-xl px-4 text-sm focus:border-white transition" />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="w-full h-11 bg-black border border-white/10 rounded-xl px-4 text-sm focus:border-white transition" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest hover:text-white">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Confirm Password</label>
              <input type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" className="w-full h-11 bg-black border border-white/10 rounded-xl px-4 text-sm focus:border-white transition" />
            </div>
          )}

          <button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            style={{ backgroundColor: userColor, color: '#000' }}>
            {submitting ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-white/5 pt-6">
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </main>
  );
}