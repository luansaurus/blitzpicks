"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      // Verifica instantaneamente se existe uma sessão ativa
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Se estiver logado, vai para o Locker Room
        router.push('/dashboard');
      } else {
        // Se não tiver sessão, manda para a bilheteria (Login)
        router.push('/login');
      }
    }

    checkAuth();
  }, [router, supabase]);

  // Enquanto ele checa (leva milissegundos), mostramos um loading premium
  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/10 border-t-red-600 rounded-full animate-spin"></div>
    </main>
  );
}