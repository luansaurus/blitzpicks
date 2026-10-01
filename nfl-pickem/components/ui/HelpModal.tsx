"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  X, Trophy, HelpCircle, ClipboardList, Users, BarChart3, Calendar, Lock,
  Binoculars, Crown, AlertTriangle, Save, Camera, Shirt, ChevronUp, Mail,
  type LucideIcon,
} from 'lucide-react';

export type HelpTabId = 'start' | 'picks' | 'ranking' | 'leagues' | 'season' | 'faq';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pode ser um hex ou uma variável CSS (ex.: "var(--team-accent)"). */
  accentColor: string;
  /** Aba exibida ao abrir. Permite abrir a ajuda já no assunto certo a partir de outra tela. */
  initialTab?: HelpTabId;
}

// Mantenha estes valores iguais aos do app (GameCard, SpyLockerRoom, CreateLeagueModal e regras do banco).
const LOCK_MINUTES = 15;    // palpites fecham X min antes do kickoff
const REVEAL_MINUTES = 10;  // palpites dos outros são revelados X min antes do kickoff
const MAX_LEAGUE_MEMBERS = 10;
const MAX_LEAGUES_OWNED = 3;
const MAX_LEAGUES_OWNED_VIP = 10;

const TABS: { id: HelpTabId; label: string; icon: LucideIcon }[] = [
  { id: 'start', label: 'Get Started', icon: Trophy },
  { id: 'picks', label: 'Making Picks', icon: ClipboardList },
  { id: 'ranking', label: 'Ranking & Spy', icon: BarChart3 },
  { id: 'leagues', label: 'Leagues', icon: Users },
  { id: 'season', label: 'Season & Bracket', icon: Calendar },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

/* ------------------------------------------------------------------ */
/* Peças visuais (declaradas FORA do componente principal de propósito) */
/* ------------------------------------------------------------------ */

function SectionTitle({ icon: Icon, accent, children }: { icon: LucideIcon; accent: string; children: ReactNode }) {
  return (
    <h3 className="font-sport font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2" style={{ color: accent }}>
      <Icon size={16} /> {children}
    </h3>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="font-sans text-xs sm:text-[13px] leading-relaxed text-gray-400 font-medium">{children}</p>;
}

function B({ children }: { children: ReactNode }) {
  return <strong className="text-white font-bold">{children}</strong>;
}

function Block({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function Divider() {
  return <div className="border-t border-white/5" />;
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 font-sans text-xs sm:text-[13px] leading-relaxed text-gray-400 font-medium">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ accent, items }: { accent: string; items: { title: string; text: ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span
            className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full font-jersey text-sm leading-none text-white"
            style={{ border: `1px solid ${accent}` }}
          >
            <span className="absolute inset-0" style={{ backgroundColor: accent, opacity: 0.2 }} />
            <span className="relative pt-0.5">{i + 1}</span>
          </span>
          <div>
            <span className="font-sport font-bold text-xs uppercase tracking-wider text-white">{step.title}</span>
            <div className="mt-0.5"><P>{step.text}</P></div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn'; title: string; children: ReactNode }) {
  const styles = tone === 'warn'
    ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
    : 'border-white/10 bg-white/[0.03] text-gray-300';
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="mb-1 flex items-center gap-2 font-sport font-bold text-[11px] uppercase tracking-wider">
        {tone === 'warn' ? <AlertTriangle size={14} /> : <HelpCircle size={14} />} {title}
      </div>
      <P>{children}</P>
    </div>
  );
}

function PointsCard({ pts, title, text, color, glow }: { pts: string; title: string; text: string; color: string; glow: string }) {
  return (
    <div className="bg-black/60 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center shadow-inner">
      <span className={`font-jersey text-3xl sm:text-4xl mb-1 ${color}`} style={{ textShadow: `0 0 8px ${glow}` }}>{pts}</span>
      <span className="font-sport font-bold text-[11px] uppercase tracking-wider text-white mb-1">{title}</span>
      <span className="font-sans text-[10px] text-gray-500 font-medium leading-snug">{text}</span>
    </div>
  );
}

function ExampleRow({ pick, pts, why, color }: { pick: string; pts: string; why: string; color: string }) {
  return (
    <tr className="border-t border-white/5">
      <td className="px-3 py-2 font-jersey text-lg tracking-wider text-white whitespace-nowrap">{pick}</td>
      <td className={`px-3 py-2 font-jersey text-lg whitespace-nowrap ${color}`}>{pts}</td>
      <td className="px-3 py-2 font-sans text-[11px] text-gray-400 font-medium">{why}</td>
    </tr>
  );
}

function LegendDot({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      <div className="font-sans text-xs sm:text-[13px] leading-relaxed text-gray-400 font-medium">
        <span className="font-bold text-white">{label}</span> {text}
      </div>
    </div>
  );
}

function StatusRow({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-16 shrink-0 font-sans text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</span>
      <span className="font-sans text-xs sm:text-[13px] leading-relaxed text-gray-400 font-medium">{text}</span>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="font-sport font-bold text-xs sm:text-sm tracking-wide text-white">{q}</span>
        <ChevronUp size={16} className="shrink-0 text-gray-500 transition-transform" style={{ transform: open ? 'none' : 'rotate(180deg)' }} />
      </button>
      {open && <div className="border-t border-white/5 px-4 py-3"><P>{children}</P></div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conteúdo de cada aba                                               */
/* ------------------------------------------------------------------ */

function StartTab({ accent }: { accent: string }) {
  return (
    <div className="space-y-6">
      <Block>
        <SectionTitle icon={Trophy} accent={accent}>How the game works</SectionTitle>
        <P>
          Predict the <B>final score of every NFL game</B>. The closer you get, the more points you earn.
          Collect points all season to climb the global ranking and beat your friends in private leagues.
        </P>
        <Steps
          accent={accent}
          items={[
            { title: 'Set up your profile', text: <>Tap your avatar (top right) to choose a nickname and your favorite team. The team&apos;s colors become the theme of the app.</> },
            { title: 'Make your picks', text: <>Open <B>Picks</B> (or your <B>Locker</B>) and type a score for each team in every game you want to predict.</> },
            { title: 'Save', text: <>Picks are only stored when you press the save button in the <B>Unsaved Changes</B> bar.</> },
            { title: 'Earn points', text: <>When a game goes <B>Final</B>, your pick is scored automatically.</> },
            { title: 'Compete', text: <>Follow the <B>Ranking</B>, spy on rivals in the <B>Spy Hub</B>, and create or join a <B>League</B>.</> },
          ]}
        />
      </Block>

      <Divider />

      <Block>
        <SectionTitle icon={Trophy} accent={accent}>Scoring system</SectionTitle>
        <P>Each pick is worth the <B>highest</B> category it qualifies for:</P>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PointsCard pts="7 PTS" title="Exact Score" text="Both scores are exactly right." color="text-green-400" glow="rgba(74,222,128,0.5)" />
          <PointsCard pts="5 PTS" title="Correct Margin" text="Right winner and the exact point difference." color="text-blue-400" glow="rgba(96,165,250,0.5)" />
          <PointsCard pts="3 PTS" title="Correct Winner" text="Right winner, different margin." color="text-amber-400" glow="rgba(251,191,36,0.5)" />
          <PointsCard pts="0 PTS" title="Missed" text="Wrong winner (or no pick)." color="text-red-400" glow="rgba(248,113,113,0.5)" />
        </div>

        <P>Example: the game ends <B>Team A 24 – Team B 20</B> (Team A wins by 4).</P>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
          <table className="w-full text-left">
            <thead>
              <tr className="font-sans text-[9px] font-black uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Your pick (A–B)</th>
                <th className="px-3 py-2">Points</th>
                <th className="px-3 py-2">Why</th>
              </tr>
            </thead>
            <tbody>
              <ExampleRow pick="24 – 20" pts="7" color="text-green-400" why="Exact score." />
              <ExampleRow pick="27 – 23" pts="5" color="text-blue-400" why="Team A wins by 4, just like the real game." />
              <ExampleRow pick="31 – 10" pts="3" color="text-amber-400" why="Team A wins, but by 21 instead of 4." />
              <ExampleRow pick="17 – 21" pts="0" color="text-red-400" why="You picked Team B to win." />
            </tbody>
          </table>
        </div>

        <Callout title="Ties">
          If a game ends in a tie, <B>only the exact score</B> earns points (7). Picking a tie that doesn&apos;t happen,
          or a tie with the wrong score, earns 0.
        </Callout>
        <Callout title="Live games">
          While a game is live you&apos;ll see a projected result marked <B>(Proj)</B>. It can still change until the game is Final.
        </Callout>
        <Callout title="Global vs league points">
          The Picks page and the global Ranking always use <B>7 / 5 / 3</B>. Leagues can define their own values (see the Leagues tab).
        </Callout>
      </Block>
    </div>
  );
}

function PicksTab({ accent }: { accent: string }) {
  return (
    <div className="space-y-6">
      <Block>
        <SectionTitle icon={ClipboardList} accent={accent}>Entering and saving</SectionTitle>
        <Bullets items={[
          <><B>Picks</B> lists every week of the season, with a toggle between Regular Season and Playoffs. Your <B>Locker</B> also shows the current week for quick picks.</>,
          <>Use whole numbers only. Press <B>Enter</B> to jump to the next box.</>,
          <>A card marked <B>Unsaved</B> hasn&apos;t been stored yet. Press the save button in the <B>Unsaved Changes</B> bar to send all your pending picks at once.</>,
          <>You can change a pick as many times as you like until it locks.</>,
          <>Impossible NFL scorelines (for example 1–3 or 1–7) are rejected and the box is cleared with a warning.</>,
        ]} />
      </Block>

      <Divider />

      <Block>
        <SectionTitle icon={Lock} accent={accent}>Deadlines and locking</SectionTitle>
        <P>
          Each game locks <B>{LOCK_MINUTES} minutes before its own kickoff</B>, not all at once. After that you can no longer
          create or edit that pick, so save early.
        </P>
        <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/40 p-4">
          <StatusRow label="Pending" color="text-neutral-400" text="Open. You can still pick." />
          <StatusRow label="Unsaved" color="text-white" text="You typed a score but haven't saved it yet." />
          <StatusRow label="Locked" color="text-red-500" text={`Kickoff is ${LOCK_MINUTES} minutes away or less. Picks are closed.`} />
          <StatusRow label="Live" color="text-red-500" text="The game is in progress. Your projected result appears as (Proj)." />
          <StatusRow label="Final" color="text-green-500" text="The game is over and your points are official." />
        </div>
        <Callout tone="warn" title="Playoff picks">
          Playoff games (Wild Card, Divisional, Conference Championships and the Super Bowl) stay <B>Locked</B> in amber until
          every Week 18 game is Final. Then they open for picks.
        </Callout>
      </Block>

      <Divider />

      <Block>
        <SectionTitle icon={Shirt} accent={accent}>Reading a game card</SectionTitle>
        <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/40 p-4">
          <LegendDot color="bg-green-500" label="Green" text="exact score (7 pts)." />
          <LegendDot color="bg-blue-500" label="Blue" text="correct margin (5 pts)." />
          <LegendDot color="bg-amber-500" label="Amber" text="correct winner (3 pts)." />
          <LegendDot color="bg-red-500" label="Red" text="missed (0 pts)." />
        </div>
        <Bullets items={[
          <>The <B>Pick</B> column is your prediction. <B>Real</B> (or <B>Live</B>) shows the actual score.</>,
          <>Tap <B>View Matchup</B> before kickoff to compare both teams, and <B>View Game Stats</B> after it starts. Betting lines (spread and over/under) appear when available.</>,
          <>Kickoff times are shown in <B>your device&apos;s local time zone</B>.</>,
        ]} />
      </Block>
    </div>
  );
}

function RankingTab({ accent }: { accent: string }) {
  return (
    <div className="space-y-6">
      <Block>
        <SectionTitle icon={BarChart3} accent={accent}>Leaderboard</SectionTitle>
        <P>
          Players are ranked by <B>total points</B> (official points plus projected points from live games).
          When two players are level, ties are broken in this order:
        </P>
        <Steps
          accent={accent}
          items={[
            { title: 'Most exact scores', text: 'Number of 7-point picks.' },
            { title: 'Most correct margins', text: 'Number of 5-point picks.' },
            { title: 'Most global titles', text: 'Past championships.' },
            { title: 'Nickname', text: 'Alphabetical, as the very last resort.' },
          ]}
        />
        <P>Players equal on every criterion share the same rank. Expand any week to see everyone&apos;s picks for each game.</P>
      </Block>

      <Divider />

      <Block>
        <SectionTitle icon={Binoculars} accent={accent}>Spy Hub</SectionTitle>
        <Bullets items={[
          <>Open the <B>Spy Hub</B> tab in Ranking, choose a player, and browse their whole <B>Locker</B>: picks, results and points by week, for the regular season and the playoffs.</>,
          <>Other players&apos; exact scores stay <B>hidden until {REVEAL_MINUTES} minutes before kickoff</B>. Before that you&apos;ll see Locked instead of a score, so nobody can copy a pick.</>,
          <>Your own picks are always visible to you.</>,
        ]} />
      </Block>
    </div>
  );
}

function LeaguesTab({ accent }: { accent: string }) {
  return (
    <div className="space-y-6">
      <Block>
        <SectionTitle icon={Users} accent={accent}>Private competitions</SectionTitle>
        <P>
          A league is a separate ranking just for the people in it. Find it in your <B>Locker</B>, on the <B>Leagues</B> tab.
        </P>
        <Bullets items={[
          <><B>Create:</B> choose a name, decide whether it is public (listed in the Hub for anyone to join) or private (invite only), and set the points for Exact, Margin and Winner. The default is 7 / 5 / 3.</>,
          <><B>Join:</B> pick a public league from the list, or tap Join and type the <B>6-character invite code</B> a friend shared with you.</>,
          <><B>Limits:</B> up to {MAX_LEAGUE_MEMBERS} players per league (shown as x/{MAX_LEAGUE_MEMBERS}). You can create up to {MAX_LEAGUES_OWNED} leagues ({MAX_LEAGUES_OWNED_VIP} for VIP).</>,
          <><B>Invite code:</B> members see it in the league header. Use the eye to reveal it and the copy button to share it.</>,
        ]} />
      </Block>

      <Divider />

      <Block>
        <SectionTitle icon={Crown} accent={accent}>Rules and roles</SectionTitle>
        <Bullets items={[
          <>The league ranking uses <B>the league&apos;s own points</B>. That&apos;s why your league rank can differ from your global rank. Your picks are the same everywhere: you only predict each game once.</>,
          <>Members can leave a league at any time with <B>Leave League</B>.</>,
          <>The owner (crown icon) can <B>edit the name and scoring rules</B>, <B>kick players</B> and <B>delete the league</B>.</>,
          <>Open any player in the league table to see their picks, scored with the league&apos;s rules.</>,
        ]} />
        <Callout tone="warn" title="Changing the rules">
          If the owner edits the scoring values, the league ranking is recalculated with the new values for every game.
        </Callout>
      </Block>
    </div>
  );
}

function SeasonTab({ accent }: { accent: string }) {
  return (
    <div className="space-y-6">
      <Block>
        <SectionTitle icon={Calendar} accent={accent}>Season</SectionTitle>
        <P>The <B>Season</B> page is your NFL reference while you make picks:</P>
        <Bullets items={[
          <><B>Schedule:</B> every game by week, with results, and the playoff rounds in cards or bracket view.</>,
          <><B>Standings:</B> records by conference and division.</>,
          <><B>Stats:</B> team stats and league leaders (passing, rushing, receiving, sacks and kickers).</>,
        ]} />
      </Block>

      <Divider />

      <Block>
        <SectionTitle icon={Trophy} accent={accent}>Playoff bracket</SectionTitle>
        <P>
          The <B>Bracket</B> page is your own playoff predictor, just for fun.
          It is separate from your game picks and <B>does not award points</B>.
        </P>
        <Bullets items={[
          <>Tap a seed slot (1 to 7, in both AFC and NFC) to choose which team holds it.</>,
          <>Then pick the winner of each matchup, round by round, all the way to the Super Bowl.</>,
          <>Use <Save size={12} className="inline -mt-0.5" /> <B>Save</B> to keep your bracket on your account, <Camera size={12} className="inline -mt-0.5" /> to share it as an image, and the reset button to start over.</>,
        ]} />
        <Callout title="Playoff game picks">
          To score points on the actual playoff games, make your picks on the <B>Picks</B> page using the <B>Playoffs</B> toggle.
          They open after Week 18 is complete.
        </Callout>
      </Block>
    </div>
  );
}

function FaqTab() {
  return (
    <div className="space-y-2.5">
      <FaqItem q="Why can't I edit a pick?">
        One of three things: the game starts in {LOCK_MINUTES} minutes or less, it is already live or final, or it is a playoff
        game and Week 18 isn&apos;t finished yet.
      </FaqItem>
      <FaqItem q="It says “Sync Failed” when I save. What now?">
        Check your connection and press save again. If it keeps failing, a game in your batch may have just locked.
        Refresh the page and re-enter the picks that are still open.
      </FaqItem>
      <FaqItem q="Why did my points change during a game?">
        Live results are projections (marked Proj) based on the current score. Points become official when the game is Final.
      </FaqItem>
      <FaqItem q="Why can't I see other players' scores?">
        They are revealed {REVEAL_MINUTES} minutes before kickoff so nobody can copy someone else&apos;s pick. After that they stay visible.
      </FaqItem>
      <FaqItem q="What happens if a game ends in a tie?">
        Only an exact tie score earns points (7). Any other pick earns 0.
      </FaqItem>
      <FaqItem q="What time zone are the kickoff times in?">
        Your device&apos;s local time zone, so the times may differ from the TV schedule shown elsewhere.
      </FaqItem>
      <FaqItem q="Why is my league rank different from my global rank?">
        Leagues only include their members and can use custom points for Exact, Margin and Winner.
        The global ranking always uses 7 / 5 / 3.
      </FaqItem>
      <FaqItem q="Can I change my nickname or favorite team?">
        Yes. Tap your avatar at the top right. Nicknames must be unique, and the new team colors apply right away.
      </FaqItem>
      <FaqItem q="Does the bracket give points?">
        No. The bracket is a personal predictor. Points come only from your game picks.
      </FaqItem>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */

export default function HelpModal({ isOpen, onClose, accentColor, initialTab = 'start' }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<HelpTabId>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Cada vez que abre, volta para a aba inicial.
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  // ESC fecha, trava o scroll da página e leva o foco para o diálogo.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // Ao trocar de aba, volta ao topo do conteúdo.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        className="bg-[#050505]/95 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col max-h-[88vh] relative outline-none"
      >
        {/* Fundo com textura */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />

        {/* Cabeçalho */}
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-white/10 bg-black/60 relative z-10 shadow-inner">
          <div className="flex items-center gap-3">
            <HelpCircle size={24} style={{ color: accentColor }} />
            <h2 id="help-title" className="font-jersey text-2xl sm:text-3xl uppercase tracking-widest text-white drop-shadow-md">
              HOW TO PLAY & RULES
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="text-gray-400 hover:text-white p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas */}
        {/* Adicionado o selector [&::-webkit-scrollbar]:hidden para esconder a barra horizontal e manter a funcionalidade */}
        <div role="tablist" aria-label="Help topics" className="flex gap-2 overflow-x-auto px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40 relative z-10 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(id)}
                className={`relative shrink-0 flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 font-sport font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-colors ${
                  isActive ? 'text-white' : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
                style={isActive ? { borderColor: accentColor } : undefined}
              >
                {isActive && <span className="absolute inset-0" style={{ backgroundColor: accentColor, opacity: 0.18 }} />}
                <span className="relative flex items-center gap-2">
                  <Icon size={14} style={isActive ? { color: accentColor } : undefined} /> {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo (com scroll interno) */}
        <div ref={contentRef} role="tabpanel" className="p-5 sm:p-6 overflow-y-auto text-gray-300 relative z-10 custom-scrollbar">
          {activeTab === 'start' && <StartTab accent={accentColor} />}
          {activeTab === 'picks' && <PicksTab accent={accentColor} />}
          {activeTab === 'ranking' && <RankingTab accent={accentColor} />}
          {activeTab === 'leagues' && <LeaguesTab accent={accentColor} />}
          {activeTab === 'season' && <SeasonTab accent={accentColor} />}
          {activeTab === 'faq' && <FaqTab />}
        </div>

        {/* Rodapé - Agora com o contato de suporte à esquerda */}
        <div className="p-4 pb-6 sm:pb-5 sm:p-5 border-t border-white/10 bg-black/60 flex items-center justify-between gap-2 relative z-10 shadow-inner">
          <a 
            href="mailto:blitzpicks6@gmail.com" 
            className="flex items-center gap-2 sm:gap-3 text-gray-400 hover:text-white transition-colors group overflow-hidden"
          >
            <div className="bg-white/5 group-hover:bg-white/10 p-1.5 sm:p-2 rounded-full border border-white/5 transition-colors shrink-0">
              <Mail size={14} className="sm:w-4 sm:h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-sport font-bold text-[9px] sm:text-[10px] uppercase tracking-wider leading-none mb-1 truncate">Found a bug?</span>
              <span className="font-sans text-[9px] sm:text-[10px] text-gray-400 sm:text-gray-500 font-medium leading-none truncate">blitzpicks6@gmail.com</span>
            </div>
          </a>
          
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-sport font-bold text-xs sm:text-sm uppercase tracking-wider text-black transition-all shadow-xl hover:scale-105 shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}