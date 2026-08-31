// config/partnerClub.ts — per-clone file. Everything about the optional
// "partner club" sponsorship concept lives here: name, colors, squad, and
// the two AFL clubs the squad is drawn from. Set `enabled: false` to remove
// the feature entirely (sponsor bars/tiles/strips, the dedicated clubs tab,
// the team-select partner card, and the dashboard sponsor modal all read
// this flag and render nothing when it's off).
//
// The UI built around this (clubs/page.tsx's WhipLash347Tab, the dashboard
// sponsor modal) assumes exactly two source clubs — that's a structural
// assumption of the current layout, not something this config alone can
// generalize away. A partner concept shaped differently (more clubs, no
// club affiliation at all, etc.) would need those components rewritten.

export type PlayerPosition = 'MID' | 'FWD' | 'DEF' | 'RUCK'

export interface PartnerPlayer {
  name: string
  club: string   // AFL club they play for
  clubId: string // matches AflClub.id in config/afl.ts
  position: PlayerPosition
  captain?: boolean
}

export interface PartnerSourceClub {
  id: string     // matches AflClub.id in config/afl.ts
  name: string
  logo: string
}

export const PARTNER_CLUB = {
  enabled: true,
  id: 'whiplash347',
  name: 'WhipLash347',
  shortName: 'Whip347',
  logo: '/whiplash347.png',
  color: '#E8192C',
  secondaryColor: '#00D4FF',
  league: 'PARTNER' as const,
  tagline: 'Official Partner',
  coOwnerTagline: 'Official Partner & Co-Owner',
  sponsorLabel: 'Powered by WhipLash347',
  gamesSponsorLabel: 'Games Sponsored by',
  partnerTeamLabel: 'Partner Team',
  // substrings matched against fixture team names to flag a fixture as
  // involving a partner-squad player
  fixtureMatchTerms: ['West Coast', 'Fremantle'],
  // the two real-world clubs the squad is drawn from — order matters,
  // the dedicated tab and dashboard modal render exactly these two
  sourceClubs: [
    { id: 'west-coast', name: 'West Coast Eagles', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xpcp2f1647870746.png' },
    { id: 'fremantle',  name: 'Fremantle',          logo: 'https://r2.thesportsdb.com/images/media/team/badge/hw34ii1647870691.png' },
  ] as PartnerSourceClub[],
} as const

export const PARTNER_SQUAD: PartnerPlayer[] = [
  // WCE picks
  { name: 'Nasiah Wanganeen-Milera', club: 'West Coast Eagles',  clubId: 'west-coast', position: 'MID' },
  { name: 'Chad Warner',             club: 'West Coast Eagles',  clubId: 'west-coast', position: 'MID' },
  { name: 'Finn Callaghan',          club: 'West Coast Eagles',  clubId: 'west-coast', position: 'MID' },
  { name: 'Patrick Cripps',          club: 'West Coast Eagles',  clubId: 'west-coast', position: 'MID', captain: true },
  { name: 'Daniel Curtin',           club: 'West Coast Eagles',  clubId: 'west-coast', position: 'DEF' },
  { name: 'Nick Martin',             club: 'West Coast Eagles',  clubId: 'west-coast', position: 'MID' },
  { name: 'Tristan Xerri',           club: 'West Coast Eagles',  clubId: 'west-coast', position: 'RUCK' },
  { name: 'Trent Rivers',            club: 'West Coast Eagles',  clubId: 'west-coast', position: 'MID' },
  { name: 'Sam Taylor',              club: 'West Coast Eagles',  clubId: 'west-coast', position: 'DEF' },
  { name: 'Kysiah Pickett',          club: 'West Coast Eagles',  clubId: 'west-coast', position: 'FWD' },
  { name: 'Darcy Jones',             club: 'West Coast Eagles',  clubId: 'west-coast', position: 'FWD' },
  { name: 'Bobby Hill',              club: 'West Coast Eagles',  clubId: 'west-coast', position: 'FWD' },
  { name: 'Shannon Neale',           club: 'West Coast Eagles',  clubId: 'west-coast', position: 'FWD' },
  // Fremantle picks
  { name: 'Aaron Naughton',          club: 'Fremantle',          clubId: 'fremantle', position: 'FWD' },
  { name: 'Will Powell',             club: 'Fremantle',          clubId: 'fremantle', position: 'MID' },
  { name: 'Koltyn Tholstrup',        club: 'Fremantle',          clubId: 'fremantle', position: 'DEF' },
  { name: 'Ed Allan',                club: 'Fremantle',          clubId: 'fremantle', position: 'DEF' },
  { name: 'Lachie Neale',            club: 'Fremantle',          clubId: 'fremantle', position: 'MID' },
  { name: 'Jedd Busslinger',         club: 'Fremantle',          clubId: 'fremantle', position: 'MID' },
]
