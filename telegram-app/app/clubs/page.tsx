"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import WalletGuard from "@/components/WalletGuard";
import PageLoader, { useMinLoader } from "@/components/PageLoader";
import { useTelegramBack } from "@/hooks/useTelegramBack";
import { useWalletStore } from "@/hooks/useStore";
import { toast } from "@/components/Toast";
import { getTelegramInitData } from "@/lib/telegram";
import { PRIMARY_CUSTOM_ASSET_LABEL } from "@/lib/constants";
import { BRANDING } from "@/config/branding";
import {
  ALL_CLUBS,
  AFL_CLUBS,
  WAFL_CLUBS,
  AFL_ROUNDS,
  WAFL_ROUND_1_FIXTURES,
  MATCH_REPORTS,
  WHIPLASH347_CLUB,
  WHIPLASH347_SQUAD,
  type AflClub,
  type AflFixture,
  type AflMatchReport,
  type AflRoundMeta,
  type PlayerPosition,
} from "@/config/afl";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "fan-hub" | "fixtures";

interface TeamDistribution {
  [teamId: string]: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClubLogo(teamName: string): string | null {
  const club = ALL_CLUBS.find((c) => c.name === teamName);
  return club?.logo || null;
}

function groupByDate(fixtures: AflFixture[]) {
  return fixtures.reduce(
    (acc, f) => {
      if (!acc[f.date]) acc[f.date] = [];
      acc[f.date].push(f);
      return acc;
    },
    {} as Record<string, AflFixture[]>,
  );
}

// ── Match report dropdown ──────────────────────────────────────────────────────

function MatchReport({
  fixture,
  report,
}: {
  fixture: AflFixture;
  report: AflMatchReport;
}) {
  const homeWon = (fixture.homeScore ?? 0) > (fixture.awayScore ?? 0);

  return (
    <div className="mt-3 pt-3 border-t border-white/8 space-y-4">
      {/* Quarter scoreboard */}
      <div className="rounded-xl overflow-hidden border border-white/8">
        <div className="grid grid-cols-6 bg-white/5 px-3 py-1.5">
          <span className="col-span-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            Team
          </span>
          {["Q1", "Q2", "Q3", "Final"].map((h) => (
            <span
              key={h}
              className="text-center text-[9px] font-bold text-gray-500 uppercase tracking-wider"
            >
              {h}
            </span>
          ))}
        </div>
        {[
          { team: fixture.homeTeam, q: report.home.quarters, won: homeWon },
          { team: fixture.awayTeam, q: report.away.quarters, won: !homeWon },
        ].map(({ team, q, won }) => (
          <div
            key={team}
            className={`grid grid-cols-6 px-3 py-2 border-t border-white/5 ${won ? "bg-primary/5" : ""}`}
          >
            <span
              className={`col-span-2 text-xs font-bold truncate pr-2 ${won ? "text-primary" : "text-gray-400"}`}
            >
              {team.split(" ").slice(-1)[0]}
              {won ? " ✓" : ""}
            </span>
            <span className="text-center text-xs text-gray-500">{q.q1}</span>
            <span className="text-center text-xs text-gray-500">{q.q2}</span>
            <span className="text-center text-xs text-gray-500">{q.q3}</span>
            <span
              className={`text-center text-xs font-bold ${won ? "text-white" : "text-gray-500"}`}
            >
              {q.final}
            </span>
          </div>
        ))}
      </div>

      {/* Goals + Best side by side columns */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Goals",
            icon: "sports_score",
            home: report.home.goals,
            away: report.away.goals,
          },
          {
            label: "Best",
            icon: "star",
            home: report.home.best,
            away: report.away.best,
          },
        ].map(({ label, icon, home, away }) => (
          <div
            key={label}
            className="rounded-xl bg-white/3 border border-white/8 p-3 space-y-2.5"
          >
            <div className="flex items-center space-x-1.5">
              <span className="material-symbols-outlined text-[13px] text-primary">
                {icon}
              </span>
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest">
                {label}
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[8px] text-gray-600 uppercase font-semibold mb-0.5">
                  {fixture.homeTeam.split(" ").slice(-1)[0]}
                </p>
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  {home}
                </p>
              </div>
              <div className="h-px bg-white/5" />
              <div>
                <p className="text-[8px] text-gray-600 uppercase font-semibold mb-0.5">
                  {fixture.awayTeam.split(" ").slice(-1)[0]}
                </p>
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  {away}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Injuries + crowd row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 rounded-xl bg-white/3 border border-white/8 p-3 space-y-2">
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-[13px] text-red-400">
              emergency
            </span>
            <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">
              Injuries
            </span>
          </div>
          {[
            { team: fixture.homeTeam, inj: report.home.injuries },
            { team: fixture.awayTeam, inj: report.away.injuries },
          ].map(({ team, inj }) => (
            <div key={team} className="flex items-start space-x-2">
              <div
                className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${inj === "Nil" ? "bg-green-400" : "bg-red-400"}`}
              />
              <div>
                <p className="text-[8px] text-gray-600 uppercase font-semibold">
                  {team.split(" ").slice(-1)[0]}
                </p>
                <p
                  className={`text-[10px] ${inj === "Nil" ? "text-green-400" : "text-red-300"}`}
                >
                  {inj}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white/3 border border-white/8 p-3 text-center min-w-[90px]">
          <span className="material-symbols-outlined text-gray-500 text-base">
            groups
          </span>
          <p className="text-sm font-bold text-white mt-1">
            {report.crowd.split(" ")[0]}
          </p>
          <p className="text-[9px] text-gray-500 leading-tight">
            {report.crowd.split(" at ")[1] ?? ""}
          </p>
        </div>
      </div>

      {/* Stat buttons — coming soon */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: "person_play", label: "Player Stats" },
          { icon: "bar_chart", label: "Team Stats" },
        ].map(({ icon, label }) => (
          <div key={label} className="relative">
            <button
              disabled
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-white/8 bg-white/3 opacity-40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-primary text-[15px]">
                {icon}
              </span>
              <span className="text-xs font-semibold text-gray-300">
                {label}
              </span>
            </button>
            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-black bg-primary px-1.5 py-0.5 rounded-full leading-none">
              SOON
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fixture card ───────────────────────────────────────────────────────────────

function FixtureCard({
  f,
  hideReport = false,
}: {
  f: AflFixture;
  hideReport?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const homeWins = (f.homeScore ?? 0) > (f.awayScore ?? 0);
  const awayWins = (f.awayScore ?? 0) > (f.homeScore ?? 0);
  const isUpcoming = f.status === "UPCOMING";
  const hasWL347Player = f.homeTeam.includes('West Coast') || f.awayTeam.includes('West Coast') || f.homeTeam.includes('Fremantle') || f.awayTeam.includes('Fremantle');
  const report = hideReport
    ? null
    : (MATCH_REPORTS.find((r) => r.fixtureId === f.id) ?? null);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        open
          ? "border-primary/30 bg-primary/3"
          : "border-white/8 bg-white/2"
      }`}
      style={{
        background: open ? "rgba(212,175,55,0.03)" : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="p-4 space-y-3">
        {/* Top row: status pill + venue */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
              f.status === "LIVE"
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : f.status === "FULL TIME"
                  ? "bg-white/8 text-gray-400 border border-white/10"
                  : "bg-primary/15 text-primary border border-primary/25"
            }`}
          >
            {isUpcoming ? `🕐 ${f.time}` : f.status}
          </span>
          <div className="text-right min-w-0 flex items-start gap-1.5">
            {hasWL347Player && (
              <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none mt-0.5"
                style={{ background: 'rgba(232,25,44,0.15)', color: '#E8192C', border: '1px solid rgba(232,25,44,0.3)' }}>
                Whip347
              </span>
            )}
            <div>
              <p className="text-[10px] text-gray-400 leading-tight truncate">
                {f.venue}
              </p>
              <p className="text-[9px] text-gray-600 leading-tight">
                {f.country}
              </p>
            </div>
          </div>
        </div>

        {/* Teams matchup */}
        <div className="flex items-center gap-3">
          {/* Home */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              {getClubLogo(f.homeTeam) && (
                <img
                  src={getClubLogo(f.homeTeam)!}
                  alt=""
                  width={28}
                  height={28}
                  className="object-contain flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                <p
                  className={`font-bold text-sm leading-tight ${homeWins ? "text-white" : isUpcoming ? "text-gray-200" : "text-gray-500"}`}
                >
                  {f.homeTeam}
                </p>
                {f.homePosition != null && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    #{f.homePosition} ladder
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Score or VS placeholder */}
          <div className="flex-shrink-0 text-center">
            {isUpcoming ? (
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold text-gray-600 tabular-nums">
                  —
                </span>
                <span className="text-gray-700 text-xs">:</span>
                <span className="text-xl font-bold text-gray-600 tabular-nums">
                  —
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span
                  className={`text-2xl font-bold tabular-nums ${homeWins ? "text-white" : "text-gray-600"}`}
                >
                  {f.homeScore}
                </span>
                <span className="text-gray-700 text-sm">:</span>
                <span
                  className={`text-2xl font-bold tabular-nums ${awayWins ? "text-white" : "text-gray-600"}`}
                >
                  {f.awayScore}
                </span>
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-end space-x-2">
              <div className="min-w-0">
                <p
                  className={`font-bold text-sm leading-tight ${awayWins ? "text-white" : isUpcoming ? "text-gray-200" : "text-gray-500"}`}
                >
                  {f.awayTeam}
                </p>
                {f.awayPosition != null && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    #{f.awayPosition} ladder
                  </p>
                )}
              </div>
              {getClubLogo(f.awayTeam) && (
                <img
                  src={getClubLogo(f.awayTeam)!}
                  alt=""
                  width={28}
                  height={28}
                  className="object-contain flex-shrink-0"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>

        {/* Winner / odds attribution */}
        {f.winner && (
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-[13px] text-primary">
              emoji_events
            </span>
            <p className="text-xs text-primary font-medium">{f.winner}</p>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-0.5">
          {report ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl border text-xs font-semibold transition ${
                open
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-primary/8 border-primary/20 text-primary hover:bg-primary/15"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {open ? "keyboard_arrow_up" : "bar_chart"}
              </span>
              <span>{open ? "Hide Report" : "Match Report"}</span>
            </button>
          ) : (
            <a
              href={f.matchReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl border border-white/10 text-xs font-medium text-gray-400 hover:text-primary hover:border-primary/20 transition"
            >
              <span className="material-symbols-outlined text-[14px]">
                open_in_new
              </span>
              <span>{isUpcoming ? "AFL Fixture" : "Match Report"}</span>
            </a>
          )}
        </div>
      </div>

      {/* Inline match report — expands below */}
      {open && report && (
        <div className="px-4 pb-4">
          <MatchReport fixture={f} report={report} />
        </div>
      )}
    </div>
  );
}

// ── Fan Hub — clubs grid ───────────────────────────────────────────────────────

function ClubGrid({
  clubs,
  teamDistribution,
  favoriteTeam,
}: {
  clubs: AflClub[];
  teamDistribution: TeamDistribution | null;
  favoriteTeam: string | null;
}) {
  const sorted = clubs
    .map((club) => ({ club, fans: teamDistribution?.[club.id] ?? 0 }))
    .sort((a, b) => b.fans - a.fans);
  const topFans = sorted[0]?.fans ?? 0;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {sorted.map(({ club, fans }, index) => {
        const isFavorite = club.id === favoriteTeam;
        const rank = index + 1;
        const isTop3 = rank <= 3 && fans > 0;

        return (
          <div
            key={club.id}
            className={`relative rounded-2xl border p-3 flex flex-col items-center text-center transition-all duration-200 ${
              isFavorite
                ? "border-primary/60 bg-primary/8 shadow-[0_0_18px_rgba(212,175,55,0.25)]"
                : "border-white/8 bg-white/2 hover:border-white/15"
            }`}
          >
            {/* Rank badge for top 3 */}
            {isTop3 && (
              <div
                className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                  rank === 1
                    ? "bg-primary text-black border-primary"
                    : rank === 2
                      ? "bg-gray-300 text-black border-gray-300"
                      : "bg-amber-700 text-white border-amber-700"
                }`}
              >
                {rank}
              </div>
            )}

            {/* Favorite star */}
            {isFavorite && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[11px] text-black"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              </div>
            )}

            {/* Logo */}
            <div
              className={`w-14 h-14 flex items-center justify-center mb-2 rounded-xl ${isFavorite ? "bg-primary/10" : "bg-white/3"}`}
            >
              {club.logo ? (
                <img
                  src={club.logo}
                  alt={club.name}
                  width={52}
                  height={52}
                  className="object-contain"
                  loading="lazy"
                />
              ) : (
                <div
                  className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-bold text-xs"
                  style={{ background: club.color }}
                >
                  {club.shortName}
                </div>
              )}
            </div>

            {/* Club name */}
            <p
              className={`text-[10px] font-bold leading-tight mb-1.5 ${isFavorite ? "text-primary" : "text-gray-200"}`}
            >
              {club.shortName}
            </p>

            {/* Fan count badge */}
            <div
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                fans > 0
                  ? isFavorite
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "bg-white/8 text-gray-300 border-white/12"
                  : "bg-white/3 text-gray-600 border-white/6"
              }`}
            >
              {fans > 0 ? `${fans} fan${fans === 1 ? "" : "s"}` : "No fans yet"}
            </div>

            {/* Popularity bar */}
            {topFans > 0 && fans > 0 && (
              <div className="w-full mt-2 bg-white/5 rounded-full h-1">
                <div
                  className="h-1 rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(Math.round((fans / topFans) * 100), 8)}%`,
                    background: isFavorite ? BRANDING.colors.primary : club.color,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Position badge colors ───────────────────────────────────────────────────
const POS_COLORS: Record<PlayerPosition, string> = {
  MID: '#a78bfa',
  FWD: '#fb923c',
  DEF: '#60a5fa',
  RUCK: '#34d399',
}

function PositionBadge({ position }: { position: PlayerPosition }) {
  return (
    <span
      className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full leading-none"
      style={{ background: `${POS_COLORS[position]}20`, color: POS_COLORS[position], border: `1px solid ${POS_COLORS[position]}40` }}
    >
      {position}
    </span>
  )
}

// ── WhipLash347 dedicated tab ───────────────────────────────────────────────

function WhipLash347Tab({
  teamDistribution,
  onJoinTeam,
  isJoining,
}: {
  teamDistribution: TeamDistribution | null
  onJoinTeam: () => void
  isJoining: boolean
}) {
  const favoriteTeam = useWalletStore((s) => s.favoriteTeam)
  const isMember = favoriteTeam === 'whiplash347'
  const fanCount = teamDistribution?.['whiplash347'] ?? 0
  const captain = WHIPLASH347_SQUAD.find((p) => p.captain)

  // Group players by club
  const wcePlayers = WHIPLASH347_SQUAD.filter((p) => p.clubId === 'west-coast')
  const frePlayers = WHIPLASH347_SQUAD.filter((p) => p.clubId === 'fremantle')
  const wceClub = ALL_CLUBS.find((c) => c.id === 'west-coast')
  const freClub = ALL_CLUBS.find((c) => c.id === 'fremantle')

  // Leaderboard (top 5)
  const [leaders, setLeaders] = useState<{ displayName: string; stellarAddress: string; balance: number }[]>([])
  useEffect(() => {
    fetch('/api/leaderboard', { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data?.entries)) {
          setLeaders(json.data.entries.slice(0, 5))
        }
      })
      .catch(() => {})
  }, [])

  const RANK_MEDAL = ['🥇','🥈','🥉']

  return (
    <div className="space-y-4">

      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div className="rounded-2xl relative overflow-hidden" style={{ background: '#0d0608' }}>
        {/* colour streaks */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-10 top-0 bottom-0 w-32 opacity-40" style={{ background: 'linear-gradient(90deg, #E8192C, transparent)' }} />
          <div className="absolute -right-10 top-0 bottom-0 w-32 opacity-30" style={{ background: 'linear-gradient(270deg, #00D4FF, transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, #E8192C88, #00D4FF88)' }} />
        </div>
        <div className="relative z-[1] flex items-center gap-4 px-4 py-5">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full blur-xl opacity-70" style={{ background: '#E8192C' }} />
            <img src={WHIPLASH347_CLUB.logo} alt="WhipLash347" width={80} height={80}
              className="relative rounded-full object-cover"
              style={{ border: '2px solid #E8192C', boxShadow: '0 0 20px rgba(232,25,44,0.6)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#E8192C' }}>⚡ Official Partner</p>
            <h2 className="text-2xl font-black text-white leading-none tracking-tight">WhipLash347</h2>
            <p className="text-[10px] mt-1" style={{ color: '#00D4FF99' }}>{WHIPLASH347_SQUAD.length} players · WCE &amp; Fremantle</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,25,44,0.2)', color: '#E8192C', border: '1px solid rgba(232,25,44,0.4)' }}>
                {fanCount} fan{fanCount === 1 ? '' : 's'}
              </span>
              {isMember && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}>
                  ✓ Your Team
                </span>
              )}
            </div>
          </div>
        </div>
        {!isMember && (
          <div className="relative z-[1] px-4 pb-4">
            <button onClick={onJoinTeam} disabled={isJoining}
              className="w-full py-2.5 rounded-xl text-sm font-black tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg, #E8192C, #c0102a)', color: 'white', boxShadow: '0 4px 20px rgba(232,25,44,0.4)' }}>
              {isJoining ? 'Joining...' : '⚡ Join WhipLash347'}
            </button>
          </div>
        )}
      </div>

