import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface Props {
  name: string
  description: string
  cost: string
  available: boolean
}

export default function RewardsCard({ name, description, cost, available }: Props) {
  return (
    <div className="glass-card rounded-xl p-4 flex gap-4">
      <div className="w-20 h-20 rounded-lg bg-white/5 border border-gray-500/30 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-3xl text-gray-400">stadium</span>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-white text-sm leading-tight">{name}</h4>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-sm font-semibold ${available ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
            {cost} {PRIMARY_CUSTOM_ASSET_LABEL}
          </span>
          <button
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              available
                ? 'bg-[#D4AF37] text-black hover:bg-yellow-400'
                : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
            }`}
          >
            Claim
          </button>
        </div>
      </div>
    </div>
  )
}
