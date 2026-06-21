"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import { Trophy, ArrowRight } from 'lucide-react';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function SetupPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nickname, setNickname] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // BUSCA TIMES E FILTRA O TBD
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .not('abbreviation', 'eq', 'TBD')
        .order('name', { ascending: true });
        
      // FILTRO AQUI: Remove o time com abreviação TBD
      const filteredTeams = teamsData?.filter(t => t.abbreviation !== 'TBD') || [];
      setTeams(filteredTeams);

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, favorite_team_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        if (profile.nickname) setNickname(profile.nickname);
        if (profile.favorite_team_id) setSelectedTeamId(profile.favorite_team_id);
      }
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const themeColor = selectedTeam ? getThemeColor(selectedTeam.primary_color) : '#E31837';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !selectedTeamId) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').upsert({
      id: user?.id, nickname, favorite_team_id: selectedTeamId
    });

    if (error) { alert("Error saving profile"); setSaving(false); return; }

    localStorage.setItem('blitz_accent', themeColor);
    document.documentElement.style.setProperty('--team-accent', themeColor);
    router.push('/dashboard');
  };

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4" style={{ '--team-accent': themeColor } as React.CSSProperties}>
      <div className="w-full max-w-4xl z-10 space-y-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-6">
            <Trophy size={32} />
          </div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter">
            Draft <span style={{ color: 'var(--team-accent)' }}>Day</span>
          </h1>
        </div>

        <form onSubmit={handleSave} className="space-y-12">
          <div className="bg-neutral-900/50 p-8 border-l-4" style={{ borderLeftColor: 'var(--team-accent)' }}>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">1. Nickname</label>
            <input 
              value={nickname} onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-black/60 text-white text-2xl font-bold px-4 py-4 border-b-2 focus:outline-none"
              style={{ borderBottomColor: nickname ? 'var(--team-accent)' : '#4B5563' }}
              placeholder="Ex: QB_Legend99" required
            />
          </div>

          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider mb-6 text-center">2. Choose Franchise</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 bg-neutral-900/30 p-6 rounded-xl border border-white/5">
  {teams.map((team) => (
    <button
      key={team.id}
      type="button"
      onClick={() => setSelectedTeamId(team.id)}
      className={`relative aspect-square p-2 rounded-lg transition-all ${selectedTeamId === team.id ? 'bg-white/10 scale-110 border-2' : 'hover:bg-white/5 grayscale hover:grayscale-0'}`}
      style={{ borderColor: selectedTeamId === team.id ? team.primary_color : 'transparent' }}
    >
      <img src={team.logo_url} alt={team.name} className="w-full h-full object-contain" />
    </button>
  ))}
</div>
          </div>

          <div className="flex justify-center">
            <button type="submit" disabled={saving || !nickname || !selectedTeamId}
              className="flex items-center gap-3 px-12 py-5 text-xl font-black italic uppercase tracking-wider text-black disabled:opacity-50"
              style={{ backgroundColor: 'var(--team-accent)' }}>
              {saving ? 'Processing...' : 'Confirm Pick'} <ArrowRight />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}