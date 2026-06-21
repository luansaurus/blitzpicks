'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, CheckCircle, AlertCircle } from 'lucide-react'; 
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setIsLoading(false);
      return;
    }

    // Sucesso! Mostra a mensagem e redireciona após 4 segundos
    setMessage({ 
      type: 'success', 
      text: 'Contrato enviado! Verifique seu e-mail para confirmar a assinatura antes de fazer o login.' 
    });
    
    setTimeout(() => {
      router.push('/login');
    }, 4000);
  };

  return (
    <div className="min-h-screen flex bg-nfl-black text-white relative">
      <div className="absolute top-0 left-0 w-full h-2 flex z-50">
        <div className="w-1/3 bg-nfl-blue"></div>
        <div className="w-1/3 bg-white"></div>
        <div className="w-1/3 bg-nfl-red"></div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-nfl-blue flex-col justify-center items-center p-12 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ 
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 60px, rgba(255,255,255,0.7) 60px, rgba(255,255,255,0.7) 62px)',
            backgroundSize: '100% 100%' 
          }}
        >
          <div className="absolute top-1/4 left-8 text-white font-bold text-4xl -rotate-90 opacity-50">50</div>
          <div className="absolute bottom-1/4 left-8 text-white font-bold text-4xl -rotate-90 opacity-50">40</div>
        </div>
        
        <div className="z-10 text-center flex flex-col items-center">
          <div className="w-24 h-32 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-b-full flex items-center justify-center mb-8 shadow-2xl">
            <Trophy size={48} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-4 text-white drop-shadow-lg">
            Pick'em <span className="text-nfl-red">Pro</span>
          </h1>
          <div className="h-1 w-24 bg-nfl-red mb-6"></div>
          <p className="text-nfl-light text-xl max-w-md mx-auto font-medium leading-relaxed">
            Join the league. Track the season. Claim the championship.
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-nfl-black/80 to-transparent mix-blend-multiply pointer-events-none"></div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 z-10 bg-gradient-to-br from-nfl-black to-gray-900">
        <div className="w-full max-w-md space-y-8">
          
          <div className="text-center lg:text-left">
            <h2 className="text-4xl font-extrabold text-white tracking-tight uppercase italic">
              Join the <span className="text-nfl-red">Draft</span>
            </h2>
            <p className="mt-2 text-sm text-nfl-gray uppercase tracking-widest font-semibold">
              Already a player? <Link href="/login" className="text-nfl-blue hover:text-blue-400 transition-colors underline underline-offset-4">Log in to the playbook</Link>
            </p>
          </div>

          <form onSubmit={handleSignUp} className="mt-8 space-y-6">
            
            {/* Box de Mensagem de Sucesso ou Erro */}
            {message && (
              <div className={`p-4 flex items-start gap-3 border-l-4 ${message.type === 'success' ? 'bg-green-900/30 border-green-500 text-green-200' : 'bg-red-900/30 border-red-500 text-red-200'}`}>
                {message.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-nfl-light uppercase tracking-wider">
                  Player Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || message?.type === 'success'}
                  className="mt-2 appearance-none block w-full px-4 py-4 border border-gray-700 bg-black/50 text-white rounded-none border-b-2 border-b-gray-600 focus:outline-none focus:border-b-nfl-red focus:bg-gray-800 transition-all font-medium placeholder:text-gray-600 disabled:opacity-50"
                  placeholder="qb1@franchise.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-nfl-light uppercase tracking-wider">
                  Create Playbook Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || message?.type === 'success'}
                  className="mt-2 appearance-none block w-full px-4 py-4 border border-gray-700 bg-black/50 text-white rounded-none border-b-2 border-b-gray-600 focus:outline-none focus:border-b-nfl-red focus:bg-gray-800 transition-all font-medium placeholder:text-gray-600 disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading || message?.type === 'success'}
                className="group relative w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent text-lg font-black italic uppercase tracking-wider text-white bg-nfl-blue hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900 transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Sign Contract'
                )}
              </button>
            </div>
          </form>
          
        </div>
      </div>
    </div>
  );
}