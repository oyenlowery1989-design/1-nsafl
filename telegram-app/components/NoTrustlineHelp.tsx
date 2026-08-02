"use client";
import {
  PRIMARY_CUSTOM_ASSET_CODE,
  PRIMARY_CUSTOM_ASSET_ISSUER,
} from "@/lib/constants";
import { haptic } from "@/lib/telegram-ui";

interface Props {
  onTrustlineAdded: () => void; // called after successful auto-add — parent retries connect
}

export default function NoTrustlineHelp({ onTrustlineAdded: _onTrustlineAdded }: Props) {
  const lobstrUrl = `https://lobstr.co/assets/${PRIMARY_CUSTOM_ASSET_CODE}:${PRIMARY_CUSTOM_ASSET_ISSUER}`;
  const scopulyUrl = `https://scopuly.com/trade/${PRIMARY_CUSTOM_ASSET_CODE}-XLM/${PRIMARY_CUSTOM_ASSET_ISSUER}/native`;

  return (
    <div className="space-y-4 w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <span className="material-symbols-outlined text-4xl text-yellow-400">
          link_off
        </span>
        <h2 className="text-base font-bold text-white">No Trustline Found</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Your wallet needs a trustline for{" "}
          <span className="text-primary font-semibold">
            {PRIMARY_CUSTOM_ASSET_CODE}
          </span>{" "}
          before connecting. Choose a method below.
        </p>
      </div>

      {/* Option 1 — Lobstr */}
      <a
        href={lobstrUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => haptic.light()}
        className="flex items-center space-x-3 glass-card border border-white/10 rounded-xl px-4 py-3 hover:border-primary/40 transition active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">🌊</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Add via Lobstr</p>
          <p className="text-[10px] text-gray-400 truncate">
            Open Lobstr wallet to add trustline
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-base">
          open_in_new
        </span>
      </a>

      {/* Option 2 — Scopuly */}
      <a
        href={scopulyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => haptic.light()}
        className="flex items-center space-x-3 glass-card border border-white/10 rounded-xl px-4 py-3 hover:border-primary/40 transition active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📊</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Add via Scopuly</p>
          <p className="text-[10px] text-gray-400 truncate">
            Use Scopuly DEX to enable the asset
          </p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-base">
          open_in_new
        </span>
      </a>
    </div>
  );
}
