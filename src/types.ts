export type Rating = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-';

export interface Player {
  id: string;
  name: string;
  rating: Rating;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  lockedPlayers: Set<string>; // Set of player IDs that are locked to this team
}

export interface DragItem {
  player: Player;
  sourceTeamId: string | null;
}

// Team color palette for Sunday Pairings (8 distinct colors by team index)
export const TEAM_COLORS: string[] = [
  '#4A90D9', // Team 1 - Blue
  '#E74C3C', // Team 2 - Red
  '#2ECC71', // Team 3 - Green
  '#F39C12', // Team 4 - Orange
  '#9B59B6', // Team 5 - Purple
  '#1ABC9C', // Team 6 - Teal
  '#E91E63', // Team 7 - Pink
  '#795548', // Team 8 - Brown
];

// Sunday Pairings types
export interface Pair {
  id: string;
  players: [Player, Player];
  sourceTeamId: string;
  sourceTeamName: string;
}

export interface SundayGroup {
  id: string;
  name: string;
  pairs: Pair[];
}

export interface SundayDragItem {
  pair: Pair;
  sourceGroupId: string | null; // null = from unassigned pool
}

export interface SundayConfiguration {
  id: string;
  name: string;
  date: string;
  type: 'sunday';
  groups: SundayGroup[];
  unassignedPairs: Pair[];
}

export interface SavedConfiguration {
  id: string;
  name: string;
  date: string;
  teams: {
    id: string;
    name: string;
    players: Player[];
    lockedPlayers: string[]; // Array of player IDs (for serialization)
  }[];
  unassignedPlayers: Player[];
}