"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTelegramBack } from "@/hooks/useTelegramBack";
import BottomNav from "@/components/BottomNav";
import WalletGuard from "@/components/WalletGuard";
import PageLoader, { useMinLoader } from "@/components/PageLoader";
import { useWalletStore } from "@/hooks/useStore";
import { ALL_CLUBS } from "@/config/afl";
import { TIERS, getTierForBalance } from "@/config/tiers";
import { PRIMARY_CUSTOM_ASSET_LABEL } from "@/lib/constants";
import { getTelegramInitData, buildReferralLink, shareReferralLink } from "@/lib/telegram";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";
import ErrorCard from "@/components/ErrorCard";

function formatBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function TierPill({ tierId }: { tierId: string }) {
  const tier = TIERS.find((t) => t.id === tierId) ?? TIERS[0];
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
      style={{ color: tier.color, borderColor: `${tier.color}40`, background: `${tier.color}15` }}
    >
      {tier.label}
    </span>
  );
}

function TeamLogo({ teamId, size = 20 }: { teamId: string | null; size?: number }) {
  if (!teamId) return <div style={{ width: size, height: size }} className="flex-shrink-0" />;
  const club = ALL_CLUBS.find((c) => c.id === teamId);
  if (!club) return <div style={{ width: size, height: size }} className="flex-shrink-0" />;
  if (club.logo) {
    return (
      <img src={club.logo} alt={club.shortName} width={size} height={size}
        className="object-contain flex-shrink-0" loading="lazy" />
    );
  }
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, background: club.color, fontSize: size * 0.35 }}
    >
      {club.shortName.slice(0, 2)}
    </div>
  );
}

