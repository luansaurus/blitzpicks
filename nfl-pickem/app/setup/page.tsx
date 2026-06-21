"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';

// O mesmo Motor HSL do Header para garantir contraste e vivacidade
const getSafeColor = (hex: string) => {
  if (!hex) return '#E31837'; // Padrão NFL Red

  let r = parseInt(hex.substring(1, 3), 16) / 255;
  let g = parseInt(hex.substring(3, 5), 16) / 255;
  let b = parseInt(hex.substring(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

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

  if (l < 0.45) {
    l = 0.55; 
    s = Math.max(s, 0.90); 
  }

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
        setTeams(teamsData);
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
    
    if (!nickname) {
      alert("Please enter a nickname.");
      return;
    }

    setSaving(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        alert("Session error. Please log in again.");
        router.push('/login');
        return;
      }

      const updateData: any = { 
        id: session.user.id,
        nickname: nickname,
        favorite_team_id: selectedTeamId
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updateData);

      if (updateError) {
        alert(`Failed to update profile: ${updateError.message}`);
        setSaving(false);
        return;
      }

      // Atualiza a cor global no localStorage se a pessoa trocou de time
      const chosenTeam = teams.find(t => t.id === selectedTeamId);
      const newColor = chosenTeam ? getSafeColor(chosenTeam.primary_color) : '#E31837';
      localStorage.setItem('blitz_accent', newColor);
      document.documentElement.style.setProperty('--team-accent', newColor);

      router.push('/dashboard');
      
    } catch (catchError) {
      console.error("💥 [Setup] Unexpected crash in handleSaveProfile:", catchError);
      alert("An unexpected error occurred. Check your browser console.");
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
  // Aplica a função getSafeColor na cor selecionada para renderizar na tela
  const rawColor = selectedTeamData?.primary_color || '#E31837';
  const themeColor = getSafeColor(rawColor);

  const nflDefaultOption = {
    id: null,
    name: 'No Team',
    abbreviation: 'NFL',
    primary_color: '#E31837',
    logo_url: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg'
  };

  const displayOptions = [nflDefaultOption, ...teams];

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        
        <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
          <span className="text-[120px] font-black italic">DRAFT</span>
        </div>

        <div className="text-center mb-10 relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white uppercase">
            Sign <span className="transition-colors duration-500" style={{ color: themeColor }}>Contract</span>
          </h1>
          <p className="text-gray-400 mt-2 font-medium text-sm sm:text-base">
            Customize o seu perfil de jogador antes de entrar no campo.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-8 relative z-10">
          
          <div>
            <label className="block text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">
              Player Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-1 transition font-bold text-lg shadow-inner"
              // Remova o focusBorderColor e use propriedades CSS padrão do React!
              style={{ outlineColor: themeColor, '--tw-ring-color': themeColor } as React.CSSProperties}
              placeholder="Digite seu nickname..."
              required
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 flex justify-between">
              <span>Select Franchise</span>
              <span className="text-gray-600 text-[10px]">OPTIONAL</span>
            </label>
            
            <div className="-m-3 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {displayOptions.map((team) => {
                const isSelected = selectedTeamId === team.id;
                // Deixa a borda do card do time selecionado vibrante também
                const cardBorderColor = isSelected ? getSafeColor(team.primary_color || '#E31837') : '';

                return (
                  <div
                    key={team.id || 'nfl-default'}
                    onClick={() => setSelectedTeamId(team.id)} 
                    className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-all duration-300 ${
                      isSelected 
                        ? 'bg-white/10 shadow-lg scale-105 z-10' 
                        : 'bg-black/50 border-white/5 hover:border-white/20 opacity-70 hover:opacity-100 z-0'
                    }`}
                    style={{ borderColor: cardBorderColor }}
                  >
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.abbreviation} className="w-10 h-10 object-contain" />
                    ) : (
                      <div className="w-10 h-10 bg-white/5 rounded-full" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-center text-white">
                      {team.abbreviation || team.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !nickname}
            className="w-full text-white font-black py-4 sm:py-5 rounded-xl uppercase tracking-widest transition shadow-lg disabled:opacity-50 mt-4 text-sm sm:text-base hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            {saving ? "Signing..." : "Enter Locker Room"}
          </button>
        </form>
      </div>
    </main>
  );
}