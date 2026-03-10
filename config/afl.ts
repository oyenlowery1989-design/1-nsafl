export interface AflClub {
  id: string
  name: string
  shortName: string
  color: string
  logo: string
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
  { id: 'adelaide',          name: 'Adelaide Crows',    shortName: 'ADL', color: '#002B5C', logo: 'https://r2.thesportsdb.com/images/media/team/badge/2nh2z01731592341.png' },
  { id: 'brisbane',          name: 'Brisbane Lions',    shortName: 'BRL', color: '#A30046', logo: 'https://r2.thesportsdb.com/images/media/team/badge/tvvxvp1474038810.png' },
  { id: 'carlton',           name: 'Carlton',           shortName: 'CAR', color: '#0E3C96', logo: 'https://r2.thesportsdb.com/images/media/team/badge/k9no791584810309.png' },
  { id: 'collingwood',       name: 'Collingwood',       shortName: 'COL', color: '#000000', logo: 'https://r2.thesportsdb.com/images/media/team/badge/a2uqkd1584810538.png' },
  { id: 'essendon',          name: 'Essendon',          shortName: 'ESS', color: '#CC2031', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xwupps1474039541.png' },
  { id: 'fremantle',         name: 'Fremantle',         shortName: 'FRE', color: '#2A1A54', logo: 'https://r2.thesportsdb.com/images/media/team/badge/hw34ii1647870691.png' },
  { id: 'geelong',           name: 'Geelong Cats',      shortName: 'GEE', color: '#1C3F94', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xapo7t1647870681.png' },
  { id: 'gold-coast',        name: 'Gold Coast SUNS',   shortName: 'GCS', color: '#E5232B', logo: 'https://r2.thesportsdb.com/images/media/team/badge/4os77n1731592560.png' },
  { id: 'gws',               name: 'GWS GIANTS',        shortName: 'GWS', color: '#F47920', logo: 'https://r2.thesportsdb.com/images/media/team/badge/ef6rqs1647870839.png' },
  { id: 'hawthorn',          name: 'Hawthorn',          shortName: 'HAW', color: '#4D2004', logo: 'https://r2.thesportsdb.com/images/media/team/badge/18y3ks1647870779.png' },
  { id: 'melbourne',         name: 'Melbourne',         shortName: 'MEL', color: '#CC2031', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xvtstv1474039391.png' },
  { id: 'north-melbourne',   name: 'North Melbourne',   shortName: 'NTH', color: '#003CA6', logo: 'https://r2.thesportsdb.com/images/media/team/badge/u5x1ok1584811490.png' },
  { id: 'port-adelaide',     name: 'Port Adelaide',     shortName: 'PAP', color: '#008AAB', logo: 'https://r2.thesportsdb.com/images/media/team/badge/7qvqn81584810882.png' },
  { id: 'richmond',          name: 'Richmond',          shortName: 'RIC', color: '#FED102', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xkqlvb1647870792.png' },
  { id: 'st-kilda',          name: 'St Kilda',          shortName: 'STK', color: '#ED0F05', logo: 'https://r2.thesportsdb.com/images/media/team/badge/fvj5ez1732026459.png' },
  { id: 'sydney',            name: 'Sydney Swans',      shortName: 'SYD', color: '#E2001A', logo: 'https://r2.thesportsdb.com/images/media/team/badge/ndeir91647870648.png' },
  { id: 'west-coast',        name: 'West Coast Eagles', shortName: 'WCE', color: '#003087', logo: 'https://r2.thesportsdb.com/images/media/team/badge/xpcp2f1647870746.png' },
  { id: 'western-bulldogs',  name: 'Western Bulldogs',  shortName: 'WBD', color: '#0057A5', logo: 'https://r2.thesportsdb.com/images/media/team/badge/e3hg551647870757.png' },
]

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
    date: 'Thursday March 13', time: '4:30am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Carlton', homePosition: 10,
    awayTeam: 'Richmond', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.37', awayOdds: '$3.14',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-2', round: 2,
    date: 'Friday March 14', time: '4:40am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Essendon', homePosition: 8,
    awayTeam: 'Hawthorn', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$4.30', awayOdds: '$1.22',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-3', round: 2,
    date: 'Friday March 14', time: '10:15pm EDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Western Bulldogs', homePosition: 5,
    awayTeam: 'GWS GIANTS', awayPosition: 3,
    homeScore: null, awayScore: null,
    homeOdds: '$1.35', awayOdds: '$3.22',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-4', round: 2,
    date: 'Saturday March 15', time: '1:15am EDT',
    venue: 'GMHBA Stadium, Geelong', country: 'Wadawurrung',
    homeTeam: 'Geelong Cats', homePosition: 9,
    awayTeam: 'Fremantle', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.54', awayOdds: '$2.49',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-5', round: 2,
    date: 'Saturday March 15', time: '4:10am EDT',
    venue: 'SCG, Sydney', country: 'Gadigal',
    homeTeam: 'Sydney Swans', homePosition: 1,
    awayTeam: 'Brisbane Lions', awayPosition: 6,
    homeScore: null, awayScore: null,
    homeOdds: '$1.46', awayOdds: '$2.72',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-6', round: 2,
    date: 'Saturday March 15', time: '4:35am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Collingwood', homePosition: 4,
    awayTeam: 'Adelaide Crows', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.72', awayOdds: '$2.13',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-7', round: 2,
    date: 'Saturday March 15', time: '10:10pm EDT',
    venue: 'Marvel Stadium, Melbourne', country: 'Wurundjeri',
    homeTeam: 'North Melbourne', homePosition: null,
    awayTeam: 'Port Adelaide', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$2.36', awayOdds: '$1.59',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-8', round: 2,
    date: 'Sunday March 16', time: '12:15am EDT',
    venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'Melbourne', homePosition: null,
    awayTeam: 'St Kilda', awayPosition: 7,
    homeScore: null, awayScore: null,
    homeOdds: '$2.39', awayOdds: '$1.58',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
  {
    id: 'r2-9', round: 2,
    date: 'Sunday March 16', time: '3:10am EDT',
    venue: 'People First Stadium, Gold Coast', country: 'Yugambeh',
    homeTeam: 'Gold Coast SUNS', homePosition: 2,
    awayTeam: 'West Coast Eagles', awayPosition: null,
    homeScore: null, awayScore: null,
    homeOdds: '$1.01', awayOdds: '$19.00',
    status: 'UPCOMING', winner: null,
    matchReportUrl: AFL_URL,
  },
]
