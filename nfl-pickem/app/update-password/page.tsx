"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const leagueBlue = '#013369';
  const leagueRed = '#E31837';

  useEffect(() => {
    // Verifica se o usuário tem uma sessão válida (o link do e-mail cria uma sessão temporária)
    async function checkSession() {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // Se não tiver sessão (link expirado ou acessado direto), manda pro login
        router.push('/login');
        return;
      }
      setLoading(false);
    }
    checkSession();
  }, [router, supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords do not match." });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: "Password must be at least 6 characters." });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage({ type: 'success', text: "Playbook updated! Redirecting to Locker Room..." });
      
      // Aguarda 2 segundos para o usuário ler a mensagem de sucesso e redireciona
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Failed to update password." });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-[#E31837] rounded-full animate-spin"></div>
      </div>
    );
  }

  // A mesma classe blindada da tela de login
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
          <div className="mx-auto w-16 h-16 bg-black/80 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl mb-4" style={{ boxShadow: `0 0 25px ${leagueBlue}50` }}>
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="font-jersey text-4xl sm:text-5xl tracking-wider text-white uppercase mb-1 whitespace-nowrap">
            NEW <span style={{ color: leagueRed, textShadow: `0 0 15px ${leagueRed}80` }}>PLAYBOOK</span>
          </h1>
          <p className="text-gray-400 font-sans text-xs sm:text-sm font-bold uppercase tracking-widest mt-3">
            Set your new password
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

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          
          <div className="bg-black/40 p-4 rounded-xl border border-white/10 relative overflow-hidden">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">New Password</label>
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

          <div className="bg-black/40 p-4 rounded-xl border border-white/10 overflow-hidden">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Confirm New Password</label>
            <input 
              type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••" 
              className={inputClass} 
              spellCheck="false"
              style={{ WebkitTextFillColor: '#ffffff', color: '#ffffff' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting || message?.type === 'success'} 
            className="w-full mt-2 font-sport font-bold text-xl uppercase tracking-widest py-4 rounded-xl transition-all shadow-xl hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: leagueRed, color: '#fff', boxShadow: `0 0 20px ${leagueRed}50` }}
          >
            {submitting ? 'UPDATING...' : (
              <>
                UPDATE PLAYBOOK
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

      </div>
    </main>
  );
}