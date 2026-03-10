export interface AflPlayer {
  name: string
  club: string // matches AFL_CLUBS[].id
}

export const AFL_PLAYERS: AflPlayer[] = [
  // Adelaide Crows
  { name: 'Taylor Walker', club: 'adelaide' },
  { name: 'Rory Laird', club: 'adelaide' },
  { name: 'Jordan Dawson', club: 'adelaide' },
  { name: 'Ben Keays', club: 'adelaide' },
  { name: 'Izak Rankine', club: 'adelaide' },
  { name: 'Brodie Smith', club: 'adelaide' },

  // Brisbane Lions
  { name: 'Lachie Neale', club: 'brisbane' },
  { name: 'Charlie Cameron', club: 'brisbane' },
  { name: 'Joe Daniher', club: 'brisbane' },
  { name: 'Harris Andrews', club: 'brisbane' },
  { name: 'Zac Bailey', club: 'brisbane' },
  { name: 'Dayne Zorko', club: 'brisbane' },

  // Carlton
  { name: 'Patrick Cripps', club: 'carlton' },
  { name: 'Harry McKay', club: 'carlton' },
  { name: 'Sam Walsh', club: 'carlton' },
  { name: 'Charlie Curnow', club: 'carlton' },
  { name: 'Adam Cerra', club: 'carlton' },
  { name: 'Marc Murphy', club: 'carlton' },

  // Collingwood
  { name: 'Scott Pendlebury', club: 'collingwood' },
  { name: 'Nick Daicos', club: 'collingwood' },
  { name: 'Jordan De Goey', club: 'collingwood' },
  { name: 'Jamie Elliott', club: 'collingwood' },
  { name: 'Darcy Moore', club: 'collingwood' },
  { name: 'Mason Cox', club: 'collingwood' },

  // Essendon
  { name: 'Zach Merrett', club: 'essendon' },
  { name: 'Dyson Heppell', club: 'essendon' },
  { name: 'Devon Smith', club: 'essendon' },
  { name: 'Jake Stringer', club: 'essendon' },
  { name: 'Peter Wright', club: 'essendon' },
  { name: 'Sam Durham', club: 'essendon' },

  // Fremantle
  { name: 'Nat Fyfe', club: 'fremantle' },
  { name: 'Andrew Brayshaw', club: 'fremantle' },
  { name: 'Caleb Serong', club: 'fremantle' },
  { name: 'Michael Walters', club: 'fremantle' },
  { name: 'Rory Lobb', club: 'fremantle' },
  { name: 'David Mundy', club: 'fremantle' },

  // Geelong Cats
  { name: 'Patrick Dangerfield', club: 'geelong' },
  { name: 'Tom Hawkins', club: 'geelong' },
  { name: 'Jeremy Cameron', club: 'geelong' },
  { name: 'Joel Selwood', club: 'geelong' },
  { name: 'Mark Blicavs', club: 'geelong' },
  { name: 'Isaac Smith', club: 'geelong' },

  // Gold Coast Suns
  { name: 'Touk Miller', club: 'goldcoast' },
  { name: 'Matthew Rowell', club: 'goldcoast' },
  { name: 'Noah Anderson', club: 'goldcoast' },
  { name: 'Ben King', club: 'goldcoast' },
  { name: 'Sam Flanders', club: 'goldcoast' },
  { name: 'David Swallow', club: 'goldcoast' },

  // GWS Giants
  { name: 'Toby Greene', club: 'gws' },
  { name: 'Josh Kelly', club: 'gws' },
  { name: 'Lachie Whitfield', club: 'gws' },
  { name: 'Tim Taranto', club: 'gws' },
  { name: 'Stephen Coniglio', club: 'gws' },
  { name: 'Jesse Hogan', club: 'gws' },

  // Hawthorn
  { name: 'James Worpel', club: 'hawthorn' },
  { name: 'Chad Wingard', club: 'hawthorn' },
  { name: 'Dylan Moore', club: 'hawthorn' },
  { name: 'Will Day', club: 'hawthorn' },
  { name: 'Jack Gunston', club: 'hawthorn' },
  { name: 'Jai Newcombe', club: 'hawthorn' },

  // Melbourne
  { name: 'Christian Petracca', club: 'melbourne' },
  { name: 'Clayton Oliver', club: 'melbourne' },
  { name: 'Max Gawn', club: 'melbourne' },
  { name: 'Jake Lever', club: 'melbourne' },
  { name: 'Angus Brayshaw', club: 'melbourne' },
  { name: 'Steven May', club: 'melbourne' },

  // North Melbourne
  { name: 'Luke Davies-Uniacke', club: 'northmelbourne' },
  { name: 'Jason Horne-Francis', club: 'northmelbourne' },
  { name: 'Nick Larkey', club: 'northmelbourne' },
  { name: 'Tristan Xerri', club: 'northmelbourne' },
  { name: 'Jaidyn Stephenson', club: 'northmelbourne' },
  { name: 'Callum Coleman-Jones', club: 'northmelbourne' },

  // Port Adelaide
  { name: 'Travis Boak', club: 'portadelaide' },
  { name: 'Connor Rozee', club: 'portadelaide' },
  { name: 'Zak Butters', club: 'portadelaide' },
  { name: 'Charlie Dixon', club: 'portadelaide' },
  { name: 'Ollie Wines', club: 'portadelaide' },
  { name: 'Karl Amon', club: 'portadelaide' },

  // Richmond
  { name: 'Dustin Martin', club: 'richmond' },
  { name: 'Tom Lynch', club: 'richmond' },
  { name: 'Shai Bolton', club: 'richmond' },
  { name: 'Dion Prestia', club: 'richmond' },
  { name: 'Jayden Short', club: 'richmond' },
  { name: 'Jack Riewoldt', club: 'richmond' },

  // St Kilda
  { name: 'Jack Steele', club: 'stkilda' },
  { name: 'Max King', club: 'stkilda' },
  { name: 'Brad Hill', club: 'stkilda' },
  { name: 'Hunter Clark', club: 'stkilda' },
  { name: 'Zak Jones', club: 'stkilda' },
  { name: 'Jade Gresham', club: 'stkilda' },

  // Sydney Swans
  { name: 'Lance Franklin', club: 'sydney' },
  { name: 'Callum Mills', club: 'sydney' },
  { name: 'Luke Parker', club: 'sydney' },
  { name: 'Errol Gulden', club: 'sydney' },
  { name: 'Isaac Heeney', club: 'sydney' },
  { name: 'Tom Papley', club: 'sydney' },

  // West Coast Eagles
  { name: 'Tim Kelly', club: 'westcoast' },
  { name: 'Oscar Allen', club: 'westcoast' },
  { name: 'Jake Waterman', club: 'westcoast' },
  { name: 'Elliot Yeo', club: 'westcoast' },
  { name: 'Luke Shuey', club: 'westcoast' },
  { name: 'Andrew Gaff', club: 'westcoast' },

  // Western Bulldogs
  { name: 'Marcus Bontempelli', club: 'westernbulldogs' },
  { name: 'Adam Treloar', club: 'westernbulldogs' },
  { name: 'Tom Liberatore', club: 'westernbulldogs' },
  { name: 'Lachie Hunter', club: 'westernbulldogs' },
  { name: 'Josh Bruce', club: 'westernbulldogs' },
  { name: 'Bailey Smith', club: 'westernbulldogs' },
]

/** Get all players for a specific club, sorted by name */
export function getPlayersByClub(clubId: string): AflPlayer[] {
  return AFL_PLAYERS.filter((p) => p.club === clubId).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}
