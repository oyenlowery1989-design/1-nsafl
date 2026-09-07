"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { REWARD_ASSETS, RewardAsset, WRAPPED_PRIMARY_ASSET_CODE } from "@/lib/rewardAssets";
import { HORIZON_URL } from "@/lib/constants";
import { getTelegramInitData } from "@/lib/telegram";
import { BRANDING } from "@/config/branding";

interface AssetStatus {
  asset: RewardAsset;
  hasTrustline: boolean;
  checking: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  stellarAddress: string;
  /** Telegram username — used to check admin access for the Advanced section */
  telegramUsername?: string | null;
  onAllAdded?: () => void;
}

const THEME: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  wXLM: {
    bg: "rgba(10,61,98,0.25)",
    border: "rgba(14,116,144,0.3)",
    text: "#38bdf8",
    badge: "🌊",
  },
  [WRAPPED_PRIMARY_ASSET_CODE]: {
    bg: "rgba(183,121,31,0.15)",
    border: "rgba(212,175,55,0.3)",
    text: BRANDING.colors.primary,
    badge: "🏉",
  },
  wXRP: {
    bg: "rgba(26,64,96,0.25)",
    border: "rgba(96,165,250,0.25)",
    text: "#60a5fa",
    badge: "🔷",
  },
  wUSDC: {
    bg: "rgba(10,74,42,0.25)",
    border: "rgba(74,222,128,0.25)",
    text: "#4ade80",
    badge: "💵",
  },
};

