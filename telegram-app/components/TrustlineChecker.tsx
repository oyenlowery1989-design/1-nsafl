"use client";
import { useEffect, useState } from "react";
import { REWARD_ASSETS, RewardAsset } from "@/lib/rewardAssets";
import { HORIZON_URL } from "@/lib/constants";

interface Props {
  stellarAddress: string;
  requiredCodes: string[]; // e.g. ['wXLM'] — assets the user needs to receive prizes
  onAllAdded?: () => void;
}

interface TrustlineStatus {
  asset: RewardAsset;
  hasTrustline: boolean;
  checking: boolean;
}

export default function TrustlineChecker({
  stellarAddress,
  requiredCodes,
  onAllAdded,
}: Props) {
  const required = REWARD_ASSETS.filter(
    (a) => requiredCodes.includes(a.code) && a.issuer,
  );

  const [statuses, setStatuses] = useState<TrustlineStatus[]>(
    required.map((a) => ({ asset: a, hasTrustline: false, checking: true })),
  );
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState<Record<string, boolean>>({});
  const [signError, setSignError] = useState<Record<string, string>>({});
  const [showSecretFor, setShowSecretFor] = useState<string | null>(null);

  // Check existing trustlines
  useEffect(() => {
    if (!stellarAddress) return;
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
      .catch(() => {
        setStatuses((prev) => prev.map((s) => ({ ...s, checking: false })));
      });
  }, [stellarAddress]);

  // Fire onAllAdded when all trustlines confirmed
  useEffect(() => {
    if (
      !statuses.some((s) => s.checking) &&
      statuses.every((s) => s.hasTrustline)
    ) {
      onAllAdded?.();
    }
  }, [statuses, onAllAdded]);

  const handleSecretSign = async (asset: RewardAsset) => {
    const secret = secretInputs[asset.code]?.trim();
    if (!secret) return;
    setSigning((p) => ({ ...p, [asset.code]: true }));
    setSignError((p) => ({ ...p, [asset.code]: "" }));

    try {
      // Dynamic import to keep bundle light
      const {
        Keypair,
        Asset,
        TransactionBuilder,
        Networks,
        Operation,
        BASE_FEE,
        Horizon,
      } = await import("stellar-sdk");

      const keypair = Keypair.fromSecret(secret);
      if (keypair.publicKey() !== stellarAddress) {
        throw new Error(
          "Secret key does not match your connected wallet address.",
        );
      }

      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(keypair.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.PUBLIC,
      })
        .addOperation(
          Operation.changeTrust({
            asset: new Asset(asset.code, asset.issuer),
          }),
        )
        .setTimeout(180)
        .build();

      tx.sign(keypair);
      await server.submitTransaction(tx);

      // Clear secret from state immediately after signing
      setSecretInputs((p) => ({ ...p, [asset.code]: "" }));
      setShowSecretFor(null);

      // Mark trustline as added
      setStatuses((prev) =>
        prev.map((s) =>
          s.asset.code === asset.code ? { ...s, hasTrustline: true } : s,
        ),
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to add trustline";
      setSignError((p) => ({ ...p, [asset.code]: msg }));
    } finally {
      setSigning((p) => ({ ...p, [asset.code]: false }));
    }
  };

  if (required.length === 0) return null;

  const isChecking = statuses.some((s) => s.checking);
  const missing = statuses.filter((s) => !s.hasTrustline);

  // Still checking — show nothing yet (avoid flashing warning)
  if (isChecking) return null;

  // All trustlines present — show nothing, user is good to go
  if (missing.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-2">
        <span
          className="material-symbols-outlined text-yellow-400 text-base mt-0.5"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          warning
        </span>
        <p className="text-xs text-gray-300 leading-relaxed">
          To receive your prize, your wallet needs a{" "}
          <span className="text-white font-semibold">trustline</span> for each
          reward asset. This is a one-time setup on the Stellar network.
        </p>
      </div>

      {missing.map((s) => (
        <div
          key={s.asset.code}
          className="rounded-xl border overflow-hidden"
          style={{
            borderColor: s.hasTrustline
              ? "rgba(74,222,128,0.3)"
              : "rgba(255,255,255,0.1)",
            background: s.hasTrustline
              ? "rgba(74,222,128,0.05)"
              : "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center space-x-2">
              {s.checking ? (
                <span className="material-symbols-outlined text-gray-500 text-sm animate-spin">
                  progress_activity
                </span>
              ) : s.hasTrustline ? (
                <span
                  className="material-symbols-outlined text-green-400 text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              ) : (
                <span className="material-symbols-outlined text-yellow-400 text-sm">
                  link_off
                </span>
              )}
              <div>
                <p
                  className={`text-xs font-semibold ${s.hasTrustline ? "text-green-300" : "text-white"}`}
                >
                  {s.asset.code}
                </p>
                <p className="text-[10px] text-gray-500">{s.asset.label}</p>
              </div>
            </div>

            {!s.checking && !s.hasTrustline && (
              <div className="flex items-center space-x-1.5">
                {/* Lobstr deeplink */}
                {s.asset.issuer && (
                  <a
                    href={s.asset.lobstrDeeplink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/25 transition"
                  >
                    <span className="material-symbols-outlined text-xs leading-none">
                      open_in_new
                    </span>
                    <span>Lobstr</span>
                  </a>
                )}
                {/* Secret key option */}
                <button
                  onClick={() =>
                    setShowSecretFor((prev) =>
                      prev === s.asset.code ? null : s.asset.code,
                    )
                  }
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition"
                >
                  <span className="material-symbols-outlined text-xs leading-none">
                    key
                  </span>
                  <span></span>
                </button>
              </div>
            )}
          </div>

          {/* Secret key form — inline, hidden by default */}
          {showSecretFor === s.asset.code && !s.hasTrustline && (
            <div className="px-3 pb-3 border-t border-white/5 pt-3 space-y-2">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Your secret key{" "}
                <span className="text-yellow-400 font-medium">
                  never leaves your device
                </span>{" "}
                — signing happens locally in the browser.
              </p>
              <input
                type="password"
                placeholder="S… (your Stellar secret key)"
                value={secretInputs[s.asset.code] ?? ""}
                onChange={(e) =>
                  setSecretInputs((p) => ({
                    ...p,
                    [s.asset.code]: e.target.value,
                  }))
                }
                className="w-full bg-black/40 border border-white/10 text-gray-200 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 placeholder-gray-600"
                autoComplete="off"
                spellCheck={false}
              />
              {signError[s.asset.code] && (
                <p className="text-[10px] text-red-400">
                  {signError[s.asset.code]}
                </p>
              )}
              <button
                onClick={() => handleSecretSign(s.asset)}
                disabled={
                  signing[s.asset.code] || !secretInputs[s.asset.code]?.trim()
                }
                className="w-full py-2 rounded-lg text-xs font-bold text-black bg-[#D4AF37] hover:bg-[#D4AF37]/90 disabled:opacity-40 transition flex items-center justify-center space-x-1.5"
              >
                {signing[s.asset.code] ? (
                  <>
                    <span className="material-symbols-outlined text-xs leading-none animate-spin">
                      progress_activity
                    </span>
                    <span>Signing…</span>
                  </>
                ) : (
                  <>
                    <span
                      className="material-symbols-outlined text-xs leading-none"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      lock
                    </span>
                    <span>Sign &amp; Add Trustline</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
