"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shirt, ClipboardList, Trophy, BarChart3, Calendar, Settings, HelpCircle, type LucideIcon } from 'lucide-react';
import HelpModal from '../ui/HelpModal'; 
import { getSafeColor, getIsLight } from '@/lib/color';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Flag para controlar a Hidratação do React (evita o erro Mismatch)
  const [isMounted, setIsMounted] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string>('https://a.espncdn.com/i/teamlogos/nfl/500/nfl.png');
  const [headerBg, setHeaderBg] = useState<string>('#0a0a0a');
  const [headerSec, setHeaderSec] = useState<string>('#ff2a2a');
  const [isLightBg, setIsLightBg] = useState<boolean>(false);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  
  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
    
    // Leitura segura do localStorage apenas após o componente montar
    const savedLogo = localStorage.getItem('blitz_logo_url');
    const savedBg = localStorage.getItem('blitz_header_bg');
    const savedSec = localStorage.getItem('blitz_header_sec');
    
    if (savedLogo) setLogoUrl(savedLogo);
    if (savedBg) {
      setHeaderBg(savedBg);
      setIsLightBg(getIsLight(savedBg));
    }
    if (savedSec) setHeaderSec(savedSec);

    async function fetchUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('favorite_team_id, is_admin')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setIsAdmin(!!profile.is_admin);
        
        if (profile.favorite_team_id) {
          const { data: team } = await supabase.from('teams').select('logo_url, primary_color, secondary_color').eq('id', profile.favorite_team_id).single();
          if (team) {
            if (team.logo_url) {
              setLogoUrl(team.logo_url);
              localStorage.setItem('blitz_logo_url', team.logo_url);
            }
            
            if (team.primary_color) {
              setHeaderBg(team.primary_color);
              setIsLightBg(getIsLight(team.primary_color));
              localStorage.setItem('blitz_header_bg', team.primary_color);
              
              const vibrantSafeColor = getSafeColor(team.primary_color);
              localStorage.setItem('blitz_accent', vibrantSafeColor);
              document.documentElement.style.setProperty('--team-accent', vibrantSafeColor);
            }
            
            if (team.secondary_color) {
              setHeaderSec(team.secondary_color);
              localStorage.setItem('blitz_header_sec', team.secondary_color);
              document.documentElement.style.setProperty('--team-secondary', team.secondary_color);
            }
          }
        } else {
           localStorage.setItem('blitz_accent', '#ff2a2a');
           document.documentElement.style.setProperty('--team-accent', '#ff2a2a');
           document.documentElement.style.setProperty('--team-secondary', '#ffffff');
        }
      }
    }
    
    fetchUserData();
    
    const handleTeamSaved = () => fetchUserData();
    
    const handleTeamPreview = (e: any) => {
      const detail = e.detail;
      if (detail?.primary_color) {
        setHeaderBg(detail.primary_color);
        setIsLightBg(getIsLight(detail.primary_color));
      } else {
        setHeaderBg('#0a0a0a');
      }
      setHeaderSec(detail?.secondary_color || '#ff2a2a');
    };

    window.addEventListener('team-updated', handleTeamSaved);
    window.addEventListener('preview-team', handleTeamPreview);
    
    return () => {
      window.removeEventListener('team-updated', handleTeamSaved);
      window.removeEventListener('preview-team', handleTeamPreview);
    };
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

  const textMain = isLightBg ? 'text-black' : 'text-white';
  const textMuted = isLightBg ? 'text-neutral-800' : 'text-neutral-400';
  const hoverColor = isLightBg ? 'hover:text-black hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]' : 'hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]';
  const groupHoverColor = isLightBg ? 'group-hover:text-black' : 'group-hover:text-white';
  const textureColor = isLightBg ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  return (
    <>
      <header 
        className="border-b-4 relative z-40 transition-colors duration-500" 
        style={isMounted ? { backgroundColor: headerBg, borderBottomColor: headerSec } : { backgroundColor: '#0a0a0a', borderBottomColor: '#ff2a2a' }}
      >
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={isMounted ? { backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, ${textureColor} 4px, ${textureColor} 8px)` } : {}}
        />

        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between relative z-10">
          
          <Link href="/dashboard" className="flex items-center gap-1 hover:opacity-90 transition-opacity">
            <span className={`font-jersey text-3xl sm:text-4xl uppercase tracking-widest pt-1 ${isMounted ? textMain : 'text-white'}`}>
              BLITZ
              <span 
                style={isMounted ? { color: headerSec, textShadow: isLightBg ? 'none' : `0 0 15px ${headerSec}80` } : { color: '#ff2a2a' }}
              >
                PICKS
              </span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center h-full">
            {navLinks.map((link) => {
              const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
              return (
                <Link 
                  key={link.path} 
                  href={link.path} 
                  className="relative h-full flex items-center px-5 group overflow-hidden"
                >
                  <span className={`relative z-10 text-[14px] font-black uppercase tracking-widest transition-colors ${isActive ? (isMounted ? textMain : 'text-white') : (isMounted ? textMuted : 'text-gray-400')} ${isMounted ? groupHoverColor : 'hover:text-white'}`}>
                    {link.name}
                  </span>
                  
                  {isActive && (
                    <span 
                      className="absolute bottom-0 left-0 w-full h-[5px] origin-bottom-left -skew-x-12 z-20"
                      style={isMounted ? { backgroundColor: headerSec } : { backgroundColor: '#ff2a2a' }} 
                    />
                  )}
                  
                  <span className={`absolute bottom-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity ${isMounted && isLightBg ? 'bg-black/5' : 'bg-white/10'}`} />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 sm:gap-6 h-full">
            <button 
              onClick={() => setIsHelpOpen(true)}
              title="Help & Rules"
              className={`${isMounted ? textMuted : 'text-gray-400'} ${isMounted ? hoverColor : 'hover:text-white'} transition-all duration-300 flex items-center gap-1.5`}
            >
              <HelpCircle size={22} />
              <span className="hidden md:inline text-[13px] font-black uppercase tracking-widest">HELP</span>
            </button>

            {isAdmin && (
              <Link href="/admin" className={`text-neutral-500 ${isMounted ? hoverColor : 'hover:text-white'} transition-colors flex items-center gap-1`}>
                <Settings size={20} />
                <span className="hidden sm:inline text-[13px] font-black uppercase tracking-widest">ADMIN</span>
              </Link>
            )}
            
            <div className={`w-[2px] h-6 hidden sm:block -skew-x-12 ${isMounted && isLightBg ? 'bg-black/20' : 'bg-white/20'}`}></div>

            <Link href="/setup" title="Profile" className="relative flex items-center justify-center group hover:scale-105 transition-transform">
              <div 
                className={`w-10 h-10 rounded-sm bg-[#111] flex items-center justify-center overflow-hidden p-1 border transition-colors`}
                style={isMounted ? { borderColor: isLightBg ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)' } : { borderColor: 'rgba(255,255,255,0.2)' }}
              >
                {isMounted ? <img src={logoUrl} alt="User Logo" className="w-full h-full object-contain" /> : <div className="w-full h-full bg-white/5" />}
              </div>
            </Link>
            
            <button 
              onClick={handleLogout} 
              disabled={loadingLogout}
              className={`hidden sm:block text-[13px] font-black ${isMounted ? textMuted : 'text-gray-400'} ${isMounted ? hoverColor : 'hover:text-white'} uppercase tracking-widest transition-all disabled:opacity-50`}
            >
              {loadingLogout ? 'WAIT...' : 'SIGN OUT'}
            </button>
          </div>
        </div>
      </header>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 z-50 px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="flex justify-around items-center h-16 relative">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.path} 
                href={link.path} 
                className="relative flex flex-col items-center justify-center w-full h-full gap-1 pt-1" 
                style={isActive ? { color: 'white' } : { color: '#666' }}
              >
                {isActive && (
                  <div 
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[3px] rounded-b-sm" 
                    style={isMounted ? { backgroundColor: headerSec } : { backgroundColor: '#ff2a2a' }} 
                  />
                )}
                
                <Icon size={22} className={`transition-transform ${isActive ? 'scale-110' : ''}`} style={isMounted && isActive ? { color: headerSec } : {}} />
                
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {link.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        accentColor={isMounted ? "var(--team-accent)" : "#ff2a2a"} 
      />
    </>
  );
}