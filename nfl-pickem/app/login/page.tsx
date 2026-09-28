"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { AlertTriangle, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const leagueBlue = '#013369';
  const leagueRed = '#E31837';

  useEffect(() => {
    async function checkSession() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        await supabase.auth.signOut(); 
        setLoading(false);
        return;
      }
      router.push('/dashboard');
    }
    checkSession();
  }, [router, supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setMessage({ type: 'error', text: "Passwords do not match." });
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });

        if (error) throw error;

        if (data.session) {
          router.push('/setup');
        } else {
          setMessage({ type: 'success', text: "Contract drafted! Check your email to confirm your account." });
          setMode('signin');
          setPassword('');
          setConfirmPassword('');
        }
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: "Recovery playbook sent! Check your email." });
        setMode('signin');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "An error occurred during authentication." });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = (newMode: AuthMode) => {
    setMode(newMode);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-[#E31837] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Reforço direto via Tailwind: text-white e !text-white para blindar a cor do texto
  const inputClass = "w-full bg-transparent !text-white text-white font-sans text-sm font-bold focus:outline-none transition-all placeholder:text-neutral-700";

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-700">
      
      <div 
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[140px] opacity-30 pointer-events-none z-0"
        style={{ backgroundColor: leagueBlue }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-[140px] opacity-30 pointer-events-none z-0"
        style={{ backgroundColor: leagueRed }}
      />
      
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
      />

      <div className="w-full max-w-md bg-black/70 backdrop-blur-2xl border-t-4 rounded-3xl p-8 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative z-10 transition-all duration-500" style={{ borderTopColor: leagueRed }}>
        
        <div className="text-center mb-10">
          <h1 className="font-jersey text-4xl sm:text-5xl tracking-wider text-white uppercase mb-1 whitespace-nowrap">
            BLITZ<span style={{ color: leagueRed, textShadow: `0 0 15px ${leagueRed}80` }}>PICKS</span>
          </h1>
          <p className="text-gray-400 font-sans text-xs sm:text-sm font-bold uppercase tracking-widest mt-3">
            {mode === 'signin' && 'Enter the Locker Room'}
            {mode === 'signup' && 'Draft Your Account'}
            {mode === 'forgot' && 'Recover Your Playbook'}
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-3 border ${
            message.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
          }`}>
            {message.type === 'error' ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />} 
            <span className="leading-tight">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          
          <div className="bg-black/40 p-4 rounded-xl border border-white/10 overflow-hidden">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Email Address</label>
            <input 
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="qb1@franchise.com" 
              className={inputClass} 
              spellCheck="false"
              autoComplete="email"
              style={{ WebkitTextFillColor: '#ffffff', color: '#ffffff' }}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 relative overflow-hidden">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Password</label>
              <input 
                type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className={`${inputClass} pr-12`} 
                spellCheck="false"
                style={{ WebkitTextFillColor: '#ffffff', color: '#ffffff' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-[34px] text-[9px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors bg-transparent border-none cursor-pointer"
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 overflow-hidden">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Confirm Password</label>
              <input 
                type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                className={inputClass} 
                spellCheck="false"
                style={{ WebkitTextFillColor: '#ffffff', color: '#ffffff' }}
              />
            </div>
          )}

          {mode === 'signin' && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => toggleMode('forgot')} 
                className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"
              >
                <KeyRound size={12} /> Forgot Password?
              </button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={submitting} 
            className="w-full mt-2 font-sport font-bold text-xl uppercase tracking-widest py-4 rounded-xl transition-all shadow-xl hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: leagueRed, color: '#fff', boxShadow: `0 0 20px ${leagueRed}50` }}
          >
            {submitting ? 'PROCESSING...' : (
              <>
                {mode === 'signin' && 'SIGN IN'}
                {mode === 'signup' && 'CREATE ACCOUNT'}
                {mode === 'forgot' && 'SEND RECOVERY LINK'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3 text-center">
          {mode !== 'signin' && (
            <button 
              type="button" 
              onClick={() => toggleMode('signin')} 
              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              ALREADY DRAFTED? SIGN IN
            </button>
          )}
          {mode !== 'signup' && (
            <button 
              type="button" 
              onClick={() => toggleMode('signup')} 
              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              FREE AGENT? CREATE AN ACCOUNT
            </button>
          )}
        </div>
      </div>
    </main>
  );
}