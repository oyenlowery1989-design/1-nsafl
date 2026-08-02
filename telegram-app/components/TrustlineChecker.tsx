"use client";
import { useEffect, useState } from "react";
import { REWARD_ASSETS, RewardAsset } from "@/lib/rewardAssets";
import { HORIZON_URL } from "@/lib/constants";
import { useWalletStore } from "@/hooks/useStore";
import TrustlineModal from "@/components/TrustlineModal";

interface Props {
  stellarAddress: string;
  requiredCodes: string[];
  onAllAdded?: () => void;
}

interface TrustlineStatus {
  asset: RewardAsset;
  hasTrustline: boolean;
  checking: boolean;
}

export default function TrustlineChecker({ stellarAddress, requiredCodes, onAllAdded }: Props) {
  const telegramUser = useWalletStore(s => s.telegramUser)
  const required = REWARD_ASSETS.filter(a => requiredCodes.includes(a.code) && a.issuer);

  const [statuses, setStatuses] = useState<TrustlineStatus[]>(
    required.map((a) => ({ asset: a, hasTrustline: false, checking: true }))
  );
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!stellarAddress) return;
    fetch(`${HORIZON_URL}/accounts/${stellarAddress}`)
      .then((r) => r.json())
      .then((account) => {
        const balances: { asset_code?: string; asset_issuer?: string }[] = account.balances ?? [];
        setStatuses((prev) =>
          prev.map((s) => ({
            ...s,
            checking: false,
            hasTrustline: balances.some(
              (b) => b.asset_code === s.asset.code && b.asset_issuer === s.asset.issuer
            ),
          }))
        );
      })
      .catch(() => setStatuses((prev) => prev.map((s) => ({ ...s, checking: false }))));
  }, [stellarAddress]);

  useEffect(() => {
    if (!statuses.some((s) => s.checking) && statuses.every((s) => s.hasTrustline)) {
      onAllAdded?.();
    }
  }, [statuses, onAllAdded]);

  if (required.length === 0) return null;
  if (statuses.some((s) => s.checking)) return null;
  if (statuses.every((s) => s.hasTrustline)) return null;

  const missing = statuses.filter((s) => !s.hasTrustline);

  return (
    <>
      <div className="rounded-xl border border-yellow-500/20 p-3 space-y-2.5"
        style={{ background: 'rgba(234,179,8,0.05)' }}>
        <div className="flex items-start space-x-2">
          <span className="material-symbols-outlined text-yellow-400 text-base mt-0.5 flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <p className="text-xs text-gray-300 leading-relaxed">
            To receive your prize, your wallet needs a{" "}
            <span className="text-white font-semibold">trustline</span> for each reward asset.
            This is a one-time setup on the Stellar network.
          </p>
        </div>

        {/* Missing asset chips */}
        <div className="flex flex-wrap gap-1.5">
          {missing.map((s) => (
            <span key={s.asset.code}
              className="text-[10px] font-bold px-2 py-1 rounded-full border border-yellow-500/30 text-yellow-400"
              style={{ background: 'rgba(234,179,8,0.08)' }}>
              {s.asset.code} missing
            </span>
          ))}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-2 rounded-xl text-xs font-bold border border-primary/40 text-primary transition hover:bg-primary/10 flex items-center justify-center space-x-1.5"
          style={{ background: 'rgba(212,175,55,0.08)' }}
        >
          <span className="material-symbols-outlined text-xs leading-none">link</span>
          <span>Set Up Trustlines</span>
        </button>
      </div>

      <TrustlineModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        stellarAddress={stellarAddress}
        telegramUsername={telegramUser?.username ?? null}
        onAllAdded={() => {
          setModalOpen(false)
          setStatuses(prev => prev.map(s => ({ ...s, hasTrustline: true })))
          onAllAdded?.()
        }}
      />
    </>
  );
}