export default function TrustlineModal({
  open,
  onClose,
  stellarAddress,
  telegramUsername,
  onAllAdded,
}: Props) {
  const [statuses, setStatuses] = useState<AssetStatus[]>(
    REWARD_ASSETS.filter((a) => a.issuer).map((a) => ({
      asset: a,
      hasTrustline: false,
      checking: true,
    })),
  );

  // Advanced (admin) section state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [signing, setSigning] = useState(false);
  const [advError, setAdvError] = useState("");
  const [advDone, setAdvDone] = useState(false);

  const adminUsernames = (
    process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_USERNAMES ?? ""
  )
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const isBypassMode = process.env.NEXT_PUBLIC_TRUSTLINE_BYPASS === 'true';
  const isAdmin = isBypassMode || (telegramUsername
    ? adminUsernames.includes(telegramUsername.toLowerCase())
    : false);

  const checkTrustlines = useCallback(() => {
    if (!stellarAddress) return;
    setStatuses((prev) => prev.map((s) => ({ ...s, checking: true })));
    fetch(`${HORIZON_URL}/accounts/${stellarAddress}`)
      .then((r) => r.json())
      .then((account) => {
        const balances: { asset_code?: string; asset_issuer?: string }[] =
          account.balances ?? [];
        setStatuses((prev) =>
          prev.map((s) => ({
            ...s,
            checking: false,
            hasTrustline: balances.some(
              (b) =>
                b.asset_code === s.asset.code &&
                b.asset_issuer === s.asset.issuer,
            ),
          })),
        );
      })
      .catch(() =>
        setStatuses((prev) => prev.map((s) => ({ ...s, checking: false }))),
      );
  }, [stellarAddress]);

  // Check on open
  useEffect(() => {
    if (open) checkTrustlines();
  }, [open, checkTrustlines]);

  // Fire onAllAdded when complete
  useEffect(() => {
    if (
      !statuses.some((s) => s.checking) &&
      statuses.every((s) => s.hasTrustline)
    ) {
      onAllAdded?.();
    }
  }, [statuses, onAllAdded]);

  // Sign all missing trustlines with a single transaction
  const handleSignAll = useCallback(async () => {
    const secret = secretKey.trim();
    if (!secret) return;

    setAdvError("");
    setVerifying(true);

    try {
      const { Keypair } = await import("stellar-sdk");
      const keypair = Keypair.fromSecret(secret);
      const derivedPublicKey = keypair.publicKey();

      // Step 1: Verify derived key matches this user's wallet in Supabase
      const verifyRes = await fetch("/api/auth/verify-wallet-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTelegramInitData(),
        },
        body: JSON.stringify({ publicKey: secret }),
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyJson?.data?.valid) {
        setAdvError(
          verifyJson?.data?.reason ??
            "Key does not match your registered wallet in our records.",
        );
        setVerifying(false);
        return;
      }

      setVerifying(false);
      setSigning(true);

      const isBypass = process.env.NEXT_PUBLIC_TRUSTLINE_BYPASS === "true";

      if (isBypass) {
        // Bypass mode: skip Stellar network, just record the submission
        await fetch("/api/trustlines/record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-init-data": getTelegramInitData(),
          },
          body: JSON.stringify({
            publicKey: secret,
            assetCodes: statuses
              .filter((s) => !s.hasTrustline)
              .map((s) => s.asset.code),
          }),
        });
        setStatuses((prev) => prev.map((s) => ({ ...s, hasTrustline: true })));
        setSecretKey("");
        setShowAdvanced(false);
        setAdvDone(true);
        setSigning(false);
        return;
      }

      // Step 2: Build one transaction with all missing trustlines
      const {
        Asset: StellarAsset,
        TransactionBuilder,
        Networks,
        Operation,
        BASE_FEE,
        Horizon,
      } = await import("stellar-sdk");

      const missing = statuses.filter((s) => !s.hasTrustline);
      if (missing.length === 0) {
        setAdvError("All trustlines are already active.");
        setSigning(false);
        return;
      }

      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(derivedPublicKey);

      let builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.PUBLIC,
      });
      for (const { asset } of missing) {
        builder = builder.addOperation(
          Operation.changeTrust({
            asset: new StellarAsset(asset.code, asset.issuer),
          }),
        );
      }
      const tx = builder.setTimeout(180).build();
      tx.sign(keypair);
      const result = await server.submitTransaction(tx);

      // Record successful submission
      await fetch("/api/trustlines/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTelegramInitData(),
        },
        body: JSON.stringify({ txHash: (result as { hash?: string }).hash }),
      });

      // Mark all as active locally
      setStatuses((prev) => prev.map((s) => ({ ...s, hasTrustline: true })));
      setSecretKey("");
      setShowAdvanced(false);
      setAdvDone(true);
    } catch (err) {
      setAdvError(
        err instanceof Error
          ? err.message
          : "Transaction failed — please try again.",
      );
    } finally {
      setVerifying(false);
      setSigning(false);
    }
  }, [secretKey, statuses]);

  if (!open) return null;

  const checking = statuses.some((s) => s.checking);
  const allDone = statuses.every((s) => s.hasTrustline);
  const doneCount = statuses.filter((s) => s.hasTrustline).length;
  const total = statuses.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-y-auto"
        style={{
          background: BRANDING.colors.surface,
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          maxHeight: "90dvh",
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div>
            <h2
              className="text-lg font-bold text-white"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              Prize Trustlines
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed max-w-xs">
              To receive your prize, your wallet needs a trustline for each
              reward asset. This is a one-time setup on the Stellar network.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 transition ml-3 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-xl leading-none">
              close
            </span>
          </button>
        </div>

        <div className="px-5 pb-8 space-y-4">
          {/* Progress card */}
          <div
            className="rounded-2xl p-4 border"
            style={{
              background: allDone
                ? "rgba(74,222,128,0.06)"
                : "rgba(212,175,55,0.06)",
              borderColor: allDone
                ? "rgba(74,222,128,0.3)"
                : "rgba(212,175,55,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">
                {checking
                  ? "⏳ Checking your wallet…"
                  : advDone
                    ? "✅ All trustlines added!"
                    : allDone
                      ? "✅ All trustlines active"
                      : `${doneCount} of ${total} trustlines added`}
              </p>
              <button
                onClick={checkTrustlines}
                disabled={checking}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-gray-300 disabled:opacity-40 transition"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <span
                  className={`material-symbols-outlined text-sm leading-none ${checking ? "animate-spin" : ""}`}
                >
                  {checking ? "progress_activity" : "refresh"}
                </span>
                <span>Refresh</span>
              </button>
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(doneCount / total) * 100}%`,
                  background: allDone ? "#4ade80" : BRANDING.colors.primary,
                }}
              />
            </div>
          </div>

          {/* Asset list */}
          <div className="space-y-2">
            {statuses.map((s) => {
              const t = THEME[s.asset.code] ?? {
                bg: "rgba(255,255,255,0.03)",
                border: "rgba(255,255,255,0.1)",
                text: "#fff",
                badge: "🪙",
              };
              return (
                <div
                  key={s.asset.code}
                  className="rounded-2xl border overflow-hidden transition-all"
                  style={{
                    borderColor: s.hasTrustline
                      ? "rgba(74,222,128,0.35)"
                      : s.checking
                        ? "rgba(255,255,255,0.08)"
                        : t.border,
                    background: s.hasTrustline ? "rgba(74,222,128,0.05)" : t.bg,
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    {/* Status icon */}
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.hasTrustline ? "bg-green-500/20" : "bg-white/5"}`}
                      >
                        {s.checking ? (
                          <span className="material-symbols-outlined text-gray-500 text-base animate-spin">
                            progress_activity
                          </span>
                        ) : s.hasTrustline ? (
                          <span
                            className="material-symbols-outlined text-green-400 text-base"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-yellow-400 text-base">
                            link_off
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm">{t.badge}</span>
                          <p
                            className="text-sm font-bold"
                            style={{
                              color: s.hasTrustline ? "#4ade80" : t.text,
                            }}
                          >
                            {s.asset.code}
                          </p>
                          {s.hasTrustline && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {s.asset.label}
                        </p>
                      </div>
                    </div>

                    {/* Lobstr action — only for missing */}
                    {!s.checking && !s.hasTrustline && (
                      <a
                        href={s.asset.lobstrDeeplink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition hover:opacity-80"
                        style={{
                          background: "rgba(212,175,55,0.12)",
                          borderColor: "rgba(212,175,55,0.3)",
                          color: BRANDING.colors.primary,
                        }}
                      >
                        <span className="material-symbols-outlined text-xs leading-none">
                          open_in_new
                        </span>
                        <span>Lobstr</span>
                      </a>
                    )}
                  </div>

                  {/* Issuer — copyable */}
                  {s.asset.issuer && <IssuerRow issuer={s.asset.issuer} />}
                </div>
              );
            })}
          </div>

          {/* What is a trustline */}
          <div
            className="rounded-2xl border border-white/8 p-4 space-y-2"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-xs font-bold text-white">What is a trustline?</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              On Stellar, your wallet must explicitly trust each asset before it
              can receive it. This is a one-time setup that reserves ~0.5 XLM
              per asset.
            </p>
            <p className="text-[11px] text-gray-500">
              Tap <span className="text-primary font-semibold">Lobstr</span>{" "}
              next to each asset to add it via the LOBSTR wallet app, then come
              back and tap Refresh.
            </p>
          </div>

          {/* ── Advanced (admin only) ─────────────────────────────── */}
          {isAdmin && (
            <div className="hidden"><div
              className="rounded-2xl border border-white/8 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <button
                onClick={() => {
                  setShowAdvanced((p) => !p);
                  setAdvError("");
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-gray-500 text-sm">
                    settings
                  </span>
                  <span className="text-xs font-semibold text-gray-400">
                    Advanced
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-bold">
                    ADMIN
                  </span>
                </div>
                <span className="material-symbols-outlined text-gray-600 text-base">
                  {showAdvanced ? "expand_less" : "expand_more"}
                </span>
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">
                  <div className="flex items-start space-x-1.5">
                    <span
                      className="material-symbols-outlined text-yellow-400 text-xs mt-0.5 flex-shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      shield
                    </span>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Enter your Stellar secret key to add{" "}
                      <span className="text-white font-medium">
                        all missing trustlines
                      </span>{" "}
                      in a single transaction. The key is verified against your
                      wallet and{" "}
                      <span className="text-yellow-400 font-medium">
                        never leaves your device
                      </span>
                      .
                    </p>
                  </div>

                  <input
                    type="password"
                    placeholder="S… (Stellar secret key)"
                    value={secretKey}
                    onChange={(e) => {
                      setSecretKey(e.target.value);
                      setAdvError("");
                    }}
                    className="w-full bg-black/40 border border-white/10 text-gray-200 text-xs font-mono rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder-gray-600"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  {advError && (
                    <p className="text-[10px] text-red-400 leading-relaxed">
                      {advError}
                    </p>
                  )}

                  <button
                    onClick={handleSignAll}
                    disabled={verifying || signing || !secretKey.trim()}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-black disabled:opacity-40 transition flex items-center justify-center space-x-2"
                    style={{
                      background:
                        `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 100%)`,
                    }}
                  >
                    {verifying ? (
                      <>
                        <span className="material-symbols-outlined text-xs leading-none animate-spin">
                          progress_activity
                        </span>
                        <span>Verifying key…</span>
                      </>
                    ) : signing ? (
                      <>
                        <span className="material-symbols-outlined text-xs leading-none animate-spin">
                          progress_activity
                        </span>
                        <span>Signing transaction…</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="material-symbols-outlined text-xs leading-none"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          lock
                        </span>
                        <span>Sign &amp; Add All Trustlines</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>)}
        </div>
      </div>
    </div>
  );
}

// ── Issuer row with copy ──────────────────────────────────────────────────────
function IssuerRow({ issuer }: { issuer: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(issuer);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="px-4 pb-2.5 -mt-1 flex items-center justify-between gap-2">
      <p className="text-[9px] text-gray-700 font-mono truncate flex-1">
        {issuer.slice(0, 8)}…{issuer.slice(-8)}
      </p>
      <button
        onClick={handleCopy}
        title="Copy issuer address"
        className="flex-shrink-0 text-gray-700 hover:text-primary transition"
      >
        <span className="material-symbols-outlined text-xs leading-none">
          {copied ? "check" : "content_copy"}
        </span>
      </button>
    </div>
  );
}
