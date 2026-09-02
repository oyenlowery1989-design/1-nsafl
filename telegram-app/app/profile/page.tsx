"use client";
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type TouchEvent,
} from "react";
import BottomNav from "@/components/BottomNav";
import WalletGuard from "@/components/WalletGuard";
import PageLoader, { useMinLoader } from "@/components/PageLoader";
import { useIdentityStore } from "@/hooks/useStore";
import { useSportsStore } from "@/packs/sports/store";
import { useStellarWalletStore } from "@/packs/stellar-wallet/store";
import {
  SHOWN_ASSET_CONFIGS,
  PRIMARY_CUSTOM_ASSET_CODE,
} from "@/lib/constants";
import {
  getTelegramUser,
  shareReferralLink,
  buildReferralLink,
} from "@/lib/telegram";
import { getPackCopy, isPackEnabled } from '@/config/app'
import { BRANDING } from '@/config/branding'
import {
  fetchAccountInfo,
  StellarAccountInfo,
  HorizonPayment,
} from "@/lib/stellar";
import { getTierForBalance } from "@/config/tiers";
import { ALL_CLUBS } from "@/config/afl";
import { REWARD_ASSETS } from "@/lib/rewardAssets";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTelegramBack } from "@/hooks/useTelegramBack";
import { haptic } from "@/lib/telegram-ui";
import TeamSelectScreen from "@/components/TeamSelectScreen";
import { getTelegramInitData } from "@/lib/telegram";
import { toast } from "@/components/Toast";
import { PARTNER_CLUB } from "@/config/partnerClub";

const ASSET_ISSUER = process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? "";
const MOVEMENT_WALLET = process.env.NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS ?? "";

interface TxDisplay {
  id: string;
  label: string;
  amount: string;
  assetCode: string;
  date: string;
  isIncoming: boolean;
  isSpam: boolean;
  raw: HorizonPayment;
}

interface DonationRecord {
  id: string;
  amount: number;
  asset_code: string;
  donation_type: string;
  donation_target: string | null;
  stellar_tx_hash: string | null;
  verified: boolean;
  created_at: string;
}

// How many extra pages to auto-fetch when no results come back
const MAX_AUTO_FETCH = 3;

function isSpamTx(r: HorizonPayment): boolean {
  if (parseFloat(r.amount ?? "0") < 0.01) return true;
  if (r.asset_type === "native") {
    // Spam if native XLM is not in the allowed list
    return !SHOWN_ASSET_CONFIGS.some(
      (a) => a.code === "XLM" && a.issuer === null,
    );
  }
  // Non-native: must match both code AND exact issuer
  return !SHOWN_ASSET_CONFIGS.some(
    (a) =>
      a.code === (r.asset_code ?? "") && a.issuer === (r.asset_issuer ?? ""),
  );
}

function mapToDisplay(r: HorizonPayment, myAddress: string): TxDisplay {
  const isIncoming = r.to === myAddress;
  const assetCode = r.asset_type === "native" ? "XLM" : (r.asset_code ?? "?");

  return {
    id: r.id,
    label: isIncoming ? "Received" : "Sent",
    amount: `${r.amount ?? "?"} ${assetCode}`,
    assetCode,
    date: new Date(r.created_at).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    isIncoming,
    isSpam: isSpamTx(r),
    raw: r,
  };
}

function getCounterpartyLabel(address: string): {
  label: string;
  isNamed: boolean;
} {
  if (ASSET_ISSUER && address === ASSET_ISSUER)
    return { label: "Issuer", isNamed: true };
  if (MOVEMENT_WALLET && address === MOVEMENT_WALLET)
    return { label: "Movement Wallet", isNamed: true };
  return {
    label: `${address.slice(0, 4)}...${address.slice(-4)}`,
    isNamed: false,
  };
}

// ── Telegram avatar — photo or gold initial ───────────────────────────────────
function TelegramAvatar({
  photoUrl,
  name,
  size = 72,
}: {
  photoUrl?: string;
  name: string;
  size?: number;
}) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover border-2 border-primary/40"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        className="text-primary font-bold"
        style={{ fontSize: size * 0.38 }}
      >
        {initial}
      </span>
    </div>
  );
}

