import React, { useState } from 'react';
import { SundayGroup, Pair } from '../types';
import PairCard from './PairCard';

interface SundayGroupBoxProps {
  group: SundayGroup;
  teamIndexMap: Map<string, number>;
  onDrop: (e: React.DragEvent, groupId: string) => void;
  onDragStart: (e: React.DragEvent, pair: Pair, sourceGroupId: string | null) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

const SundayGroupBox: React.FC<SundayGroupBoxProps> = ({
  group,
  teamIndexMap,
  onDrop,
  onDragStart,
  onDragEnd
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const currentTarget = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;
    if (!currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(e, group.id);
  };

  const isFull = group.pairs.length >= 2;
  const isComplete = group.pairs.length === 2;

  return (
    <div
      className={`sunday-group-box ${isDragOver ? 'drag-over' : ''} ${isComplete ? 'complete' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sunday-group-header">
        <span className="sunday-group-name">{group.name}</span>
        <span className="sunday-group-count">{group.pairs.length}/2 pairs</span>
      </div>
      <div className="sunday-group-pairs">
        {group.pairs.map(pair => (
          <PairCard
            key={pair.id}
            pair={pair}
            teamIndex={teamIndexMap.get(pair.sourceTeamId) ?? 0}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            sourceGroupId={group.id}
          />
        ))}
        {!isFull && (
          <div className="sunday-empty-slot">
            Drop a pair here
          </div>
        )}
      </div>
    </div>
  );
};

export default SundayGroupBox;
