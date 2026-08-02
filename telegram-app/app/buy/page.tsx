"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegramBack } from "@/hooks/useTelegramBack";
import BottomNav from "@/components/BottomNav";
import WalletGuard from "@/components/WalletGuard";
import PageLoader, { useMinLoader } from "@/components/PageLoader";
import { useWalletStore } from "@/hooks/useStore";
import { getTierForBalance, getNextTier } from "@/config/tiers";
import {
  PRIMARY_CUSTOM_ASSET_LABEL,
  PRIMARY_CUSTOM_ASSET_CODE,
  PRIMARY_CUSTOM_ASSET_ISSUER,
} from "@/lib/constants";
import { toast } from "@/components/Toast";
import { haptic } from "@/lib/telegram-ui";
import ErrorCard from "@/components/ErrorCard";

const XLM_TO_TOKEN_RATE = parseFloat(
  process.env.NEXT_PUBLIC_XLM_TO_TOKEN_RATE ?? "1",
);

const DIRECT_BUY_ADDRESS = process.env.NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS ?? "";

const LOBSTR_URL = `https://lobstr.co/trade/${PRIMARY_CUSTOM_ASSET_CODE}:${PRIMARY_CUSTOM_ASSET_ISSUER}`;

const SCOPULY_URL = `https://scopuly.com/trade/${PRIMARY_CUSTOM_ASSET_CODE}-${PRIMARY_CUSTOM_ASSET_ISSUER}/native`;

