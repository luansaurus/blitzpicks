import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '../lib/types';

export function useProfile(requireAuth = true) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (requireAuth) router.push('/login');
        else setLoadingProfile(false);
        return;
      }
      
      setUserId(session.user.id);
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (data) setProfile(data);
      setLoadingProfile(false);
    }

    loadProfile();
  }, [supabase, router, requireAuth]);

  return { profile, userId, loadingProfile, setProfile };
}