// ── Podium ────────────────────────────────────────────────────────────────────
function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const first  = entries[0];
  const second = entries[1];
  const third  = entries[2];

  const PodiumSlot = ({
    entry, height, emoji, labelColor, isCenter,
  }: {
    entry: LeaderboardEntry | undefined;
    height: string;
    emoji: string;
    labelColor: string;
    isCenter?: boolean;
  }) => {
    if (!entry) return <div className="flex-1" />;
    return (
      <div className={`flex-1 flex flex-col items-center gap-1 ${isCenter ? '-mt-4' : 'mt-2'}`}>
        {isCenter && (
          <span className="material-symbols-outlined text-[#D4AF37] text-base animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
            crown
          </span>
        )}
        <TeamLogo teamId={entry.favoriteTeam} size={isCenter ? 28 : 22} />
        <p className={`text-[10px] font-bold truncate w-full text-center px-1 ${labelColor}`}>
          {entry.displayName}
        </p>
        <TierPill tierId={entry.tierId} />
        <p className={`text-[11px] font-black ${labelColor}`}>{formatBalance(entry.balance)}</p>
        {/* Bar */}
        <div
          className="w-full rounded-t-xl flex items-center justify-center text-xl"
          style={{
            height,
            background: isCenter
              ? 'linear-gradient(180deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))'
              : 'rgba(255,255,255,0.05)',
            border: isCenter ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
            borderBottom: 'none',
          }}
        >
          {emoji}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card px-4 pt-4 pb-0 rounded-xl border border-[#D4AF37]/10 overflow-hidden">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center mb-3">Top Holders</p>
      <div className="flex items-end gap-2">
        <PodiumSlot entry={second} height="56px" emoji="🥈" labelColor="text-gray-300" />
        <PodiumSlot entry={first}  height="80px" emoji="🥇" labelColor="text-[#D4AF37]" isCenter />
        <PodiumSlot entry={third}  height="40px" emoji="🥉" labelColor="text-amber-600" />
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function LeaderRow({
  entry, isCurrentUser, nextEntry, tokenBalance, copiedAddr, onCopy,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  nextEntry: LeaderboardEntry | null;
  tokenBalance: number;
  copiedAddr: string | null;
  onCopy: (addr: string) => void;
}) {
  const myBal = isCurrentUser ? tokenBalance : entry.balance;
  const needed = isCurrentUser && nextEntry ? Math.max(0, Math.ceil(nextEntry.balance - myBal + 1)) : null;

  const rankColor =
    entry.rank === 1 ? "text-[#D4AF37]" :
    entry.rank === 2 ? "text-gray-300" :
    entry.rank === 3 ? "text-amber-600" :
    isCurrentUser    ? "text-[#D4AF37]" : "text-gray-500";

  return (
    <div
      className={`px-3 py-2.5 rounded-xl flex items-center gap-2.5 relative overflow-hidden transition-colors ${
        isCurrentUser
          ? "bg-[#D4AF37]/8 border border-[#D4AF37]/40 shadow-[0_0_16px_rgba(212,175,55,0.12)]"
          : "glass-card border border-transparent"
      }`}
    >
      {isCurrentUser && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#D4AF37] rounded-l-xl" />}

      {/* Rank */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 border ${
        entry.rank <= 3
          ? entry.rank === 1 ? "bg-[#D4AF37]/20 border-[#D4AF37]/40" :
            entry.rank === 2 ? "bg-gray-400/10 border-gray-400/25" :
            "bg-amber-700/20 border-amber-700/35"
          : "bg-white/4 border-white/8"
      } ${rankColor}`}>
        {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : entry.rank}
      </div>

      {/* Team logo */}
      <TeamLogo teamId={entry.favoriteTeam} size={18} />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold truncate ${isCurrentUser || entry.rank <= 3 ? rankColor : "text-white"}`}>
            {entry.displayName}
          </span>
          {isCurrentUser && (
            <span className="text-[8px] font-black text-[#D4AF37] border border-[#D4AF37]/35 rounded px-1 py-px flex-shrink-0">
              YOU
            </span>
          )}
          {entry.inApp && (
            <span className="text-[8px] font-bold text-green-400 border border-green-500/25 bg-green-500/8 rounded px-1 py-px leading-none flex-shrink-0">
              Hub
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <TierPill tierId={entry.tierId} />
          <button
            onClick={() => onCopy(entry.stellarAddress)}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 active:bg-white/10 transition-colors"
          >
            {copiedAddr === entry.stellarAddress ? (
              <span className="text-[8px] text-green-400 font-semibold">Copied!</span>
            ) : (
              <span className="text-[8px] text-gray-600 font-mono">{truncateAddress(entry.stellarAddress)}</span>
            )}
          </button>
        </div>
      </div>

      {/* Balance + climb nudge */}
      <div className="text-right flex-shrink-0">
        <span className={`font-black text-xs ${isCurrentUser || entry.rank <= 3 ? rankColor : "text-white"}`}>
          {formatBalance(entry.balance)}
        </span>
        <p className="text-[8px] text-gray-600">{PRIMARY_CUSTOM_ASSET_LABEL}</p>
        {isCurrentUser && needed != null && needed > 0 && (
          <p className="text-[8px] text-[#D4AF37]/70 font-semibold">+{formatBalance(needed)} → #{entry.rank - 1}</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const router = useRouter();
  useTelegramBack(() => router.back());

  const currentAddress  = useWalletStore((s) => s.stellarAddress);
  const tokenBalance    = useWalletStore((s) => s.tokenBalance);
  const telegramUserId  = useWalletStore((s) => s.telegramUserId);
  const currentTier    = getTierForBalance(parseFloat(tokenBalance) || 0);
  const myXlmRefundPct = currentTier.rewards?.xlmRefundPct ?? 20;

  const [entries, setEntries]       = useState<LeaderboardEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [inAppCount, setInAppCount] = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [loaded, setLoaded]         = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const myRowRef = useRef<HTMLDivElement>(null);

  function copyAddress(addr: string) {
    navigator.clipboard.writeText(addr).then(() => {
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 1500);
    });
  }

  function load() {
    setError(null);
    setLoaded(false);
    const initData = getTelegramInitData();
    fetch("/api/leaderboard", { headers: { "x-telegram-init-data": initData } })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setEntries(json.data.entries);
          setTotal(json.data.total);
          setInAppCount((json.data.entries as LeaderboardEntry[]).filter((e) => e.inApp).length);
        } else {
          setError(json.error ?? "Failed to load leaderboard");
        }
        setLoaded(true);
      })
      .catch(() => { setError("Network error — please retry"); setLoaded(true); });
  }

  const showContent = useMinLoader(loaded);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myEntry = currentAddress
    ? entries.find((e) => e.stellarAddress.toLowerCase() === currentAddress.toLowerCase()) ?? null
    : null;
  const myRank = myEntry?.rank ?? null;
  const myBal  = parseFloat(tokenBalance) || 0;
  const personAhead = myRank != null && myRank > 1
    ? entries.find((e) => e.rank === myRank - 1) ?? null
    : null;
  const neededToClimb = personAhead ? Math.ceil(personAhead.balance - myBal + 1) : null;

  const liveTgId = typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id : null;
  const tgId = liveTgId ?? telegramUserId;
  const referralLink = buildReferralLink(tgId);

  function shareReferral() { shareReferralLink(referralLink); }

  return (
    <WalletGuard>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="pt-3 pb-2 px-4 sticky top-0 z-10 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-white text-base">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white tracking-tight">Leaderboard</h1>
            <p className="text-xs text-[#D4AF37] font-medium">Top {PRIMARY_CUSTOM_ASSET_LABEL} Holders</p>
          </div>
          {total > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-mono">{total} holders</p>
              <p className="text-[9px] text-green-400 font-mono">{inAppCount} in the Hub</p>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-3 pb-28">
        {error && <ErrorCard error={error} context="Leaderboard" onRetry={load} />}
        {!showContent && !error && <PageLoader label="Loading leaderboard…" />}

        {showContent && entries.length > 0 && (
          <>
            {/* Podium */}
            <Podium entries={entries} />

            {/* My rank hero — when ranked */}
            {myRank != null && (
              <div className="rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/8 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#D4AF37] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {myRank === 1 ? 'crown' : 'trending_up'}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">
                        You&apos;re ranked <span className="text-[#D4AF37]">#{myRank}</span>
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {myRank === 1
                          ? 'You hold the top spot 👑 Defend your throne!'
                          : `Holding ${formatBalance(myBal)} ${PRIMARY_CUSTOM_ASSET_LABEL}`}
                      </p>
                    </div>
                  </div>
                  {myRank === 1 ? (
                    <span className="text-2xl animate-bounce">👑</span>
                  ) : neededToClimb != null && neededToClimb > 0 ? (
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide">To reach #{myRank - 1}</p>
                      <p className="text-base font-black text-[#D4AF37]">+{formatBalance(neededToClimb)}</p>
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => router.push('/buy')}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm active:scale-[0.98] transition shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
                  {myRank === 1 ? `Buy more — Stay #1` : `Buy ${PRIMARY_CUSTOM_ASSET_LABEL} — Climb the Ranks`}
                </button>
              </div>
            )}

            {/* Not ranked yet */}
            {myRank == null && currentAddress && (
              <div className="rounded-2xl border border-white/10 bg-white/3 p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-500 text-2xl">leaderboard</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">You&apos;re not ranked yet</p>
                  <p className="text-[10px] text-gray-400">Buy {PRIMARY_CUSTOM_ASSET_LABEL} to get on the board</p>
                </div>
                <button onClick={() => router.push('/buy')} className="text-[11px] font-bold text-[#D4AF37] flex items-center gap-0.5">
                  Buy <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                </button>
              </div>
            )}

            {/* Full Rankings */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base">format_list_numbered</span>
                <h3 className="text-sm font-bold text-white">Full Rankings</h3>
              </div>
              <div className="space-y-1.5" ref={myRowRef}>
                {entries.map((entry, i) => {
                  const isCurrentUser = !!(currentAddress &&
                    entry.stellarAddress.toLowerCase() === currentAddress.toLowerCase());
                  const nextEntry = entries[i - 1] ?? null; // person ranked above (lower rank number)
                  return (
                    <LeaderRow
                      key={entry.stellarAddress}
                      entry={entry}
                      isCurrentUser={isCurrentUser}
                      nextEntry={nextEntry}
                      tokenBalance={myBal}
                      copiedAddr={copiedAddr}
                      onCopy={copyAddress}
                    />
                  );
                })}
              </div>
            </section>

            {/* Invite + Donate CTAs */}
            <div className="grid grid-cols-2 gap-3">
              {/* Invite */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>group_add</span>
                  <p className="text-xs font-bold text-white">Invite & Earn</p>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Earn <span className="text-blue-300 font-semibold">+{myXlmRefundPct}% XLM back</span> when friends buy {PRIMARY_CUSTOM_ASSET_LABEL}.
                </p>
                {referralLink ? (
                  <>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
                      <span className="text-[10px] text-gray-300 font-mono flex-1 truncate">
                        {referralLink.replace('https://', '')}
                      </span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(referralLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500) }}
                        className="flex-shrink-0 text-[#D4AF37]"
                      >
                        <span className="material-symbols-outlined text-[14px]">{copiedLink ? 'check' : 'content_copy'}</span>
                      </button>
                    </div>
                    <button
                      onClick={shareReferral}
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-blue-500/35 bg-blue-500/12 text-blue-300 font-bold text-xs active:scale-[0.98] transition"
                    >
                      <span className="material-symbols-outlined text-[13px]">share</span>
                      Share
                    </button>
                  </>
                ) : (
                  <p className="text-[10px] text-gray-600 italic">Open in Telegram to get your link</p>
                )}
              </div>

              {/* Donate */}
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-green-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
                  <p className="text-xs font-bold text-white">Donate</p>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed flex-1">
                  Support AFL campaigns. Get <span className="text-green-300 font-semibold">featured</span> on the Top Supporters board.
                </p>
                <button
                  onClick={() => router.push('/donate')}
                  className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-green-500/35 bg-green-500/12 text-green-300 font-bold text-xs active:scale-[0.98] transition"
                >
                  <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
                  Donate Now
                </button>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {showContent && entries.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center min-h-[40dvh] gap-3 text-center">
            <span className="material-symbols-outlined text-[#D4AF37] text-5xl">emoji_events</span>
            <p className="text-white font-semibold">No holders yet</p>
            <p className="text-gray-400 text-sm">Be the first to hold {PRIMARY_CUSTOM_ASSET_LABEL} and claim the top spot!</p>
          </div>
        )}
      </main>

      <BottomNav />
    </WalletGuard>
  );
}
