export interface AflClub {
  id: string
  name: string
  shortName: string
  color: string
  logo: string        // URL — empty string = show initials fallback
  league: 'AFL' | 'WAFL'
}

export interface AflFixture {
  id: string
  round: number
  date: string          // e.g. "Thursday March 12"
  time: string          // e.g. "4:30am EDT"
  venue: string
  country: string       // traditional custodians of the land
  homeTeam: string
  homePosition: number | null   // ladder position
  awayTeam: string
  awayPosition: number | null
  homeScore: number | null
  awayScore: number | null
  homeOdds: string | null       // e.g. "$1.37"
  awayOdds: string | null
  status: 'UPCOMING' | 'FULL TIME' | 'LIVE'
  winner: string | null
  matchReportUrl: string
}

// Logos from TheSportsDB (free public API — https://www.thesportsdb.com)
export const AFL_CLUBS: AflClub[] = [
  { id: 'adelaide',          name: 'Adelaide Crows',    shortName: 'ADL', color: '#002B5C', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/2nh2z01731592341.png' },
  { id: 'brisbane',          name: 'Brisbane Lions',    shortName: 'BRL', color: '#A30046', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/tvvxvp1474038810.png' },
  { id: 'carlton',           name: 'Carlton',           shortName: 'CAR', color: '#0E3C96', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/k9no791584810309.png' },
  { id: 'collingwood',       name: 'Collingwood',       shortName: 'COL', color: '#000000', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/a2uqkd1584810538.png' },
  { id: 'essendon',          name: 'Essendon',          shortName: 'ESS', color: '#CC2031', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xwupps1474039541.png' },
  { id: 'fremantle',         name: 'Fremantle',         shortName: 'FRE', color: '#2A1A54', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/hw34ii1647870691.png' },
  { id: 'geelong',           name: 'Geelong Cats',      shortName: 'GEE', color: '#1C3F94', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xapo7t1647870681.png' },
  { id: 'gold-coast',        name: 'Gold Coast SUNS',   shortName: 'GCS', color: '#E5232B', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/4os77n1731592560.png' },
  { id: 'gws',               name: 'GWS GIANTS',        shortName: 'GWS', color: '#F47920', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/ef6rqs1647870839.png' },
  { id: 'hawthorn',          name: 'Hawthorn',          shortName: 'HAW', color: '#4D2004', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/18y3ks1647870779.png' },
  { id: 'melbourne',         name: 'Melbourne',         shortName: 'MEL', color: '#CC2031', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xvtstv1474039391.png' },
  { id: 'north-melbourne',   name: 'North Melbourne',   shortName: 'NTH', color: '#003CA6', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/u5x1ok1584811490.png' },
  { id: 'port-adelaide',     name: 'Port Adelaide',     shortName: 'PAP', color: '#008AAB', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/7qvqn81584810882.png' },
  { id: 'richmond',          name: 'Richmond',          shortName: 'RIC', color: '#FED102', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xkqlvb1647870792.png' },
  { id: 'st-kilda',          name: 'St Kilda',          shortName: 'STK', color: '#ED0F05', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/fvj5ez1732026459.png' },
  { id: 'sydney',            name: 'Sydney Swans',      shortName: 'SYD', color: '#E2001A', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/ndeir91647870648.png' },
  { id: 'west-coast',        name: 'West Coast Eagles', shortName: 'WCE', color: '#003087', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xpcp2f1647870746.png' },
  { id: 'western-bulldogs',  name: 'Western Bulldogs',  shortName: 'WBD', color: '#0057A5', league: 'AFL', logo: 'https://r2.thesportsdb.com/images/media/team/badge/e3hg551647870757.png' },
]

// WAFL clubs — 9 teams. Logos sourced from Wikimedia Commons via Wikipedia article thumbnails.
export const WAFL_CLUBS: AflClub[] = [
  { id: 'wafl-claremont',       name: 'Claremont Tigers',  shortName: 'CLA', color: '#003087', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/1/15/Claremont_tigers_logo.png' },
  { id: 'wafl-east-fremantle',  name: 'East Fremantle',    shortName: 'EFR', color: '#D40000', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/2/29/East_fremantle_sharks_logo.png' },
  { id: 'wafl-east-perth',      name: 'East Perth',        shortName: 'EPR', color: '#C8102E', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/e/ea/Eperth.png' },
  { id: 'wafl-peel',            name: 'Peel Thunder',      shortName: 'PEL', color: '#5C2D8F', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/3/30/Peel_thunder_fc_logo.png' },
  { id: 'wafl-perth',           name: 'Perth Demons',      shortName: 'PTH', color: '#CC0000', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/6/67/Perth_Football_Club.png' },
  { id: 'wafl-south-fremantle', name: 'South Fremantle',   shortName: 'SFR', color: '#C8102E', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/3/34/SF_bulldogs_logo.png' },
  { id: 'wafl-subiaco',         name: 'Subiaco',           shortName: 'SUB', color: '#003DA5', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/9/90/Subiaco_FC.png' },
  { id: 'wafl-swan-districts',  name: 'Swan Districts',    shortName: 'SWD', color: '#000000', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/f/fd/Swan_districts_fc_logo.png' },
  { id: 'wafl-west-perth',      name: 'West Perth',        shortName: 'WPR', color: '#003087', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/1/17/Falconslogo.png' },
  { id: 'wafl-west-coast',      name: 'West Coast',        shortName: 'WCT', color: '#003087', league: 'WAFL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b5/West_Coast_Eagles_logo_2017.svg/120px-West_Coast_Eagles_logo_2017.svg.png' },
]

export const ALL_CLUBS: AflClub[] = [...AFL_CLUBS, ...WAFL_CLUBS]

const AFL_URL = 'https://www.afl.com.au/fixture'

// ── Match report types ────────────────────────────────────────────────────────

export interface QuarterLine {
  q1: string   // e.g. "0.3"
  q2: string   // e.g. "2.6"
  q3: string   // e.g. "14.9"
  final: string // e.g. "20.12 (132)"
}

export interface TeamReport {
  quarters: QuarterLine
  goals: string    // comma-separated scorer list
  best: string     // comma-separated best players
  injuries: string // "Nil" or description
}

export interface AflMatchReport {
  fixtureId: string
  crowd: string    // e.g. "40,372 at the SCG"
  home: TeamReport
  away: TeamReport
}

export const MATCH_REPORTS: AflMatchReport[] = [
  {
    fixtureId: 'r2-1',
    crowd: '~45,000 at MCG',
    home: {
      quarters: { q1: '2.2', q2: '5.4', q3: '8.8', final: '11.9 (75)' },
      goals: 'Curnow 3, McKay 2, Owies, Newnes, Durdin, Motlop, Cottrell, Silvagni',
      best: 'Curnow, Walsh, Martin, Silvagni, Cottrell',
      injuries: 'Nil',
    },
    away: {
      quarters: { q1: '3.1', q2: '5.3', q3: '8.6', final: '10.11 (71)' },
      goals: 'Rioli 3, Bolton 2, Prestia, Caddy, Ross, Riewoldt, Higgins',
      best: 'Rioli, Prestia, Baker, Vlastuin',
      injuries: 'Nil',
    },
  },
  {
    fixtureId: 'r1-1',
    crowd: '40,372 at the SCG',
    home: {
      quarters: { q1: '0.3', q2: '2.6', q3: '14.9', final: '20.12 (132)' },
      goals: 'Curnow 3, McInerney 3, Amartey 3, Roberts 2, Heeney 2, Warner, Sheldrick, Rowbottom, Rosas, Papley, McDonald, Grundy',
      best: 'Gulden, McInerney, Heeney, Warner, Serong, Roberts',
      injuries: 'Nil',
    },
    away: {
      quarters: { q1: '2.2', q2: '4.4', q3: '8.6', final: '10.9 (69)' },
      goals: 'Pittonet 3, Ainsworth 2, Moir, McKay, Kemp, E.Hollands, Hayward',
      best: 'Walsh, Lord, Smith, Pittonet',
      injuries: 'Saad (hamstring tightness)',
    },
  },
  {
    fixtureId: 'r1-2',
    crowd: '19,859 at People First Stadium',
    home: {
      quarters: { q1: '7.1', q2: '11.5', q3: '18.8', final: '19.11 (125)' },
      goals: 'Humphrey 4, King 4, Petracca 3, Long 2, Noble 2, Lombard 2, Miller, Anderson',
      best: 'Petracca, Noble, Miller, Humphrey, Rioli, Anderson',
      injuries: 'Nil',
    },
    away: {
      quarters: { q1: '2.2', q2: '4.5', q3: '5.7', final: '10.9 (69)' },
      goals: 'Dempsey 4, Henry 2, Neale, Mannagh, Knevitt, Clark',
      best: 'Bruhn, Dempsey, O\'Sullivan, Worpel',
      injuries: 'Nil',
    },
  },
  {
    fixtureId: 'r1-3',
    crowd: '16,157 at Engie Stadium',
    home: {
      quarters: { q1: '8.3', q2: '13.4', q3: '18.6', final: '19.8 (122)' },
      goals: 'Stringer 5, Hogan 3, Riccardi 3, Gruzewski 2, Coniglio 2, Brown, Rowston, Oliver, Gothard',
      best: 'Stringer, Callaghan, Oliver, Coniglio, Fonti, Himmelberg',
      injuries: 'Nil',
    },
    away: {
      quarters: { q1: '5.2', q2: '7.5', q3: '11.7', final: '14.11 (95)' },
      goals: 'Gunston 4, Butler 2, Chol 2, Ginnivan 2, Watson 2, Meek, Lewis',
      best: 'Newcombe, Sicily, Weddle, Watson, Ward',
      injuries: 'Nil',
    },
  },
  {
    fixtureId: 'r1-4',
    crowd: '31,606 at the Gabba',
    home: {
      quarters: { q1: '3.1', q2: '6.7', q3: '12.9', final: '15.16 (106)' },
      goals: 'Cameron 4, Morris 3, Lohmann 2, Zorko, Zakostelsky, Bailey, Allen, Fort, Rayner',
      best: 'Cameron, Andrews, Reville, Lester, Neale, Zorko',
      injuries: 'McCluggage (calf)',
    },
    away: {
      quarters: { q1: '2.7', q2: '5.10', q3: '9.14', final: '16.15 (111)' },
      goals: 'Bontempelli 3, Darcy 2, Richards 2, Naughton 2, English 2, Williams, West, Davidson, Budarick, Bramble',
      best: 'Richards, Bontempelli, Lobb, Liberatore, Budarick, Williams',
      injuries: 'Jones (concussion)',
    },
  },
  {
    fixtureId: 'r1-5',
    crowd: '82,528 at the MCG',
    home: {
      quarters: { q1: '2.4', q2: '5.7', q3: '7.10', final: '9.12 (66)' },
      goals: 'Owens 2, Sharman 2, Hall, Higgins, Hill, Ryan, Wanganeen-Milera',
      best: 'Sinclair, Flanders, Wanganeen-Milera, Owens, Silvagni',
      injuries: 'Marshall (concussion)',
    },
    away: {
      quarters: { q1: '4.3', q2: '5.5', q3: '10.10', final: '11.12 (78)' },
      goals: 'De Goey 3, Schultz 2, McCreery 2, Cameron, Elliott, McStay, Steele',
      best: 'J.Daicos, N.Daicos, Pendlebury, Cameron, De Goey, Schultz',
      injuries: 'Nil',
    },
  },
]

export const ROUND_1_FIXTURES: AflFixture[] = [
  {
    id: 'r1-1', round: 1,
    date: 'Thursday March 5', time: '7:30pm AEDT',
    venue: 'SCG, Sydney', country: 'Gadigal',
    homeTeam: 'Sydney Swans', homePosition: 1,
    awayTeam: 'Carlton', awayPosition: null,
    homeScore: 132, awayScore: 69,
    homeOdds: null, awayOdds: null,
    status: 'FULL TIME', winner: 'Sydney Swans won by 63',
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r1-2', round: 1,
    date: 'Friday March 6', time: '7:10pm AEDT',
    venue: 'People First Stadium, Gold Coast', country: 'Yugambeh',
    homeTeam: 'Gold Coast SUNS', homePosition: 2,
    awayTeam: 'Geelong Cats', awayPosition: null,
    homeScore: 125, awayScore: 69,
    homeOdds: null, awayOdds: null,
    status: 'FULL TIME', winner: 'Gold Coast SUNS won by 56',
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r1-3', round: 1,
    date: 'Saturday March 7', time: '1:45pm AEDT',
    venue: 'ENGIE Stadium, Sydney', country: 'Wangal',
    homeTeam: 'GWS GIANTS', homePosition: 3,
    awayTeam: 'Hawthorn', awayPosition: null,
    homeScore: 122, awayScore: 95,
    homeOdds: null, awayOdds: null,
    status: 'FULL TIME', winner: 'GWS GIANTS won by 27',
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r1-4', round: 1,
    date: 'Saturday March 7', time: '4:35pm AEDT',
    venue: 'Gabba, Brisbane', country: 'Yuggera - Toorabul',
    homeTeam: 'Brisbane Lions', homePosition: 6,
    awayTeam: 'Western Bulldogs', awayPosition: 5,
    homeScore: 106, awayScore: 111,
    homeOdds: null, awayOdds: null,
    status: 'FULL TIME', winner: 'Western Bulldogs won by 5',
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r1-5', round: 1,
    date: 'Sunday March 8', time: '3:20pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'St Kilda', homePosition: 7,
    awayTeam: 'Collingwood', awayPosition: 4,
    homeScore: 66, awayScore: 78,
    homeOdds: null, awayOdds: null,
    status: 'FULL TIME', winner: 'Collingwood won by 12',
    matchReportUrl: AFL_URL,
  },
]

export const ROUND_2_FIXTURES: AflFixture[] = [
  {
    id: 'r2-1', round: 2,
    date: 'Thursday March 12', time: 'FULL TIME',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Carlton', homePosition: null,
    awayTeam: 'Richmond', awayPosition: null,
    homeScore: 75, awayScore: 71,
    homeOdds: null, awayOdds: null,
    status: 'FULL TIME', winner: 'Carlton won by 4',
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-2', round: 2,
    date: 'Friday March 13', time: '4:40am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Essendon', homePosition: null,
    awayTeam: 'Hawthorn', awayPosition: 10,
    homeScore: null, awayScore: null,
    homeOdds: '$4.60', awayOdds: '$1.20',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-3', round: 2,
    date: 'Friday March 13', time: '10:15pm EDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Western Bulldogs', homePosition: 5,
    awayTeam: 'GWS GIANTS', awayPosition: 3,
    homeScore: null, awayScore: null,
    homeOdds: '$1.35', awayOdds: '$3.25',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-4', round: 2,
    date: 'Saturday March 14', time: '1:15am EDT',
    venue: 'GMHBA Stadium, Geelong', country: 'Wadawurrung',
    homeTeam: 'Geelong Cats', homePosition: 11,
    awayTeam: 'Fremantle', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.47', awayOdds: '$2.68',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-5', round: 2,
    date: 'Saturday March 14', time: '4:10am EDT',
    venue: 'SCG, Sydney', country: 'Gadigal',
    homeTeam: 'Sydney Swans', homePosition: 1,
    awayTeam: 'Brisbane Lions', awayPosition: 7,
    homeScore: null, awayScore: null,
    homeOdds: '$1.37', awayOdds: '$3.11',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-6', round: 2,
    date: 'Saturday March 14', time: '4:35am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Collingwood', homePosition: 4,
    awayTeam: 'Adelaide Crows', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.73', awayOdds: '$2.12',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-7', round: 2,
    date: 'Saturday March 14', time: '10:10pm EDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri',
    homeTeam: 'North Melbourne', homePosition: null,
    awayTeam: 'Port Adelaide', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$2.41', awayOdds: '$1.57',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-8', round: 2,
    date: 'Sunday March 15', time: '12:15am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Melbourne', homePosition: null,
    awayTeam: 'St Kilda', awayPosition: 9,
    homeScore: null, awayScore: null,
    homeOdds: '$2.47', awayOdds: '$1.54',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-9', round: 2,
    date: 'Sunday March 15', time: '3:10am EDT',
    venue: 'People First Stadium, Gold Coast', country: 'Yugambeh',
    homeTeam: 'Gold Coast SUNS', homePosition: 2,
    awayTeam: 'West Coast Eagles', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.01', awayOdds: '$19.00',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
]

// ── AFL Round 2 (19–22 Mar) ───────────────────────────────────────────────────
export const ROUND_3_FIXTURES: AflFixture[] = [
  {
    id: 'r3-1', round: 3,
    date: 'Thursday March 19', time: '7:30pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Hawthorn', homePosition: null,
    awayTeam: 'Sydney Swans', awayPosition: 1,
    homeScore: null, awayScore: null,
    homeOdds: '$2.80', awayOdds: '$1.45',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r3-2', round: 3,
    date: 'Friday March 20', time: '7:10pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Adelaide Crows', homePosition: null,
    awayTeam: 'Western Bulldogs', awayPosition: 5,
    homeScore: null, awayScore: null,
    homeOdds: '$2.20', awayOdds: '$1.65',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r3-3', round: 3,
    date: 'Saturday March 21', time: '1:15pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Richmond', homePosition: null,
    awayTeam: 'Gold Coast SUNS', awayPosition: 2,
    homeScore: null, awayScore: null,
    homeOdds: '$3.20', awayOdds: '$1.35',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r3-4', round: 3,
    date: 'Sunday March 22', time: '2:45pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Port Adelaide', homePosition: null,
    awayTeam: 'Essendon', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.55', awayOdds: '$2.45',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
]

// ── AFL Round 3 (26–29 Mar) ───────────────────────────────────────────────────
// Byes: Gold Coast SUNS, Hawthorn, Sydney Swans, Western Bulldogs
export const ROUND_4_FIXTURES: AflFixture[] = [
  {
    id: 'r4-1', round: 4,
    date: 'Thursday March 26', time: '7:30pm AEDT',
    venue: 'GMHBA Stadium, Geelong', country: 'Wadawurrung',
    homeTeam: 'Geelong Cats', homePosition: null,
    awayTeam: 'Adelaide Crows', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.45', awayOdds: '$2.75',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r4-2', round: 4,
    date: 'Friday March 27', time: '7:30pm AEDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Collingwood', homePosition: 4,
    awayTeam: 'GWS GIANTS', awayPosition: 3,
    homeScore: null, awayScore: null,
    homeOdds: '$1.60', awayOdds: '$2.35',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r4-3', round: 4,
    date: 'Saturday March 28', time: '1:45pm AEDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'St Kilda', homePosition: 9,
    awayTeam: 'Brisbane Lions', awayPosition: 6,
    homeScore: null, awayScore: null,
    homeOdds: '$2.50', awayOdds: '$1.55',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r4-4', round: 4,
    date: 'Saturday March 28', time: '4:30pm AWST',
    venue: 'Optus Stadium, Perth', country: 'Whadjuk Noongar',
    homeTeam: 'Fremantle', homePosition: null,
    awayTeam: 'Richmond', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.50', awayOdds: '$2.60',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r4-5', round: 4,
    date: 'Saturday March 28', time: '7:25pm AEDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Essendon', homePosition: null,
    awayTeam: 'North Melbourne', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.40', awayOdds: '$2.95',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r4-6', round: 4,
    date: 'Sunday March 29', time: '12:30pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Port Adelaide', homePosition: null,
    awayTeam: 'West Coast Eagles', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.30', awayOdds: '$3.50',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r4-7', round: 4,
    date: 'Sunday March 29', time: '3:20pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Carlton', homePosition: null,
    awayTeam: 'Melbourne', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.70', awayOdds: '$2.15',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
]

// ── AFL Round 4 — Easter Round (2–6 Apr) ─────────────────────────────────────
export const ROUND_5_FIXTURES: AflFixture[] = [
  {
    id: 'r5-1', round: 5,
    date: 'Thursday April 2', time: '7:25pm AEST',
    venue: 'The Gabba, Brisbane', country: 'Turrbal & Jagera',
    homeTeam: 'Brisbane Lions', homePosition: null,
    awayTeam: 'Collingwood', awayPosition: 4,
    homeScore: null, awayScore: null,
    homeOdds: '$1.75', awayOdds: '$2.10',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-2', round: 5,
    date: 'Friday April 3', time: '3:20pm AEDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'North Melbourne', homePosition: null,
    awayTeam: 'Carlton', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$3.00', awayOdds: '$1.40',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-3', round: 5,
    date: 'Friday April 3', time: '7:10pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Adelaide Crows', homePosition: null,
    awayTeam: 'Fremantle', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.65', awayOdds: '$2.25',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-4', round: 5,
    date: 'Saturday April 4', time: '1:45pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Richmond', homePosition: null,
    awayTeam: 'Port Adelaide', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$2.80', awayOdds: '$1.45',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-5', round: 5,
    date: 'Saturday April 4', time: '4:30pm AWST',
    venue: 'Optus Stadium, Perth', country: 'Whadjuk Noongar',
    homeTeam: 'West Coast Eagles', homePosition: null,
    awayTeam: 'Sydney Swans', awayPosition: 1,
    homeScore: null, awayScore: null,
    homeOdds: '$2.60', awayOdds: '$1.50',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-6', round: 5,
    date: 'Sunday April 5', time: '3:20pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Melbourne', homePosition: null,
    awayTeam: 'Gold Coast SUNS', awayPosition: 2,
    homeScore: null, awayScore: null,
    homeOdds: '$1.80', awayOdds: '$2.05',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-7', round: 5,
    date: 'Sunday April 5', time: '4:40pm AEDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Western Bulldogs', homePosition: 5,
    awayTeam: 'Essendon', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.55', awayOdds: '$2.45',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r5-8', round: 5,
    date: 'Monday April 6', time: '3:20pm AEDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri Woi Wurrung',
    homeTeam: 'Hawthorn', homePosition: null,
    awayTeam: 'Geelong Cats', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$2.40', awayOdds: '$1.58',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
]

// ── AFL Round 5 — Gather Round (9–12 Apr, all SA) ────────────────────────────
export const ROUND_6_FIXTURES: AflFixture[] = [
  {
    id: 'r6-1', round: 6,
    date: 'Thursday April 9', time: '7:10pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Adelaide Crows', homePosition: null,
    awayTeam: 'Carlton', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.80', awayOdds: '$2.05',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-2', round: 6,
    date: 'Friday April 10', time: '4:05pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Collingwood', homePosition: 4,
    awayTeam: 'Fremantle', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.50', awayOdds: '$2.60',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-3', round: 6,
    date: 'Saturday April 11', time: '12:05pm ACDT',
    venue: 'Barossa Park, Nuriootpa', country: 'Ngadjuri',
    homeTeam: 'North Melbourne', homePosition: null,
    awayTeam: 'Brisbane Lions', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$3.10', awayOdds: '$1.38',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-4', round: 6,
    date: 'Saturday April 11', time: '2:10pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Essendon', homePosition: null,
    awayTeam: 'Melbourne', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.70', awayOdds: '$2.15',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-5', round: 6,
    date: 'Saturday April 11', time: '4:05pm ACDT',
    venue: 'Norwood Oval, Norwood', country: 'Kaurna',
    homeTeam: 'Sydney Swans', homePosition: 1,
    awayTeam: 'Gold Coast SUNS', awayPosition: 2,
    homeScore: null, awayScore: null,
    homeOdds: '$1.40', awayOdds: '$2.90',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-6', round: 6,
    date: 'Saturday April 11', time: '7:10pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Hawthorn', homePosition: null,
    awayTeam: 'Western Bulldogs', awayPosition: 5,
    homeScore: null, awayScore: null,
    homeOdds: '$2.20', awayOdds: '$1.68',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-7', round: 6,
    date: 'Sunday April 12', time: '12:35pm ACDT',
    venue: 'Norwood Oval, Norwood', country: 'Kaurna',
    homeTeam: 'Geelong Cats', homePosition: null,
    awayTeam: 'West Coast Eagles', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.35', awayOdds: '$3.20',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-8', round: 6,
    date: 'Sunday April 12', time: '2:35pm ACDT',
    venue: 'Barossa Park, Nuriootpa', country: 'Ngadjuri',
    homeTeam: 'GWS GIANTS', homePosition: 3,
    awayTeam: 'Richmond', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.55', awayOdds: '$2.45',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r6-9', round: 6,
    date: 'Sunday April 12', time: '4:40pm ACDT',
    venue: 'Adelaide Oval, Adelaide', country: 'Kaurna',
    homeTeam: 'Port Adelaide', homePosition: null,
    awayTeam: 'St Kilda', awayPosition: 9,
    homeScore: null, awayScore: null,
    homeOdds: '$1.45', awayOdds: '$2.75',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
]

// ── Structured round metadata for round selector + auto-detection ─────────────
export interface AflRoundMeta {
  index: number          // internal index (0-based)
  label: string          // display label e.g. "Opening Round", "Round 1"
  shortLabel: string     // e.g. "OR", "Rd 1"
  dateRange: string      // e.g. "Thu 5 – Sun 8 Mar"
  startDate: Date        // for auto-detection
  endDate: Date          // for auto-detection
  fixtures: AflFixture[]
}

export const AFL_ROUNDS: AflRoundMeta[] = [
  {
    index: 0,
    label: 'Opening Round',
    shortLabel: 'OR',
    dateRange: 'Thu 5 – Sun 8 Mar',
    startDate: new Date('2026-03-05'),
    endDate:   new Date('2026-03-08'),
    fixtures: ROUND_1_FIXTURES,
  },
  {
    index: 1,
    label: 'Round 1',
    shortLabel: 'Rd 1',
    dateRange: 'Thu 12 – Sun 15 Mar',
    startDate: new Date('2026-03-12'),
    endDate:   new Date('2026-03-15'),
    fixtures: ROUND_2_FIXTURES,
  },
  {
    index: 2,
    label: 'Round 2',
    shortLabel: 'Rd 2',
    dateRange: 'Thu 19 – Sun 22 Mar',
    startDate: new Date('2026-03-19'),
    endDate:   new Date('2026-03-22'),
    fixtures: ROUND_3_FIXTURES,
  },
  {
    index: 3,
    label: 'Round 3',
    shortLabel: 'Rd 3',
    dateRange: 'Thu 26 – Sun 29 Mar',
    startDate: new Date('2026-03-26'),
    endDate:   new Date('2026-03-29'),
    fixtures: ROUND_4_FIXTURES,
  },
  {
    index: 4,
    label: 'Round 4 — Easter',
    shortLabel: 'Rd 4',
    dateRange: 'Thu 2 – Mon 6 Apr',
    startDate: new Date('2026-04-02'),
    endDate:   new Date('2026-04-06'),
    fixtures: ROUND_5_FIXTURES,
  },
  {
    index: 5,
    label: 'Round 5 — Gather Round',
    shortLabel: 'Rd 5',
    dateRange: 'Thu 9 – Sun 12 Apr',
    startDate: new Date('2026-04-09'),
    endDate:   new Date('2026-04-12'),
    fixtures: ROUND_6_FIXTURES,
  },
]

const WAFL_URL = 'https://www.wafl.com.au/fixture'

export const WAFL_ROUND_1_FIXTURES: AflFixture[] = [
  {
    id: 'wafl-r1-1', round: 1,
    date: 'Saturday March 29', time: '2:10pm AWST',
    venue: 'Fremantle Oval, Fremantle', country: 'Whadjuk Noongar',
    homeTeam: 'East Fremantle', homePosition: null,
    awayTeam: 'South Fremantle', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: null, awayOdds: null,
    status: 'UPCOMING', winner: null,
    matchReportUrl: WAFL_URL,
  },
  {
    id: 'wafl-r1-2', round: 1,
    date: 'Saturday March 29', time: '2:10pm AWST',
    venue: 'Claremont Oval, Claremont', country: 'Whadjuk Noongar',
    homeTeam: 'Claremont Tigers', homePosition: null,
    awayTeam: 'West Perth', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: null, awayOdds: null,
    status: 'UPCOMING', winner: null,
    matchReportUrl: WAFL_URL,
  },
  {
    id: 'wafl-r1-3', round: 1,
    date: 'Saturday March 29', time: '2:10pm AWST',
    venue: 'Leederville Oval, Perth', country: 'Whadjuk Noongar',
    homeTeam: 'Perth Demons', homePosition: null,
    awayTeam: 'Swan Districts', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: null, awayOdds: null,
    status: 'UPCOMING', winner: null,
    matchReportUrl: WAFL_URL,
  },
  {
    id: 'wafl-r1-4', round: 1,
    date: 'Saturday March 29', time: '2:10pm AWST',
    venue: 'Subiaco Oval, Subiaco', country: 'Whadjuk Noongar',
    homeTeam: 'Subiaco', homePosition: null,
    awayTeam: 'East Perth', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: null, awayOdds: null,
    status: 'UPCOMING', winner: null,
    matchReportUrl: WAFL_URL,
  },
  {
    id: 'wafl-r1-5', round: 1,
    date: 'Sunday March 30', time: '12:05pm AWST',
    venue: 'David Grays Arena, Mandurah', country: 'Bindjareb Noongar',
    homeTeam: 'Peel Thunder', homePosition: null,
    awayTeam: 'West Coast', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: null, awayOdds: null,
    status: 'UPCOMING', winner: null,
    matchReportUrl: WAFL_URL,
  },
]