      {/* ── Captain's Pick ──────────────────────────────────────── */}
      {captain && (
        <div className="rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.04) 100%)', border: '1px solid rgba(212,175,55,0.35)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${BRANDING.colors.primary}, transparent)` }} />
          <div className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: 'rgba(212,175,55,0.15)', border: '2px solid rgba(212,175,55,0.4)' }}>
              🏆
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${BRANDING.colors.primary}25`, color: BRANDING.colors.primary, border: `1px solid ${BRANDING.colors.primary}40` }}>⚡ Captain</span>
                <PositionBadge position={captain.position} />
              </div>
              <p className="text-base font-black text-white leading-tight">{captain.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {wceClub?.logo && <img src={wceClub.logo} alt="WCE" width={14} height={14} className="object-contain opacity-70" />}
                <span className="text-[10px] text-gray-400">{captain.club}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Squad by club ───────────────────────────────────────── */}
      {[
        { label: 'West Coast Eagles', abbr: 'WCE', accentColor: '#003087', club: wceClub, players: wcePlayers },
        { label: 'Fremantle', abbr: 'FRE', accentColor: '#2A1A54', club: freClub, players: frePlayers },
      ].map(({ label, abbr, accentColor, club, players }) => (
        <div key={label}>
          {/* Section header */}
          <div className="flex items-center gap-2 mb-2 px-1">
            {club?.logo && <img src={club.logo} alt={abbr} width={22} height={22} className="object-contain" />}
            <span className="text-xs font-black text-white tracking-tight">{label}</span>
            <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${accentColor}44`, color: 'rgba(255,255,255,0.6)', border: `1px solid ${accentColor}66` }}>{players.length} picks</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {players.filter((p) => !p.captain).map((p) => (
              <div key={p.name} className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: `${accentColor}22`, border: `1px solid ${accentColor}55` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white leading-tight">{p.name}</p>
                  <div className="mt-1">
                    <PositionBadge position={p.position} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Fan Leaderboard ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0608', border: '1px solid rgba(232,25,44,0.25)' }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(232,25,44,0.08)', borderBottom: '1px solid rgba(232,25,44,0.15)' }}>
          <span className="material-symbols-outlined text-sm" style={{ color: '#E8192C', fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
          <span className="text-xs font-black text-white">Top {PRIMARY_CUSTOM_ASSET_LABEL} Holders</span>
          <span className="ml-auto text-[9px] text-gray-500">Global ranking</span>
        </div>
        {leaders.length > 0 ? (
          <div>
            {leaders.map((entry, i) => (
              <div key={entry.stellarAddress} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < leaders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span className="text-sm w-5 text-center flex-shrink-0">{RANK_MEDAL[i] ?? String(i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-200 truncate">{entry.displayName}</p>
                </div>
                <span className="text-xs font-black" style={{ color: BRANDING.colors.primary }}>
                  {Number(entry.balance).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 gap-2">
            <div className="w-3 h-3 rounded-full border border-[#E8192C]/40 border-t-[#E8192C] animate-spin" />
            <p className="text-xs text-gray-600">Loading…</p>
          </div>
        )}
      </div>

      {/* ── Bottom CTA ──────────────────────────────────────────── */}
      {!isMember && (
        <button onClick={onJoinTeam} disabled={isJoining}
          className="w-full py-3 rounded-xl text-sm font-black tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg, #E8192C 0%, #00D4FF 100%)', color: 'white', boxShadow: '0 4px 24px rgba(232,25,44,0.35)' }}>
          {isJoining ? 'Joining...' : '⚡ Join WhipLash347 Now'}
        </button>
      )}
    </div>
  )
}

function FanHubTab({
  teamDistribution,
  loading,
}: {
  teamDistribution: TeamDistribution | null;
  loading: boolean;
}) {
  const favoriteTeam = useWalletStore((s) => s.favoriteTeam);
  const setFavoriteTeam = useWalletStore((s) => s.setFavoriteTeam);
  const [league, setLeague] = useState<"AFL" | "WAFL" | "WL347">("WL347");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinWL347 = async () => {
    setIsJoining(true)
    try {
      const initData = getTelegramInitData()
      const res = await fetch('/api/user/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({ teamId: 'whiplash347' }),
      })
      const json = await res.json()
      if (json.success) {
        setFavoriteTeam('whiplash347')
        toast.success('You joined WhipLash347!')
      } else {
        toast.error('Failed to join team')
      }
    } catch {
      toast.error('Failed to join team')
    } finally {
      setIsJoining(false)
    }
  }

  const myClub = favoriteTeam
    ? ALL_CLUBS.find((c) => c.id === favoriteTeam)
    : null;
  const aflFans = AFL_CLUBS.reduce(
    (sum, c) => sum + (teamDistribution?.[c.id] ?? 0),
    0,
  );
  const waflFans = WAFL_CLUBS.reduce(
    (sum, c) => sum + (teamDistribution?.[c.id] ?? 0),
    0,
  );
  const totalFans = aflFans + waflFans;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-gray-500">Loading fan counts…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="glass-card rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-primary text-base">
            groups
          </span>
          <div>
            <p className="text-xs font-bold text-white">
              {totalFans} total fans
            </p>
            <p className="text-[10px] text-gray-500">
              AFL {aflFans} · WAFL {waflFans}
            </p>
          </div>
        </div>
        {myClub && (
          <div className="flex items-center space-x-2">
            {myClub.logo ? (
              <img
                src={myClub.logo}
                alt={myClub.shortName}
                width={24}
                height={24}
                className="object-contain"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                style={{ background: myClub.color }}
              >
                {myClub.shortName.slice(0, 2)}
              </div>
            )}
            <div className="text-right">
              <p className="text-[10px] font-bold text-primary">Your Club</p>
              <p className="text-[9px] text-gray-400">
                {myClub.shortName} · {myClub.league}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* League tabs */}
      <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1">
        {[
          { id: "AFL" as const, label: "AFL", count: AFL_CLUBS.length },
          { id: "WAFL" as const, label: "WAFL", count: WAFL_CLUBS.length },
          { id: "WL347" as const, label: "⚡ Whip347", count: WHIPLASH347_SQUAD.length },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setLeague(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              league === id
                ? id === "WL347" ? "text-white" : "bg-primary text-background-dark"
                : "text-gray-400 hover:text-white"
            }`}
            style={league === id && id === "WL347" ? { background: 'linear-gradient(135deg, #E8192C, #00D4FF)' } : undefined}
          >
            {label}
            <span
              className={`ml-1.5 text-[10px] ${league === id ? "opacity-60" : "opacity-50"}`}
            >
              {id === "WL347" ? `${count} players` : `${count} teams`}
            </span>
          </button>
        ))}
      </div>

      {/* WL347 tab content */}
      {league === "WL347" && (
        <WhipLash347Tab
          teamDistribution={teamDistribution}
          onJoinTeam={handleJoinWL347}
          isJoining={isJoining}
        />
      )}

      {/* Empty state when selected league has no fans yet */}
      {league !== "WL347" && (league === "AFL" ? aflFans : waflFans) === 0 && (
        <div className="glass-card rounded-xl">
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-2xl text-gray-500">
                groups
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-300">
              No fans registered yet
            </p>
            <p className="text-xs text-gray-500 max-w-[220px] leading-relaxed">
              Connect your wallet and pick a {league} club to appear on this
              board.
            </p>
          </div>
        </div>
      )}

      {/* Grid for selected league */}
      {league !== "WL347" && (
        <ClubGrid
          clubs={league === "AFL" ? AFL_CLUBS : WAFL_CLUBS}
          teamDistribution={teamDistribution}
          favoriteTeam={favoriteTeam}
        />
      )}

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 text-[9px] text-gray-600">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Your club</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Other clubs</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-[10px]">1</span>
          <span>= Top 3 ranked</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ClubsPage() {
  const router = useRouter();
  useTelegramBack(() => router.back());

  const [activeTab, setActiveTab] = useState<Tab>("fan-hub");
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  // Auto-detect current round: pick the round whose window contains today, or the most recent past round
  function detectCurrentRound(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Find round in progress
    const active = AFL_ROUNDS.findIndex(
      (r) => today >= r.startDate && today <= r.endDate,
    );
    if (active !== -1) return active;
    // Find most recently completed round
    for (let i = AFL_ROUNDS.length - 1; i >= 0; i--) {
      if (today > AFL_ROUNDS[i].endDate) return i;
    }
    return 0;
  }

  const [activeRoundIdx, setActiveRoundIdx] = useState<number>(() =>
    detectCurrentRound(),
  );
  const [fixturesLeague, setFixturesLeague] = useState<"AFL" | "WAFL">("AFL");
  const [teamDistribution, setTeamDistribution] =
    useState<TeamDistribution | null>(null);
  const [fanLoading, setFanLoading] = useState(true);
  const ready = useMinLoader(true);

  useEffect(() => {
    fetch("/api/stats/funding")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.teamDistribution) {
          setTeamDistribution(json.data.teamDistribution);
        }
      })
      .catch(() => {
        // silently fail — fan counts will show 0
      })
      .finally(() => setFanLoading(false));
  }, []);

  const currentRound: AflRoundMeta = AFL_ROUNDS[activeRoundIdx];
  const aflFixtures = currentRound.fixtures;
  const fixtures =
    fixturesLeague === "WAFL" ? WAFL_ROUND_1_FIXTURES : aflFixtures;
  const completedFixtures = fixtures.filter((f) => f.status === "FULL TIME");
  const upcomingFixtures = fixtures.filter((f) => f.status !== "FULL TIME");

  if (!ready) {
    return (
      <WalletGuard>
        <PageLoader label="Loading clubs…" />
        <BottomNav />
      </WalletGuard>
    );
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-0 px-4 sticky top-0 z-30 bg-background-dark border-b border-white/10">
        {/* Title + optional round selector (only shown on fixtures tab) */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Clubs
            </h1>
            <p className="text-xs text-primary font-medium">
              AFL & WAFL · 2026 Season
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex">
          {[
            { id: "fan-hub" as Tab, label: "Fan Hub", icon: "shield" },
            {
              id: "fixtures" as Tab,
              label: "Fixtures",
              icon: "calendar_month",
            },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {icon}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Round selector — WAFL label */}
        {activeTab === "fixtures" && fixturesLeague === "WAFL" && (
          <div className="pb-3 pt-1">
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl border border-primary bg-primary text-black text-xs font-bold">
              Round 1 · 29–30 Mar
            </span>
          </div>
        )}

        {/* Round selector — full-width scrollable pill row, AFL only */}
        {activeTab === "fixtures" && fixturesLeague === "AFL" && (
          <div
            className="-mx-4 overflow-x-auto scrollbar-none pb-3"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div
              className="flex gap-2 pl-4 pt-4 pr-8"
              style={{ width: "max-content" }}
            >
              {AFL_ROUNDS.map((r, i) => {
                const isActive = i === activeRoundIdx;
                const hasCompleted = r.fixtures.some(
                  (f) => f.status === "FULL TIME",
                );
                return (
                  <button
                    key={r.index}
                    onClick={() => setActiveRoundIdx(i)}
                    title={`${r.label} · ${r.dateRange}`}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs font-bold transition whitespace-nowrap ${
                      isActive
                        ? "bg-primary text-black border-primary shadow-[0_0_10px_rgba(212,175,55,0.35)]"
                        : "bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span>{r.shortLabel}</span>
                    {hasCompleted && !isActive && (
                      <span className="w-1 h-1 rounded-full bg-green-400 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 py-5 pb-32">
        {/* ── Fan Hub tab ── */}
        {activeTab === "fan-hub" && (
          <FanHubTab teamDistribution={teamDistribution} loading={fanLoading} />
        )}

        {/* ── Fixtures tab ── */}
        {activeTab === "fixtures" && (
          <div className="space-y-5">
            {/* League switcher */}
            <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1">
              {(["AFL", "WAFL"] as const).map((lg) => (
                <button
                  key={lg}
                  onClick={() => setFixturesLeague(lg)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    fixturesLeague === lg
                      ? "bg-primary text-background-dark"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {lg}
                </button>
              ))}
            </div>

            {/* Round meta strip */}
            <div className="flex items-center space-x-3">
              <span className="text-[10px] text-gray-500">
                {fixturesLeague === "WAFL"
                  ? "Rd 1 · 29–30 Mar"
                  : currentRound.dateRange}
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-[10px] text-gray-500">
                {fixtures.length} matches
              </span>
              {completedFixtures.length > 0 && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-gray-400 border border-white/10 uppercase tracking-wider">
                    {completedFixtures.length} done
                  </span>
                </>
              )}
              {upcomingFixtures.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {upcomingFixtures.length} upcoming
                </span>
              )}
            </div>

            {fixturesLeague === "AFL" && (
              <>
                {/* Results section */}
                {completedFixtures.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        Results
                      </span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    {completedFixtures.map((f) => (
                      <FixtureCard key={f.id} f={f} hideReport={false} />
                    ))}
                  </div>
                )}

                {/* Upcoming section */}
                {upcomingFixtures.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">
                        Upcoming
                      </span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    {Object.entries(groupByDate(upcomingFixtures)).map(
                      ([date, dayFixtures]) => (
                        <section key={date}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-px flex-1 bg-white/5" />
                            <span className="text-[9px] text-gray-600 uppercase tracking-widest whitespace-nowrap">
                              {date}
                            </span>
                            <div className="h-px flex-1 bg-white/5" />
                          </div>
                          <div className="space-y-3">
                            {dayFixtures.map((f) => (
                              <FixtureCard
                                key={f.id}
                                f={f}
                                hideReport={false}
                              />
                            ))}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                )}
              </>
            )}

            {/* WAFL: show all grouped by date */}
            {fixturesLeague === "WAFL" &&
              Object.entries(groupByDate(WAFL_ROUND_1_FIXTURES)).map(
                ([date, dayFixtures]) => (
                  <section key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                        {date}
                      </span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    <div className="space-y-3">
                      {dayFixtures.map((f) => (
                        <FixtureCard key={f.id} f={f} hideReport />
                      ))}
                    </div>
                  </section>
                ),
              )}
          </div>
        )}
      </main>

      <BottomNav />
    </WalletGuard>
  );
}
