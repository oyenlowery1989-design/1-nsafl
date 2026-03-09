export interface AflClub {
  id: string
  name: string
  shortName: string
  color: string
}

export interface AflFixture {
  id: string
  round: number
  date: string
  venue: string
  country: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: 'UPCOMING' | 'FULL TIME' | 'LIVE'
  winner: string | null
  matchReportUrl: string
}

export const AFL_CLUBS: AflClub[] = [
  { id: 'adelaide', name: 'Adelaide Crows', shortName: 'ADL', color: '#002B5C' },
  { id: 'brisbane', name: 'Brisbane Lions', shortName: 'BRL', color: '#A30046' },
  { id: 'carlton', name: 'Carlton', shortName: 'CAR', color: '#0E3C96' },
  { id: 'collingwood', name: 'Collingwood', shortName: 'COL', color: '#000000' },
  { id: 'essendon', name: 'Essendon', shortName: 'ESS', color: '#CC2031' },
  { id: 'fremantle', name: 'Fremantle', shortName: 'FRE', color: '#2A1A54' },
  { id: 'geelong', name: 'Geelong Cats', shortName: 'GEE', color: '#1C3F94' },
  { id: 'gold-coast', name: 'Gold Coast SUNS', shortName: 'GCS', color: '#E5232B' },
  { id: 'gws', name: 'GWS GIANTS', shortName: 'GWS', color: '#F47920' },
  { id: 'hawthorn', name: 'Hawthorn', shortName: 'HAW', color: '#4D2004' },
  { id: 'melbourne', name: 'Melbourne', shortName: 'MEL', color: '#CC2031' },
  { id: 'north-melbourne', name: 'North Melbourne', shortName: 'NTH', color: '#003CA6' },
  { id: 'port-adelaide', name: 'Port Adelaide', shortName: 'PAP', color: '#008AAB' },
  { id: 'richmond', name: 'Richmond', shortName: 'RIC', color: '#FED102' },
  { id: 'st-kilda', name: 'St Kilda', shortName: 'STK', color: '#ED0F05' },
  { id: 'sydney', name: 'Sydney Swans', shortName: 'SYD', color: '#E2001A' },
  { id: 'west-coast', name: 'West Coast Eagles', shortName: 'WCE', color: '#003087' },
  { id: 'western-bulldogs', name: 'Western Bulldogs', shortName: 'WBD', color: '#0057A5' },
]

export const ROUND_1_FIXTURES: AflFixture[] = [
  {
    id: 'r1-1', round: 1,
    date: 'Thursday March 5', venue: 'SCG, Sydney', country: 'Gadigal',
    homeTeam: 'Sydney Swans', awayTeam: 'Carlton',
    homeScore: 132, awayScore: 69,
    status: 'FULL TIME', winner: 'Sydney Swans won by 63',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-2', round: 1,
    date: 'Friday March 6', venue: 'People First Stadium, Gold Coast', country: 'Yugambeh',
    homeTeam: 'Gold Coast SUNS', awayTeam: 'Geelong Cats',
    homeScore: 125, awayScore: 69,
    status: 'FULL TIME', winner: 'Gold Coast SUNS won by 56',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-3', round: 1,
    date: 'Saturday March 7', venue: 'ENGIE Stadium, Sydney', country: 'Wangal',
    homeTeam: 'GWS GIANTS', awayTeam: 'Hawthorn',
    homeScore: 122, awayScore: 95,
    status: 'FULL TIME', winner: 'GWS GIANTS won by 27',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-4', round: 1,
    date: 'Saturday March 7', venue: 'Gabba, Brisbane', country: 'Yuggera - Toorabul',
    homeTeam: 'Brisbane Lions', awayTeam: 'Western Bulldogs',
    homeScore: 106, awayScore: 111,
    status: 'FULL TIME', winner: 'Western Bulldogs won by 5',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-5', round: 1,
    date: 'Sunday March 8', venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'St Kilda', awayTeam: 'Collingwood',
    homeScore: 66, awayScore: 78,
    status: 'FULL TIME', winner: 'Collingwood won by 12',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
]
