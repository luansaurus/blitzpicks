"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { Shirt, ClipboardList, Trophy, BarChart3, Calendar, Settings, type LucideIcon } from 'lucide-react';

const getSafeColor = (hex: string) => {
  if (!hex) return '#f59e0b';
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
  if (l < 0.45) { l = 0.55; s = Math.max(s, 0.90); }
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
  r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  const toHex = (x: number) => {
    const hexStr = Math.round(x * 255).toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [logoUrl, setLogoUrl] = useState<string>('https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isVip, setIsVip] = useState<boolean>(false);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Adicionado 'is_vip' na busca
      const { data: profile } = await supabase
        .from('profiles')
        .select('favorite_team_id, is_admin, is_vip')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setIsAdmin(!!profile.is_admin);
        setIsVip(!!profile.is_vip);
        
        if (profile.favorite_team_id) {
          const { data: team } = await supabase.from('teams').select('logo_url, primary_color').eq('id', profile.favorite_team_id).single();
          if (team) {
            if (team.logo_url) setLogoUrl(team.logo_url);
            if (team.primary_color) {
              const vibrantSafeColor = getSafeColor(team.primary_color);
              localStorage.setItem('blitz_accent', vibrantSafeColor);
              document.documentElement.style.setProperty('--team-accent', vibrantSafeColor);
            }
          }
        } else {
           localStorage.setItem('blitz_accent', '#f59e0b');
           document.documentElement.style.setProperty('--team-accent', '#f59e0b');
        }
      }
    }
    fetchUserData();
  }, [supabase]);

  const handleLogout = async () => {
    if (loadingLogout) return;
    setLoadingLogout(true);
    
    try {
      await supabase.auth.signOut();
      router.refresh();
      router.push('/login');
    } catch (error) {
      console.error("Erro ao efetuar logout:", error);
    } finally {
      setLoadingLogout(false);
    }
  };

const navLinks: { name: string; path: string; icon: LucideIcon }[] = [
    { name: 'Locker', path: '/dashboard', icon: Shirt },
    { name: 'Picks', path: '/picks', icon: ClipboardList },
    { name: 'Bracket', path: '/bracket', icon: Trophy },
    { name: 'Ranking', path: '/ranking', icon: BarChart3 },
    { name: 'Season', path: '/results', icon: Calendar }
  ];

  return (
    <>
      <header className="bg-neutral-950 border-b border-white/10 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-1 hover:opacity-80 transition">
            <span className="text-xl font-black italic uppercase tracking-tighter text-white">
              Blitz<span style={{ color: 'var(--team-accent)' }}>Picks</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
              return (
                <Link key={link.path} href={link.path} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`} style={isActive ? { color: 'var(--team-accent)' } : {}}>
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Botões de Acesso Especial com ícones para mobile */}
            
            {isAdmin && (
              <Link href="/admin" className="text-red-400 hover:text-yellow-300 transition-colors drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Admin</span>
                <span className="sm:hidden text-lg"><Settings size={18} /></span>
              </Link>
            )}
            
            <Link href="/setup" title="Profile" className="hover:scale-105 transition-transform flex items-center gap-2">
              <span className="hidden md:inline-block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profile</span>
              <div className="w-8 h-8 rounded-full border-2 bg-black flex items-center justify-center overflow-hidden shadow-lg p-0.5" style={{ borderColor: 'var(--team-accent)' }}>
                <img src={logoUrl} alt="User Logo" className="w-full h-full object-contain" />
              </div>
            </Link>
            
            <button 
              onClick={handleLogout} 
              disabled={loadingLogout}
              className="text-[10px] font-bold text-gray-500 hover:text-red-400 uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {loadingLogout ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-neutral-950/95 backdrop-blur-md border-t border-white/10 z-50 px-2 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
            const Icon = link.icon;
            return (
              <Link key={link.path} href={link.path} className="flex flex-col items-center justify-center w-full h-full gap-1" style={isActive ? { color: 'var(--team-accent)' } : { color: '#737373' }}>
                <Icon size={20} className={`transition-transform ${isActive ? 'scale-110 drop-shadow-md' : 'opacity-60'}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>{link.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}