export default function BuyPage() {
  const router = useRouter();
  useTelegramBack(() => router.back());
  const ready = useMinLoader(true);
  const tokenBalance = useWalletStore((s) => s.tokenBalance);
  const stellarAddress = useWalletStore((s) => s.stellarAddress);
  const balance = parseFloat(tokenBalance) || 0;
  const currentTier = getTierForBalance(balance);
  const nextTier = getNextTier(currentTier);
  const toNextTier = nextTier ? Math.max(0, nextTier.minBalance - balance) : 0;

  // Direct buy form state
  const [xlmAmount, setXlmAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // Advanced section state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advSecretKey, setAdvSecretKey] = useState("");
  const [advXlmAmount, setAdvXlmAmount] = useState("");
  const [advSubmitting, setAdvSubmitting] = useState(false);
  const [advStep, setAdvStep] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [advError, setAdvError] = useState("");

  const calculatedTokens = xlmAmount
    ? (parseFloat(xlmAmount) * XLM_TO_TOKEN_RATE).toFixed(2)
    : "0.00";

  const truncatedAddress =
    DIRECT_BUY_ADDRESS.length > 12
      ? `${DIRECT_BUY_ADDRESS.slice(0, 6)}...${DIRECT_BUY_ADDRESS.slice(-6)}`
      : DIRECT_BUY_ADDRESS;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DIRECT_BUY_ADDRESS);
      haptic.selection();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpenBot = () => {
    haptic.medium();
    const tg = (window as Window & { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
    const botUrl = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME ?? "NSAFL_bot"}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(botUrl);
    } else {
      window.open(botUrl, "_blank");
    }
  };

  const handleAdvancedBuy = async () => {
    const key = advSecretKey.trim();
    const xlm = parseFloat(advXlmAmount);
    if (!key) { setAdvError("Enter your secret key."); return; }
    if (!xlm || xlm <= 0) { setAdvError("Enter a valid XLM amount."); return; }

    haptic.medium();
    setAdvSubmitting(true);
    setAdvStep('loading');
    setAdvError('');

    try {
      const { Keypair, Asset, TransactionBuilder, Operation, Networks, BASE_FEE, Memo } =
        await import('stellar-sdk');

      let keypair: ReturnType<typeof Keypair.fromSecret>;
      try {
        keypair = Keypair.fromSecret(key);
      } catch {
        setAdvStep('error');
        setAdvError('Invalid secret key format.');
        setAdvSubmitting(false);
        return;
      }

      const publicKey = keypair.publicKey();
      const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org';

      const accountRes = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
      if (!accountRes.ok) {
        setAdvStep('error');
        setAdvError('Could not load account from Stellar. Is the wallet funded?');
        setAdvSubmitting(false);
        return;
      }
      const accountData = await accountRes.json();

      const account = {
        id: accountData.id,
        sequence: accountData.sequence,
        incrementSequenceNumber() { this.sequence = (Number(this.sequence) + 1).toString(); },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = new TransactionBuilder(account as any, {
        fee: BASE_FEE,
        networkPassphrase: Networks.PUBLIC,
      })
        .addOperation(Operation.payment({
          destination: DIRECT_BUY_ADDRESS,
          asset: Asset.native(),
          amount: xlm.toFixed(7),
        }))
        .addMemo(Memo.text(`${PRIMARY_CUSTOM_ASSET_CODE} buy`))
        .setTimeout(30)
        .build();

      tx.sign(keypair);
      const xdr = tx.toEnvelope().toXDR('base64');

      const submitRes = await fetch('/api/stellar/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xdr, type: 'purchase' }),
      });
      const submitJson = await submitRes.json();

      if (submitJson.success) {
        haptic.success();
        setAdvStep('success');
        setAdvSecretKey('');
        setAdvXlmAmount('');
        toast.success(`Payment sent! TX: ${(submitJson.data?.hash ?? '').slice(0, 8)}…`);
      } else {
        haptic.error();
        setAdvStep('error');
        setAdvError(submitJson.error ?? 'Transaction failed.');
      }
    } catch {
      haptic.error();
      setAdvStep('error');
      setAdvError('Unexpected error. Please try again.');
    } finally {
      setAdvSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <WalletGuard>
        <PageLoader label="Loading…" />
        <BottomNav />
      </WalletGuard>
    );
  }

  if (!DIRECT_BUY_ADDRESS) {
    return (
      <WalletGuard>
        <main className="px-4 py-6">
          <ErrorCard
            error="Buy address is not configured."
            context="Buy page"
          />
        </main>
        <BottomNav />
      </WalletGuard>
    );
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
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
              Buy {PRIMARY_CUSTOM_ASSET_LABEL}
            </h1>
            <p className="text-[11px] text-gray-400">
              {balance.toLocaleString()} {PRIMARY_CUSTOM_ASSET_LABEL} held
              {nextTier && (
                <span className="text-[#D4AF37]">
                  {" "}
                  · {toNextTier.toLocaleString()} to {nextTier.label}
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-28">
        {/* Tier Promotion Banner */}
        {nextTier && (
          <div
            className="glass-card rounded-xl p-4 relative overflow-hidden"
            style={{ border: "1px solid rgba(212,175,55,0.3)" }}
          >
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xl">{currentTier.emoji}</span>
                <span className="material-symbols-outlined text-[#D4AF37] text-base">
                  arrow_forward
                </span>
                <span className="text-xl">{nextTier.emoji}</span>
              </div>
              <p className="text-sm text-white font-semibold mb-1">
                Upgrade to{" "}
                <span style={{ color: nextTier.color }}>{nextTier.label}</span>
              </p>
              <p className="text-xs text-gray-400 mb-2">
                Buy {toNextTier.toLocaleString()} more{" "}
                {PRIMARY_CUSTOM_ASSET_LABEL} to unlock{" "}
                {nextTier.rewards
                  ? `+${nextTier.rewards.xlmRefundPct}% XLM Refund, ${nextTier.rewards.gold} Gold, and more`
                  : "the next level of rewards"}
              </p>
              {/* Mini progress */}
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${nextTier ? Math.min(100, ((balance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100) : 100}%`,
                    background: `linear-gradient(90deg, ${currentTier.color}, #D4AF37)`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 1 — Buy Direct with XLM */}
        <div className="glass-card rounded-xl p-3 space-y-2.5">
          {/* Header */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[#D4AF37] text-base">account_balance_wallet</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white leading-tight">Buy Direct with XLM</p>
              <p className="text-[10px] text-gray-500 leading-tight">1 XLM = {XLM_TO_TOKEN_RATE} {PRIMARY_CUSTOM_ASSET_CODE}</p>
            </div>
          </div>

          {/* Bonus banner */}
          <div className="flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30">
            <span className="material-symbols-outlined text-green-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_offer</span>
            <span className="text-lg font-extrabold text-green-400 tracking-wide">+20% Bonus</span>
            <span className="text-[11px] text-green-300/70 font-medium">{PRIMARY_CUSTOM_ASSET_CODE} on every purchase</span>
          </div>

          {/* Payment address */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 space-y-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Send XLM to this address</p>
            <div className="flex items-center space-x-2">
              <p className="text-xs text-gray-200 font-mono flex-1 break-all leading-relaxed">{DIRECT_BUY_ADDRESS}</p>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/25 transition active:scale-[0.97]"
              >
                <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
                <span className="text-[10px] font-semibold">{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* XLM amount input */}
          <input
            type="number"
            value={xlmAmount}
            onChange={(e) => setXlmAmount(e.target.value)}
            placeholder="XLM amount (optional — to see estimate)"
            min="0"
            step="any"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
          />

          {/* Calculated token amount */}
          {xlmAmount && parseFloat(xlmAmount) > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="text-[11px] text-gray-400">You&apos;ll receive (incl. bonus)</span>
              <span className="text-xs font-bold text-[#D4AF37]">
                {(parseFloat(calculatedTokens) * 1.2).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}{PRIMARY_CUSTOM_ASSET_LABEL}
              </span>
            </div>
          )}

          {/* Open bot button */}
          <button
            onClick={handleOpenBot}
            className="w-full py-2 rounded-lg font-semibold text-sm transition-all bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 active:scale-[0.98]"
          >
            <span className="flex items-center justify-center space-x-2">
              <span className="material-symbols-outlined text-base">send</span>
              <span>I&apos;ve Sent — Go to @{process.env.NEXT_PUBLIC_BOT_USERNAME ?? "NSAFL_bot"}</span>
            </span>
          </button>
        </div>

        {/* DEX options — 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Lobstr */}
          <div className="glass-card rounded-xl p-3 flex flex-col items-center space-y-2 border border-blue-500/20">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-400 text-base">swap_horiz</span>
            </div>
            <p className="text-xs font-bold text-white">Lobstr</p>
            <p className="text-[10px] text-gray-500 text-center leading-tight">Popular Stellar DEX</p>
            <a
              href={LOBSTR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Trade on Lobstr</span>
            </a>
          </div>

          {/* Scopuly */}
          <div className="glass-card rounded-xl p-3 flex flex-col items-center space-y-2 border border-purple-500/20">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-400 text-base">candlestick_chart</span>
            </div>
            <p className="text-xs font-bold text-white">Scopuly</p>
            <p className="text-[10px] text-gray-500 text-center leading-tight">Advanced DEX + charts</p>
            <a
              href={SCOPULY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Trade on Scopuly</span>
            </a>
          </div>
        </div>

        {/* Section 4 — Advanced (Admin Only) */}
        <div className="hidden"><div className="glass-card rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-gray-500 text-lg">
                admin_panel_settings
              </span>
              <span className="text-sm text-gray-400 font-semibold">
                Advanced Purchase (Admin)
              </span>
            </div>
            <span
              className={`material-symbols-outlined text-gray-500 text-lg transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 space-y-3">
              {/* Warning */}
              <div className="flex items-start space-x-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="material-symbols-outlined text-red-400 text-sm mt-0.5">warning</span>
                <p className="text-[11px] text-red-300 leading-relaxed">
                  Your secret key signs the payment <strong>locally only</strong>. It is never sent to our servers.
                </p>
              </div>

              {/* Secret key */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Secret Key (S…)</label>
                <input
                  type="password"
                  value={advSecretKey}
                  onChange={(e) => setAdvSecretKey(e.target.value)}
                  placeholder="SXXXXXXXXXXXXXXXXXXXX..."
                  disabled={advSubmitting || advStep === 'success'}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50 disabled:opacity-50"
                />
              </div>

              {/* XLM Amount */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">XLM Amount to Send</label>
                <input
                  type="number"
                  value={advXlmAmount}
                  onChange={(e) => setAdvXlmAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  disabled={advSubmitting || advStep === 'success'}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50 disabled:opacity-50"
                />
              </div>

              {advError && (
                <p className="text-[11px] text-red-400 flex items-center space-x-1">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{advError}</span>
                </p>
              )}
              {advStep === 'success' && (
                <p className="text-[11px] text-green-400 flex items-center space-x-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>Payment sent successfully!</span>
                </p>
              )}

              <button
                onClick={handleAdvancedBuy}
                disabled={advSubmitting || advStep === 'success' || !advSecretKey.trim() || !advXlmAmount}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 active:scale-[0.98]"
              >
                {advSubmitting ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    <span>Signing & Sending…</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="material-symbols-outlined text-base">bolt</span>
                    <span>Sign & Send Payment</span>
                  </span>
                )}
              </button>

              {advStep === 'success' && (
                <button
                  onClick={() => { setAdvStep('idle'); setAdvError(''); }}
                  className="w-full text-[10px] text-gray-500 hover:text-gray-300 transition"
                >
                  Send another
                </button>
              )}
            </div>
          )}
        </div></div>
      </main>

      <BottomNav />
    </WalletGuard>
  );
}
