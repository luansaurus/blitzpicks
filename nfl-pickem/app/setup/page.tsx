"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '@/utils/theme';

const getSafeColor = (hex: string, teamName?: string) => {
  if (!hex) return '#E31837';

  // 1. Evita que tons cinzas/pratas percam a neutralidade e virem rosa
  const isGreyish = (h: string) => {
    const r = parseInt(h.substring(1, 3), 16);
    const g = parseInt(h.substring(3, 5), 16);
    const b = parseInt(h.substring(5, 7), 16);
    return Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
  };

  if (isGreyish(hex)) return hex;

  // 2. Trava de segurança para garantir o Prata Clássico do Raiders
  if (teamName?.toLowerCase().includes('raiders')) return '#C0C0C0';

  let r = parseInt(hex.substring(1, 3), 16) / 255;
  let g = parseInt(hex.substring(3, 5), 16) / 255;
  let b = parseInt(hex.substring(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Ajusta o brilho de times escuros (Eagles, Patriots) mantendo o tom original intacto
  if (l < 0.35) l = 0.5;
  if (s < 0.3) s = 0.6;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1/3);
  g = hue2rgb(p, q, h);
  b = hue2rgb(p, q, h - 1/3);

  const toHex = (x: number) => {
    const hexStr = Math.round(x * 255).toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export default function SetupPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [nickname, setNickname] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuthAndLoadData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      if (teamsError) {
        console.error('Erro ao buscar os times:', teamsError);
      } else if (teamsData) {
        const teamsList = teamsData || [];
        const freeAgent = teamsList.find(t => t.abbreviation === 'TBD');
        const others = teamsList.filter(t => t.abbreviation !== 'TBD');
        const finalList = freeAgent 
          ? [{ ...freeAgent, name: 'Free Agent' }, ...others] 
          : others;

        setTeams(finalList);
      }
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('nickname, favorite_team_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao buscar o perfil:', profileError);
      } else if (profileData) {
        if (profileData.nickname) setNickname(profileData.nickname);
        if (profileData.favorite_team_id !== undefined) setSelectedTeamId(profileData.favorite_team_id);
      }

      setLoading(false);
    }

    checkAuthAndLoadData();
  }, [router, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const updateData: any = { 
        id: session.user.id,
        nickname: nickname,
        favorite_team_id: selectedTeamId
      };

      const { error: updateError } = await supabase.from('profiles').upsert(updateData);
      if (updateError) throw updateError;

      const chosenTeam = teams.find(t => t.id === selectedTeamId);
      const newColor = chosenTeam ? getSafeColor(chosenTeam.primary_color, chosenTeam.name) : '#E31837';
      localStorage.setItem('blitz_accent', newColor);
      document.documentElement.style.setProperty('--team-accent', newColor);

      router.push('/dashboard');
    } catch (catchError) {
      console.error(catchError);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-red-600 rounded-full animate-spin"></div>
      </main>
    );
  }

  const selectedTeamData = teams.find(t => t.id === selectedTeamId);
  const rawColor = selectedTeamData?.primary_color || '#E31837';
  const themeColor = getSafeColor(rawColor, selectedTeamData?.name);

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white uppercase">
            Sign <span style={{ color: themeColor }}>Contract</span>
          </h1>
          <p className="text-gray-400 mt-2 font-medium text-sm sm:text-base">Customize your profile before entering the field.</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-8">
          <div>
            <label className="block text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Player Nickname</label>
            <input
              type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-1 transition font-bold text-lg"
              style={{ outlineColor: themeColor, '--tw-ring-color': themeColor } as React.CSSProperties}
              placeholder="Your nickname..." required
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 flex justify-between">
              <span>Select Franchise</span>
              <span className="text-gray-600 text-[10px]">OPTIONAL</span>
            </label>
            <div className="-m-3 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {teams.map((team) => {
                const isSelected = selectedTeamId === team.id;
                const displayName = team.abbreviation === 'TBD' ? 'Free Agent' : team.abbreviation;
                const cardBorderColor = isSelected ? getSafeColor(team.primary_color || '#E31837', team.name) : 'transparent';

                return (
                  <div
                    key={team.id} onClick={() => setSelectedTeamId(team.id)} 
                    className={`cursor-pointer border rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isSelected ? 'bg-white/10 shadow-lg scale-105 z-10' : 'bg-black/40 border-white/5 hover:border-white/10 opacity-80'}`}
                    style={{ borderColor: cardBorderColor }}
                  >
                    {team.logo_url ? <img src={team.logo_url} alt="" className="w-8 h-8 object-contain" /> : <div className="w-8 h-8 bg-white/5 rounded-full" />}
                    <span className="text-[9px] font-black uppercase tracking-widest text-center text-white truncate w-full">{displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit" disabled={saving || !nickname}
            className="w-full text-white font-black py-4 sm:py-5 rounded-xl uppercase tracking-widest transition shadow-lg disabled:opacity-50 text-sm sm:text-base"
            style={{ backgroundColor: themeColor }}
          >
            {saving ? "Signing..." : "Enter Locker Room"}
          </button>
        </form>
      </div>
    </main>
  );
}