function FullProfilePage() {
  const router = useRouter();
  useTelegramBack(() => router.back());
  const stellarAddress = useStellarWalletStore((s) => s.stellarAddress);
  const tokenBalance = useStellarWalletStore((s) => s.tokenBalance);
  const xlmBalance = useStellarWalletStore((s) => s.xlmBalance);
  const telegramUser = useIdentityStore((s) => s.telegramUser);
  const favoriteTeam = useSportsStore((s) => s.favoriteTeam);
  const favoriteWaflTeam = useSportsStore((s) => s.favoriteWaflTeam);
  const disconnectWallet = useStellarWalletStore((s) => s.disconnect);
  const resetTeams = useSportsStore((s) => s.resetTeams);
  const resetIdentity = useIdentityStore((s) => s.resetIdentity);
  const setFavoriteTeam = useSportsStore((s) => s.setFavoriteTeam);
  const setFavoriteWaflTeam = useSportsStore((s) => s.setFavoriteWaflTeam);
  const displayPreference = useIdentityStore((s) => s.displayPreference);
  const setDisplayPreference = useIdentityStore((s) => s.setDisplayPreference);

  // Prefer live Telegram SDK data, fallback to persisted store value
  const liveTgUser = getTelegramUser();
  const tgUser = liveTgUser
    ? {
        firstName: liveTgUser.first_name,
        lastName: liveTgUser.last_name,
        username: liveTgUser.username,
        photoUrl: liveTgUser.photo_url,
      }
    : telegramUser;

  const [copied, setCopied] = useState(false);
  const [changingTeam, setChangingTeam] = useState(false);
  const [allTxns, setAllTxns] = useState<TxDisplay[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Track initial data load — show full-page spinner until txns + balances are fetched
  const [pageReady, setPageReady] = useState(false);
  const showPage = useMinLoader(pageReady);
  // Filter spam by default; "Show all" reveals everything
  const [hideSpam, setHideSpam] = useState(true);
  const [allBalances, setAllBalances] = useState<Record<string, string>>({});
  const [accountInfo, setAccountInfo] = useState<StellarAccountInfo | null>(
    null,
  );
  const autoFetchCount = useRef(0);

  // Donations state
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const [showAllDonations, setShowAllDonations] = useState(false);

  // Referrals state
  interface ReferralEntry {
    telegram_first_name: string | null;
    telegram_username: string | null;
    created_at: string | null;
  }
  const [referralCount, setReferralCount] = useState(0);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [showAllReferrals, setShowAllReferrals] = useState(false);
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);
  const [trustlineStatuses, setTrustlineStatuses] = useState<Record<string, boolean | null>>(
    Object.fromEntries(REWARD_ASSETS.filter(a => a.issuer).map(a => [a.code, null]))
  );
  const [rewardBalances, setRewardBalances] = useState<Record<string, string>>({});

  const checkTrustlines = useCallback((address: string) => {
    const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org';
    return fetch(`${HORIZON_URL}/accounts/${address}`)
      .then(r => r.json())
      .then(account => {
        const bals: { asset_code?: string; asset_issuer?: string; balance?: string }[] = account.balances ?? [];
        const assets = REWARD_ASSETS.filter(a => a.issuer);
        setTrustlineStatuses(Object.fromEntries(
          assets.map(a => [a.code, bals.some(b => b.asset_code === a.code && b.asset_issuer === a.issuer)])
        ));
        setRewardBalances(Object.fromEntries(
          assets.map(a => {
            const b = bals.find(b => b.asset_code === a.code && b.asset_issuer === a.issuer);
            return [a.code, b ? parseFloat(b.balance ?? '0').toFixed(2) : '0'];
          })
        ));
      })
      .catch(() => null);
  }, []);
  const telegramUserId = useIdentityStore((s) => s.telegramUserId);

  // Fetch a page of transactions and return how many visible (non-spam) ones were added
  const loadTxns = useCallback(
    async (cursor?: string): Promise<number> => {
      if (!stellarAddress) return 0;
      const isFirst = !cursor;
      isFirst ? setLoading(true) : setLoadingMore(true);
      try {
        const cursorParam = cursor ? `&cursor=${cursor}` : "";
        const res = await fetch(
          `/api/stellar/transactions?address=${stellarAddress}&limit=15${cursorParam}`,
        );
        const j = await res.json();
        if (j.success) {
          const mapped: TxDisplay[] = (j.data.records as HorizonPayment[]).map(
            (r) => mapToDisplay(r, stellarAddress),
          );
          if (isFirst) autoFetchCount.current = 0;
          setAllTxns((prev) => (isFirst ? mapped : [...prev, ...mapped]));
          setNextCursor(j.data.nextCursor ?? null);
          setHasMore(j.data.hasMore ?? false);
          return mapped.filter((t) => !t.isSpam).length;
        }
      } finally {
        isFirst ? setLoading(false) : setLoadingMore(false);
      }
      return 0;
    },
    [stellarAddress],
  );

  // Fetch donations
  const loadDonations = useCallback(async () => {
    if (!stellarAddress) return;
    setDonationsLoading(true);
    try {
      const res = await fetch(`/api/donations?address=${stellarAddress}`, {
        headers: { "x-telegram-init-data": getTelegramInitData() },
      });
      const j = await res.json();
      if (j.success) {
        setDonations(j.data.donations ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setDonationsLoading(false);
    }
  }, [stellarAddress]);

  // Fetch referrals
  const loadReferrals = useCallback(async () => {
    setReferralsLoading(true);
    try {
      const res = await fetch("/api/user/referrals", {
        headers: { "x-telegram-init-data": getTelegramInitData() },
      });
      const j = await res.json();
      if (j.success) {
        setReferralCount(j.data.referralCount ?? 0);
        setReferrals(j.data.referrals ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setReferralsLoading(false);
    }
  }, []);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    if (!stellarAddress || isRefreshing) return;
    haptic.light();
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadTxns(),
        fetch(`/api/stellar/balance?address=${stellarAddress}`)
          .then((r) => r.json())
          .then((j) => {
            if (j.success) setAllBalances(j.data.assets ?? {});
          }),
        fetchAccountInfo(stellarAddress)
          .then(setAccountInfo)
          .catch(() => null),
        checkTrustlines(stellarAddress),
        loadDonations(),
        loadReferrals(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [stellarAddress, isRefreshing, loadTxns, loadDonations, loadReferrals]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return;
    await loadTxns(nextCursor);
  }, [nextCursor, loadTxns]);

  // After initial load: if nothing came back but more pages exist, fetch one more page
  useEffect(() => {
    if (loading || loadingMore || allTxns.length > 0) return;
    if (hasMore && nextCursor && autoFetchCount.current < MAX_AUTO_FETCH) {
      autoFetchCount.current++;
      loadTxns(nextCursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, allTxns.length, hasMore, nextCursor]);

  // Sync team from server on mount
  useEffect(() => {
    fetch("/api/user/team", {
      headers: { "x-telegram-init-data": getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        if (j.data.favoriteTeam) setFavoriteTeam(j.data.favoriteTeam);
      })
      .catch(() => null);
  }, [setFavoriteTeam]);

  // Sync display preference from server on mount
  useEffect(() => {
    fetch("/api/user/display-preference", {
      headers: { "x-telegram-init-data": getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setDisplayPreference(j.data.displayPreference);
      })
      .catch(() => null);
  }, [setDisplayPreference]);

  useEffect(() => {
    if (!stellarAddress) return;
    // Fetch all in parallel; mark page ready when all settle
    Promise.all([
      loadTxns(),
      fetch(`/api/stellar/balance?address=${stellarAddress}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setAllBalances(j.data.assets ?? {});
        }),
      fetchAccountInfo(stellarAddress)
        .then(setAccountInfo)
        .catch(() => null),
      checkTrustlines(stellarAddress),
      loadDonations(),
      loadReferrals(),
    ]).finally(() => setPageReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stellarAddress]); // loadTxns/loadDonations are stable (depends only on stellarAddress) — omit to avoid double-run

  function copyAddress() {
    if (!stellarAddress) return;
    haptic.selection();
    navigator.clipboard.writeText(stellarAddress);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDisconnect() {
    haptic.warning();
    disconnectWallet();
    resetTeams();
    resetIdentity();
    router.push("/");
  }

  async function handleTeamChange(aflTeamId: string, waflTeamId: string | null) {
    haptic.medium();
    setChangingTeam(false);
    try {
      const res = await fetch("/api/user/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTelegramInitData(),
        },
        body: JSON.stringify({ teamId: aflTeamId, waflTeamId }),
      });
      const j = await res.json();
      if (j.success) {
        haptic.success();
        setFavoriteTeam(aflTeamId);
        setFavoriteWaflTeam(waflTeamId);
        toast.success("Teams updated!");
      } else {
        haptic.error();
        toast.error(j.error ?? "Failed to update teams");
      }
    } catch {
      haptic.error();
      toast.error("Failed to update teams — try again");
    }
  }

  async function handleDisplayPreference(
    pref: "address" | "name" | "username",
  ) {
    haptic.selection();
    setDisplayPreference(pref);
    try {
      await fetch("/api/user/display-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTelegramInitData(),
        },
        body: JSON.stringify({ displayPreference: pref }),
      });
    } catch {
      toast.error("Failed to save preference — try again");
    }
  }

  const short = stellarAddress
    ? `${stellarAddress.slice(0, 8)}...${stellarAddress.slice(-6)}`
    : "";

  const visibleTxns = hideSpam ? allTxns.filter((t) => !t.isSpam) : allTxns;
  const spamCount = allTxns.filter((t) => t.isSpam).length;

  // Compute tier from stored balance
  const tokenBal = parseFloat(
    allBalances[PRIMARY_CUSTOM_ASSET_CODE] ?? tokenBalance ?? "0",
  );
  const currentTier = getTierForBalance(tokenBal);

  // Accordion state
  const [openSection, setOpenSection] = useState<string | null>("referrals");
  function toggleSection(id: string) {
    haptic.light();
    setOpenSection((prev) => (prev === id ? null : id));
  }

  // Donation totals
  const totalDonated = donations.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const displayedDonations = showAllDonations
    ? donations
    : donations.slice(0, 5);

  // Referral link — resolve tgId from multiple sources
  const botUsername = BRANDING.botUsername;
  const tgId = liveTgUser?.id ?? telegramUserId;
  const referralLink = tgId ? buildReferralLink(tgId) : "";
  const displayedReferrals = showAllReferrals
    ? referrals
    : referrals.slice(0, 5);

  function copyReferralLink() {
    if (!referralLink) return;
    haptic.light();
    navigator.clipboard.writeText(referralLink);
    setReferralLinkCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setReferralLinkCopied(false), 2000);
  }

  function shareReferralLinkHandler() {
    haptic.medium();
    shareReferralLink(referralLink, getPackCopy<string>('referralShareText') ?? undefined);
  }

  // ── Pull-to-refresh touch tracking ──────────────────────────────────────
  const touchStartYRef = useRef<number | null>(null);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartYRef.current === null) return;
    const delta = (e.changedTouches[0]?.clientY ?? 0) - touchStartYRef.current;
    touchStartYRef.current = null;
    const scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    if (delta > 60 && scrollTop <= 0 && !isRefreshing) {
      haptic.medium();
      void handleRefresh();
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!showPage) {
    return (
      <WalletGuard>
        <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-background-dark border-b border-white/10">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-lg glass-card flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-white">
                arrow_back
              </span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Profile
              </h1>
              <p className="text-sm text-primary font-medium">
                Stellar Network
              </p>
            </div>
          </div>
        </header>
        <PageLoader label="Loading your profile…" />
        <BottomNav />
      </WalletGuard>
    );
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-background-dark border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition"
            >
              <span className="material-symbols-outlined text-white text-lg">
                arrow_back
              </span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Profile
              </h1>
              <p className="text-xs text-primary font-medium">
                {tgUser?.username ? `@${tgUser.username}` : "Stellar Network"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-8 h-8 rounded-lg glass-card flex items-center justify-center border border-white/10 hover:bg-white/10 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <span
                className={`material-symbols-outlined text-primary text-base ${isRefreshing ? "animate-spin" : ""}`}
                style={isRefreshing ? { animationDuration: "0.8s" } : undefined}
              >
                refresh
              </span>
            </button>
            {/* Logout button */}
            <button
              onClick={handleDisconnect}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition"
            >
              <span className="material-symbols-outlined text-red-400 text-sm">
                logout
              </span>
              <span className="text-xs font-semibold text-red-400">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className="px-4 py-4 space-y-4 pb-28"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Pull-to-refresh spinner ──────────────────────────────── */}
        {isRefreshing && (
          <div className="flex items-center justify-center py-1 space-x-2">
            <span
              className="material-symbols-outlined text-primary text-base animate-spin"
              style={{ animationDuration: "0.7s" }}
            >
              refresh
            </span>
            <span className="text-[11px] text-gray-400">Refreshing…</span>
          </div>
        )}

        {/* ── Combined Identity + Team Card ─────────────────────────────── */}
        {(() => {
          const club = favoriteTeam
            ? ALL_CLUBS.find((c) => c.id === favoriteTeam)
            : null;
          return (
            <div className="glass-card p-4 rounded-2xl border-t-2 border-t-primary/40 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-primary/10 rounded-full blur-3xl" />
              <div className="flex items-start relative z-10">
                {/* Left: Avatar + identity */}
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {tgUser ? (
                    <TelegramAvatar
                      photoUrl={tgUser.photoUrl}
                      name={tgUser.firstName}
                      size={48}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-xl">
                        person
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {tgUser && (
                      <>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h2 className="text-sm font-bold text-white truncate">
                            {tgUser.firstName}
                            {tgUser.lastName ? ` ${tgUser.lastName}` : ""}
                          </h2>
                          <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30 uppercase">
                            Active
                          </span>
                          {PARTNER_CLUB.enabled && favoriteTeam === PARTNER_CLUB.id && (
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase" style={{ background: 'rgba(232,25,44,0.15)', color: PARTNER_CLUB.color, border: '1px solid rgba(232,25,44,0.35)' }}>
                              <img src={PARTNER_CLUB.logo} alt="" width={10} height={10} className="rounded-full object-cover" />
                              {PARTNER_CLUB.shortName}
                            </span>
                          )}
                        </div>
                        {tgUser.username && (
                          <p className="text-xs text-primary font-medium">
                            @{tgUser.username}
                          </p>
                        )}
                      </>
                    )}
                    <div className="flex items-center space-x-1 mt-0.5">
                      <span className="material-symbols-outlined text-[11px] text-blue-400">
                        send
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                        Telegram Member
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Club logos + change button */}
                <div className="flex flex-col items-center flex-shrink-0 ml-3 gap-1">
                  <div className="flex items-center gap-1.5">
                    {club ? (
                      <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                        <img src={club.logo} alt={club.name} width={36} height={36} className="object-contain" />
                        <p className="text-[8px] font-semibold text-gray-300 text-center mt-0.5 leading-tight" style={{ maxWidth: 44 }}>{club.shortName}</p>
                        <span className="text-[7px] text-primary font-bold uppercase">AFL</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-500 text-base">stadium</span>
                        </div>
                        <span className="text-[7px] text-gray-500 font-bold uppercase mt-0.5">AFL</span>
                      </div>
                    )}
                    {(() => {
                      const waflClub = favoriteWaflTeam ? ALL_CLUBS.find((c) => c.id === favoriteWaflTeam) : null
                      return waflClub ? (
                        <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                          {waflClub.logo ? (
                            <img src={waflClub.logo} alt={waflClub.name} width={36} height={36} className="object-contain" />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[9px]" style={{ background: waflClub.color }}>{waflClub.shortName}</div>
                          )}
                          <p className="text-[8px] font-semibold text-gray-300 text-center mt-0.5 leading-tight" style={{ maxWidth: 44 }}>{waflClub.shortName}</p>
                          <span className="text-[7px] text-blue-400 font-bold uppercase">WAFL</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 border-dashed flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-600 text-base">add</span>
                          </div>
                          <span className="text-[7px] text-gray-600 font-bold uppercase mt-0.5">WAFL</span>
                        </div>
                      )
                    })()}
                  </div>
                  {favoriteTeam ? (
                    <button
                      onClick={() => { haptic.light(); setChangingTeam(true); }}
                      className="flex items-center space-x-0.5 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition text-[9px] font-semibold text-gray-400 hover:text-white"
                    >
                      <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                      <span>Change</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { haptic.light(); router.push("/"); }}
                      className="text-[9px] font-semibold text-primary underline"
                    >
                      Pick teams
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Referrals (unified card) ───────────────────────────────────── */}
        {botUsername && (
          <div className="glass-card rounded-2xl border border-primary/20 relative overflow-hidden">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-base">
                      group_add
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Invite Friends
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      Get balls, spins &amp; XLM rewards
                    </p>
                  </div>
                </div>
                {referralCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">
                    {referralCount} joined
                  </span>
                )}
              </div>

              {/* Link row */}
              <div className="flex items-center space-x-2 bg-black/30 px-3 py-2 rounded-xl border border-primary/15">
                <span className="material-symbols-outlined text-primary text-[13px] flex-shrink-0">
                  link
                </span>
                <span className="text-[11px] font-mono text-gray-300 flex-1 truncate">
                  {referralLink || `https://t.me/${botUsername}?start=ref_…`}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={copyReferralLink}
                  disabled={!referralLink}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl border border-white/15 bg-white/5 transition disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-gray-300 text-sm">
                    {referralLinkCopied ? "check" : "content_copy"}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-300">
                    {referralLinkCopied ? "Copied!" : "Copy Link"}
                  </span>
                </button>
                <button
                  onClick={shareReferralLinkHandler}
                  disabled={!referralLink}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl border border-primary/40 bg-primary/10 transition disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-primary text-sm">
                    share
                  </span>
                  <span className="text-[11px] font-semibold text-primary">
                    Share
                  </span>
                </button>
              </div>

              {/* Referral list or empty state */}
              {referralsLoading ? (
                <div className="flex items-center justify-center py-3 space-x-2 border-t border-white/5 pt-3">
                  <span
                    className="material-symbols-outlined text-primary text-base animate-spin"
                    style={{ animationDuration: "0.8s" }}
                  >
                    progress_activity
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Loading referrals…
                  </span>
                </div>
              ) : referralCount === 0 ? (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        icon: "casino",
                        label: "+1 Spin/day",
                        desc: "Per friend you bring",
                      },
                      {
                        icon: "sports_football",
                        label: "+1 Lucky Ball",
                        desc: "Unlock Lucky Draw faster",
                      },
                      {
                        icon: "currency_exchange",
                        label: `+${currentTier.rewards?.xlmRefundPct ?? 20}% XLM`,
                        desc: "On their deposit",
                      },
                    ].map(({ icon, label, desc }) => (
                      <div
                        key={icon}
                        className="flex flex-col items-center py-2.5 px-1.5 rounded-xl bg-primary/5 border border-primary/15 text-center"
                      >
                        <span className="material-symbols-outlined text-primary text-lg mb-1">
                          {icon}
                        </span>
                        <p className="text-[10px] font-bold text-white leading-tight">
                          {label}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          {desc}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 text-center">
                    No referrals yet — share your link to get started
                  </p>
                </div>
              ) : (
                <div className="border-t border-white/5 pt-3 space-y-1">
                  <div className="divide-y divide-white/5">
                    {displayedReferrals.map((r, i) => {
                      const name =
                        r.telegram_first_name ??
                        r.telegram_username ??
                        "Anonymous";
                      const handle = r.telegram_username
                        ? `@${r.telegram_username}`
                        : null;
                      const joinDate = r.created_at
                        ? new Date(r.created_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "";
                      return (
                        <div
                          key={i}
                          className="py-2 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary text-[11px] font-bold">
                                {name[0]?.toUpperCase() ?? "?"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-white font-medium truncate">
                                {name}
                              </p>
                              {handle && (
                                <p className="text-[10px] text-primary truncate">
                                  {handle}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-[9px] text-gray-500 flex-shrink-0 ml-2">
                            {joinDate}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {referrals.length > 5 && (
                    <button
                      onClick={() => {
                        haptic.light();
                        setShowAllReferrals((v) => !v);
                      }}
                      className="w-full text-center text-[10px] text-primary hover:underline py-1"
                    >
                      {showAllReferrals
                        ? "Show less"
                        : `View all ${referrals.length} referrals`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Wallet Card ────────────────────────────────────────────────── */}
        <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-3">
            {/* Address row — tap the copy icon to copy the full address */}
            <div className="flex items-center space-x-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5">
              <span className="material-symbols-outlined text-[14px] text-gray-500">
                account_balance_wallet
              </span>
              <span className="text-xs font-mono text-gray-300 flex-1 truncate">
                {short}
              </span>
              <button
                onClick={copyAddress}
                className="text-gray-400 hover:text-primary transition flex-shrink-0"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            </div>

            {/* Home domain — set by the account owner on Stellar */}
            {accountInfo?.homeDomain && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <span className="material-symbols-outlined text-[15px] text-primary">
                  language
                </span>
                <span className="text-xs text-primary font-medium">
                  {accountInfo.homeDomain}
                </span>
                <span className="text-[10px] text-gray-500 ml-auto">
                  Home Domain
                </span>
              </div>
            )}

            {/* Asset balances — main assets */}
            <div className="space-y-2">
              {SHOWN_ASSET_CONFIGS.filter(cfg => !REWARD_ASSETS.some(r => r.code === cfg.code)).map((cfg) => {
                const bal =
                  allBalances[cfg.code] ??
                  (cfg.code === "XLM" ? xlmBalance : tokenBalance);
                const isPrimary = cfg.code !== "XLM";
                return (
                  <div
                    key={cfg.code}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${isPrimary ? "bg-primary/5 border-primary/20" : "bg-white/5 border-white/10"}`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPrimary ? "bg-primary/20" : "bg-white/10"}`}>
                        <span className={`material-symbols-outlined text-[14px] ${isPrimary ? "text-primary" : "text-gray-300"}`}>
                          {isPrimary ? "token" : "currency_exchange"}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${isPrimary ? "text-primary" : "text-gray-300"}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white">{bal}</span>
                  </div>
                );
              })}

              {/* Prize assets — balance shown if trustline active, otherwise "No trustline" */}
              <div className="pt-1 pb-0.5 flex items-center justify-between">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest font-semibold">Prize Assets</p>
                <Link href="/trustlines" className="text-[9px] text-primary/60 hover:text-primary transition">Manage →</Link>
              </div>
              {REWARD_ASSETS.filter(a => a.issuer).map(a => {
                const status = trustlineStatuses[a.code];
                const checking = status === null;
                const has = status === true;
                const bal = rewardBalances[a.code];
                return (
                  <div
                    key={a.code}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                    style={{
                      borderColor: has ? 'rgba(74,222,128,0.25)' : checking ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)',
                      background: has ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5">
                        {checking ? (
                          <span className="material-symbols-outlined text-gray-500 text-[13px] animate-spin">progress_activity</span>
                        ) : has ? (
                          <span className="material-symbols-outlined text-green-400 text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined text-yellow-400 text-[13px]">link_off</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${has ? 'text-green-300' : 'text-gray-400'}`}>{a.code}</span>
                    </div>
                    {checking ? (
                      <span className="text-[11px] text-gray-600">—</span>
                    ) : has ? (
                      <span className="text-sm font-bold text-white">{bal}</span>
                    ) : (
                      <Link href="/trustlines" className="text-[10px] text-yellow-400 hover:text-yellow-300 transition font-semibold">
                        Add trustline →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Quick Stats Row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 rounded-xl text-center">
            <span className="material-symbols-outlined text-primary text-lg">
              receipt_long
            </span>
            <p className="text-lg font-bold text-white mt-0.5">
              {allTxns.length}
            </p>
            <p className="text-[10px] text-gray-400">Txns Loaded</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <span className="material-symbols-outlined text-gray-400 text-lg">
              block
            </span>
            <p className="text-lg font-bold text-white mt-0.5">{spamCount}</p>
            <p className="text-[10px] text-gray-400">Spam Filtered</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <span className="material-symbols-outlined text-blue-400 text-lg">
              link
            </span>
            <p className="text-lg font-bold text-white mt-0.5">
              {accountInfo?.subentryCount ?? "—"}
            </p>
            <p className="text-[10px] text-gray-400">Trustlines</p>
          </div>
        </div>

        {/* ── My Donations (accordion) ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Accordion header */}
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            onClick={() => toggleSection("donations")}
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-base">
                volunteer_activism
              </span>
              <h3 className="text-sm font-bold text-white">My Donations</h3>
              {totalDonated > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">
                  {totalDonated.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {PRIMARY_CUSTOM_ASSET_CODE}
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-gray-400 text-lg">
              {openSection === "donations" ? "expand_less" : "expand_more"}
            </span>
          </button>

          {/* Expanded content */}
          {openSection === "donations" && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              <div className="flex items-center justify-between pt-3">
                <span className="text-[11px] text-gray-400">
                  {donations.length === 0
                    ? "No donations yet"
                    : `${donations.length} donation${donations.length !== 1 ? "s" : ""}`}
                </span>
                <button
                  onClick={() => {
                    haptic.light();
                    router.push("/donate");
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition"
                >
                  <span className="material-symbols-outlined text-primary text-[12px]">
                    favorite
                  </span>
                  <span className="text-[10px] font-semibold text-primary">
                    Donate
                  </span>
                </button>
              </div>

              {donationsLoading ? (
                <div className="flex items-center justify-center py-3 space-x-2">
                  <span
                    className="material-symbols-outlined text-primary text-base animate-spin"
                    style={{ animationDuration: "0.8s" }}
                  >
                    progress_activity
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Loading donations…
                  </span>
                </div>
              ) : donations.length === 0 ? (
                <div className="flex flex-col items-center py-3 space-y-1">
                  <span className="material-symbols-outlined text-gray-600 text-xl">
                    volunteer_activism
                  </span>
                  <p className="text-[11px] text-gray-500">No donations yet</p>
                </div>
              ) : (
                <>
                  {/* Total donated */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/8 border border-primary/20">
                    <span className="text-[11px] text-gray-400">
                      Total donated
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {totalDonated.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      {PRIMARY_CUSTOM_ASSET_CODE}
                    </span>
                  </div>

                  {/* Donation list */}
                  <div className="divide-y divide-white/5">
                    {displayedDonations.map((d) => (
                      <div
                        key={d.id}
                        className="py-2 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span
                            className={`material-symbols-outlined text-sm flex-shrink-0 ${d.verified ? "text-green-400" : "text-gray-500"}`}
                          >
                            {d.verified ? "verified" : "schedule"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-white font-medium truncate">
                              {d.donation_target ?? "General"}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {new Date(d.created_at).toLocaleDateString(
                                "en-AU",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-xs font-bold text-primary">
                            {d.amount} {d.asset_code}
                          </p>
                          {!d.verified && (
                            <p className="text-[9px] text-gray-500">Pending</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* View all toggle */}
                  {donations.length > 5 && (
                    <button
                      onClick={() => {
                        haptic.light();
                        setShowAllDonations((v) => !v);
                      }}
                      className="w-full text-center text-[10px] text-primary hover:underline py-1"
                    >
                      {showAllDonations
                        ? "Show less"
                        : `View all ${donations.length} donations`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Public Identity (accordion) ───────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Accordion header */}
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            onClick={() => toggleSection("identity")}
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-base">
                shield_person
              </span>
              <h3 className="text-sm font-bold text-white">Public Identity</h3>
              {displayPreference && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-gray-300 border border-white/15 capitalize">
                  {displayPreference}
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-gray-400 text-lg">
              {openSection === "identity" ? "expand_less" : "expand_more"}
            </span>
          </button>

          {/* Expanded content */}
          {openSection === "identity" && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                How you appear in leaderboards and community stats. By default
                your identity is hidden.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      value: "address",
                      label: "Address",
                      icon: "account_balance_wallet",
                      preview: stellarAddress
                        ? `${stellarAddress.slice(0, 4)}…${stellarAddress.slice(-4)}`
                        : "G…XXXX",
                    },
                    {
                      value: "name",
                      label: "Name",
                      icon: "person",
                      preview: tgUser?.firstName ?? "First name",
                    },
                    {
                      value: "username",
                      label: "Username",
                      icon: "alternate_email",
                      preview: tgUser?.username
                        ? `@${tgUser.username}`
                        : "No username",
                    },
                  ] as const
                ).map(({ value, label, icon, preview }) => {
                  const active = displayPreference === value;
                  const unavailable = value === "username" && !tgUser?.username;
                  return (
                    <button
                      key={value}
                      disabled={unavailable}
                      onClick={() => handleDisplayPreference(value)}
                      className={`flex flex-col items-center p-2.5 rounded-xl border transition text-center ${
                        active
                          ? "bg-primary/15 border-primary/50"
                          : unavailable
                            ? "bg-white/2 border-white/5 opacity-40 cursor-not-allowed"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${active ? "text-primary" : "text-gray-400"}`}
                      >
                        {icon}
                      </span>
                      <span
                        className={`text-[10px] font-semibold mt-0.5 ${active ? "text-primary" : "text-gray-300"}`}
                      >
                        {label}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-0.5 truncate w-full">
                        {preview}
                      </span>
                      {active && (
                        <span className="material-symbols-outlined text-primary text-xs mt-0.5">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Transaction History ────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1.5">
              <span className="material-symbols-outlined text-primary text-base">
                receipt_long
              </span>
              <h3 className="text-sm font-bold text-white">Transactions</h3>
              <span className="text-[10px] text-gray-500">
                ({visibleTxns.length})
              </span>
            </div>
            <button
              onClick={() => setHideSpam((v) => !v)}
              className={`flex items-center space-x-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${
                hideSpam
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">
                {hideSpam ? "filter_alt" : "filter_alt_off"}
              </span>
              <span>{hideSpam ? "Show all" : `Hide spam (${spamCount})`}</span>
            </button>
          </div>

          {loading ? (
            <div className="glass-card p-6 rounded-xl flex flex-col items-center justify-center space-y-2">
              <span
                className="material-symbols-outlined text-primary drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                style={{
                  fontSize: 32,
                  fontVariationSettings: "'FILL' 1",
                  animation: "football-throw 1.4s ease-in-out infinite",
                }}
              >
                sports_football
              </span>
              <p className="text-[10px] text-gray-500">
                Fetching transactions...
              </p>
            </div>
          ) : visibleTxns.length === 0 ? (
            <div className="glass-card p-6 rounded-xl text-center space-y-2">
              <span className="material-symbols-outlined text-gray-500 text-2xl">
                receipt_long
              </span>
              <p className="text-gray-400 text-xs">No transactions to show</p>
              {hideSpam && spamCount > 0 && (
                <button
                  onClick={() => setHideSpam(false)}
                  className="text-primary text-[10px] underline"
                >
                  Show {spamCount} filtered transaction
                  {spamCount > 1 ? "s" : ""}
                </button>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/5">
              {visibleTxns.map((tx) => {
                const counterparty = tx.isIncoming ? tx.raw.from : tx.raw.to;
                const { label: counterpartyLabel, isNamed } = counterparty
                  ? getCounterpartyLabel(counterparty)
                  : { label: "", isNamed: false };

                return (
                  <div
                    key={tx.id}
                    className={`px-3 py-2.5 flex items-center justify-between ${
                      tx.isSpam ? "opacity-35" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          tx.isSpam
                            ? "bg-gray-500/10"
                            : tx.isIncoming
                              ? "bg-green-500/10"
                              : "bg-red-500/10"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[14px] ${
                            tx.isSpam
                              ? "text-gray-500"
                              : tx.isIncoming
                                ? "text-green-400"
                                : "text-red-400"
                          }`}
                        >
                          {tx.isSpam
                            ? "block"
                            : tx.isIncoming
                              ? "south_west"
                              : "north_east"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-semibold text-white">
                            {tx.label}
                          </span>
                          {tx.isSpam && (
                            <span className="text-[8px] px-1 py-px rounded bg-gray-500/20 text-gray-400 uppercase font-bold">
                              Spam
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 mt-px">
                          {counterpartyLabel && (
                            <span
                              className={`text-[9px] font-mono ${isNamed ? "text-primary font-semibold" : "text-gray-500"}`}
                            >
                              {counterpartyLabel}
                            </span>
                          )}
                          <span className="text-[9px] text-gray-600">
                            {tx.date}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                      <div className="text-right">
                        <p
                          className={`text-xs font-bold ${
                            tx.isSpam
                              ? "text-gray-500"
                              : tx.isIncoming
                                ? "text-green-400"
                                : "text-white"
                          }`}
                        >
                          {tx.isIncoming ? "+" : "-"}
                          {tx.amount}
                        </p>
                      </div>
                      {/* Stellar expert link */}
                      <button
                        onClick={() => {
                          haptic.light();
                          window.open(
                            `https://stellar.expert/explorer/public/tx/${tx.id}`,
                            "_blank",
                          );
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition flex-shrink-0"
                        aria-label="View on Stellar Expert"
                      >
                        <span className="material-symbols-outlined text-gray-500 hover:text-primary text-[13px] transition">
                          open_in_new
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full glass-card border border-white/10 rounded-xl py-2.5 flex items-center justify-center space-x-2 hover:bg-white/5 transition text-xs text-gray-300 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <span className="material-symbols-outlined text-primary text-sm animate-spin">
                    progress_activity
                  </span>
                  <span>Loading…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-gray-400 text-sm">
                    expand_more
                  </span>
                  <span>Load more transactions</span>
                </>
              )}
            </button>
          )}

          {!hasMore && allTxns.length > 0 && (
            <p className="text-center text-[10px] text-gray-600 py-1">
              All transactions loaded
            </p>
          )}
        </div>
      </main>
      <BottomNav />

      {/* ── Full-screen team change overlay ─────────────────────── */}
      {changingTeam && (
        <div className="fixed inset-0 z-[100] bg-background-dark overflow-y-auto">
          <button
            onClick={() => setChangingTeam(false)}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl glass-card flex items-center justify-center border border-white/10 hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-white text-lg">
              close
            </span>
          </button>
          <TeamSelectScreen onSelect={handleTeamChange} />
        </div>
      )}
    </WalletGuard>
  );
}

export default function ProfilePage() {
  const hasEnabledDomain = (['sports', 'stellar-wallet', 'rewards', 'donations'] as const).some(isPackEnabled)

  if (!hasEnabledDomain) {
    return (
      <main aria-label="Profile" className="min-h-screen bg-background-dark px-4 py-8">
        <section className="bg-white/[0.03] backdrop-blur-[12px] border border-white/10 rounded-2xl p-5 text-center">
          <span className="material-symbols-outlined text-primary text-3xl">person</span>
          <h1 className="mt-3 font-serif text-xl font-bold text-white">Profile</h1>
          <p className="mt-2 text-sm text-gray-400">Profile features are unavailable in this app configuration.</p>
        </section>
        <BottomNav />
      </main>
    )
  }

  return <FullProfilePage />
}
