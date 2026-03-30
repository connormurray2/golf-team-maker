import React from 'react';
import { Pair, TEAM_COLORS } from '../types';

interface PairCardProps {
  pair: Pair;
  teamIndex: number;
  onDragStart: (e: React.DragEvent, pair: Pair, sourceGroupId: string | null) => void;
  onDragEnd: (e: React.DragEvent) => void;
  sourceGroupId: string | null;
}

const PairCard: React.FC<PairCardProps> = ({
  pair,
  teamIndex,
  onDragStart,
  onDragEnd,
  sourceGroupId
}) => {
  const color = TEAM_COLORS[teamIndex] || '#999';

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, pair, sourceGroupId);
  };

  return (
    <div
      className="pair-card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: color }}
    >
      <div className="pair-team-label" style={{ backgroundColor: color }}>
        {pair.sourceTeamName}
      </div>
      <div className="pair-players">
        {pair.players.map(player => (
          <div key={player.id} className="pair-player">
            <span className="pair-player-name">{player.name}</span>
            <span className={`rating-badge ${player.rating}`}>{player.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PairCard;
