import React, { useState, useEffect, useCallback } from 'react';
import { Player, Pair, SundayGroup, SundayDragItem, SundayConfiguration, TEAM_COLORS } from '../types';
import { fetchSavedConfigs, saveSavedConfig, deleteSavedConfig } from '../api';
import PairCard from './PairCard';
import SundayGroupBox from './SundayGroupBox';

const SUNDAY_WORKING_DRAFT_KEY = '__SUNDAY_WORKING_DRAFT__';

interface TeamData {
  id: string;
  name: string;
  players: Player[];
}

const SundayPairings: React.FC = () => {
  const [pairs, setPairs] = useState<Pair[]>([]); // unassigned pairs pool
  const [groups, setGroups] = useState<SundayGroup[]>([]);
  const [draggedItem, setDraggedItem] = useState<SundayDragItem | null>(null);
  const [teamIndexMap, setTeamIndexMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasTeams, setHasTeams] = useState(false);

  // Save/load state
  const [savedConfigs, setSavedConfigs] = useState<SundayConfiguration[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveModalTab, setSaveModalTab] = useState<'save' | 'load'>('save');

  // Build team index map from teams
  const buildTeamIndexMap = useCallback((teams: TeamData[]) => {
    const map = new Map<string, number>();
    teams.forEach((team, index) => {
      map.set(team.id, index);
    });
    return map;
  }, []);

  // Split a 4-player team into 2 pairs
  const splitTeamIntoPairs = useCallback((team: TeamData): Pair[] => {
    const teamPairs: Pair[] = [];
    const players = team.players;

    if (players.length >= 2) {
      teamPairs.push({
        id: `${team.id}-pair-a`,
        players: [players[0], players[1]],
        sourceTeamId: team.id,
        sourceTeamName: team.name,
      });
    }
    if (players.length >= 4) {
      teamPairs.push({
        id: `${team.id}-pair-b`,
        players: [players[2], players[3]],
        sourceTeamId: team.id,
        sourceTeamName: team.name,
      });
    } else if (players.length === 3) {
      // Handle odd case: pair of 1 shown as pair with placeholder
      teamPairs.push({
        id: `${team.id}-pair-b`,
        players: [players[2], players[2]], // duplicate to fill - edge case
        sourceTeamId: team.id,
        sourceTeamName: team.name,
      });
    }

    return teamPairs;
  }, []);

  // Load Saturday teams from working draft
  const loadSaturdayTeams = useCallback(() => {
    try {
      const storedDraft = localStorage.getItem('__WORKING_DRAFT__');
      if (!storedDraft) {
        setHasTeams(false);
        setLoading(false);
        return null;
      }

      const draft = JSON.parse(storedDraft);
      const teams: TeamData[] = draft.teams || [];
      const teamsWithPlayers = teams.filter(t => t.players.length >= 2);

      if (teamsWithPlayers.length === 0) {
        setHasTeams(false);
        setLoading(false);
        return null;
      }

      setHasTeams(true);
      return teamsWithPlayers;
    } catch {
      setHasTeams(false);
      setLoading(false);
      return null;
    }
  }, []);

  // Initialize from Saturday teams (fresh import)
  const importFromSaturdayTeams = useCallback(() => {
    const teams = loadSaturdayTeams();
    if (!teams) return;

    const indexMap = buildTeamIndexMap(teams);
    setTeamIndexMap(indexMap);

    // Split all teams into pairs
    const allPairs = teams.flatMap(t => splitTeamIntoPairs(t));
    setPairs(allPairs);

    // Create group slots: one group per 2 pairs (i.e., teams.length groups since each team contributes 2 pairs)
    const numGroups = Math.ceil(allPairs.length / 2);
    const newGroups: SundayGroup[] = [];
    for (let i = 0; i < numGroups; i++) {
      newGroups.push({
        id: `sunday-group-${i + 1}`,
        name: `Group ${i + 1}`,
        pairs: [],
      });
    }
    setGroups(newGroups);
    setLoading(false);
  }, [loadSaturdayTeams, buildTeamIndexMap, splitTeamIntoPairs]);

  // Load Sunday working draft or import fresh
  useEffect(() => {
    const storedSundayDraft = localStorage.getItem(SUNDAY_WORKING_DRAFT_KEY);

    if (storedSundayDraft) {
      try {
        const draft: SundayConfiguration = JSON.parse(storedSundayDraft);
        setGroups(draft.groups);
        setPairs(draft.unassignedPairs);

        // Rebuild team index map from all pairs
        const allPairs = [...draft.unassignedPairs, ...draft.groups.flatMap(g => g.pairs)];
        const teamIds = new Set(allPairs.map(p => p.sourceTeamId));
        const map = new Map<string, number>();
        let idx = 0;
        teamIds.forEach(id => {
          map.set(id, idx++);
        });
        setTeamIndexMap(map);
        setHasTeams(true);
        setLoading(false);
      } catch {
        importFromSaturdayTeams();
      }
    } else {
      importFromSaturdayTeams();
    }

    // Load saved Sunday configs
    loadSavedSundayConfigs();
  }, [importFromSaturdayTeams]);

  // Auto-save to localStorage on changes
  useEffect(() => {
    if (!loading && hasTeams) {
      const draft: SundayConfiguration = {
        id: SUNDAY_WORKING_DRAFT_KEY,
        name: '__Sunday Working Draft__',
        date: new Date().toISOString(),
        type: 'sunday',
        groups,
        unassignedPairs: pairs,
      };
      localStorage.setItem(SUNDAY_WORKING_DRAFT_KEY, JSON.stringify(draft));
    }
  }, [groups, pairs, loading, hasTeams]);

  const loadSavedSundayConfigs = async () => {
    try {
      const allConfigs = await fetchSavedConfigs();
      // Filter for Sunday configs by checking for the type field
      const sundayConfigs = allConfigs.filter((c: any) => c.type === 'sunday') as unknown as SundayConfiguration[];
      setSavedConfigs(sundayConfigs);
    } catch {
      // Ignore errors loading configs
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, pair: Pair, sourceGroupId: string | null) => {
    setDraggedItem({ pair, sourceGroupId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDropOnGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    const targetGroup = groups.find(g => g.id === targetGroupId);
    if (!targetGroup) return;

    // Reject if full
    if (targetGroup.pairs.length >= 2) {
      return;
    }

    // Don't drop on same group
    if (draggedItem.sourceGroupId === targetGroupId) return;

    // Remove from source
    if (draggedItem.sourceGroupId) {
      setGroups(prev =>
        prev.map(g =>
          g.id === draggedItem.sourceGroupId
            ? { ...g, pairs: g.pairs.filter(p => p.id !== draggedItem.pair.id) }
            : g
        )
      );
    } else {
      setPairs(prev => prev.filter(p => p.id !== draggedItem.pair.id));
    }

    // Add to target group
    setGroups(prev =>
      prev.map(g =>
        g.id === targetGroupId
          ? { ...g, pairs: [...g.pairs, draggedItem.pair] }
          : g
      )
    );
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem || !draggedItem.sourceGroupId) return;

    // Remove from source group
    setGroups(prev =>
      prev.map(g =>
        g.id === draggedItem.sourceGroupId
          ? { ...g, pairs: g.pairs.filter(p => p.id !== draggedItem.pair.id) }
          : g
      )
    );

    // Add back to pool
    setPairs(prev => [...prev, draggedItem.pair]);
  };

  // Swap a player between the two pairs of the same team
  const swapPlayerBetweenPairs = (pairId: string, playerIndex: number) => {
    // Find the pair and its sibling pair (same team)
    const allPairs = [...pairs, ...groups.flatMap(g => g.pairs)];
    const thisPair = allPairs.find(p => p.id === pairId);
    if (!thisPair) return;

    const siblingPairId = pairId.endsWith('-pair-a')
      ? pairId.replace('-pair-a', '-pair-b')
      : pairId.replace('-pair-b', '-pair-a');
    const siblingPair = allPairs.find(p => p.id === siblingPairId);
    if (!siblingPair) return;

    // Swap: take player from this pair, swap with first player of sibling
    const swapFrom = thisPair.players[playerIndex];
    const swapTo = siblingPair.players[0];

    const updatedThisPair: Pair = {
      ...thisPair,
      players: playerIndex === 0
        ? [swapTo, thisPair.players[1]]
        : [thisPair.players[0], swapTo],
    };
    const updatedSiblingPair: Pair = {
      ...siblingPair,
      players: [swapFrom, siblingPair.players[1]],
    };

    // Apply updates to both pools and groups
    const updatePair = (p: Pair) => {
      if (p.id === updatedThisPair.id) return updatedThisPair;
      if (p.id === updatedSiblingPair.id) return updatedSiblingPair;
      return p;
    };

    setPairs(prev => prev.map(updatePair));
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        pairs: g.pairs.map(updatePair),
      }))
    );
  };

  // Save/Load handlers
  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      const config: any = {
        id: Math.random().toString(36).substr(2, 9),
        name: saveName.trim(),
        date: new Date().toISOString(),
        type: 'sunday',
        groups,
        unassignedPairs: pairs,
      };

      await saveSavedConfig(config);
      setSaveName('');
      setSaveModalTab('load');
      await loadSavedSundayConfigs();
    } catch {
      alert('Failed to save configuration');
    }
  };

  const handleLoad = (config: SundayConfiguration) => {
    setGroups(config.groups);
    setPairs(config.unassignedPairs);

    // Rebuild team index map
    const allPairs = [...config.unassignedPairs, ...config.groups.flatMap(g => g.pairs)];
    const teamIds = new Set(allPairs.map(p => p.sourceTeamId));
    const map = new Map<string, number>();
    let idx = 0;
    teamIds.forEach(id => {
      map.set(id, idx++);
    });
    setTeamIndexMap(map);

    setIsSaveModalOpen(false);
  };

  const handleDelete = async (configId: string) => {
    try {
      await deleteSavedConfig(configId);
      await loadSavedSundayConfigs();
    } catch {
      alert('Failed to delete configuration');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading Sunday Pairings...</div>
      </div>
    );
  }

  if (!hasTeams) {
    return (
      <div className="container">
        <div className="sunday-empty-state">
          <h2>Sunday Pairings</h2>
          <p>No Saturday teams found. Please set up and save your Saturday teams in the Team Builder first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Save/Load Modal */}
      {isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="modal-content saved-config-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sunday Pairing Configurations</h2>
              <button className="modal-close" onClick={() => setIsSaveModalOpen(false)}>x</button>
            </div>
            <div className="modal-tabs">
              <button
                className={`tab-button ${saveModalTab === 'save' ? 'active' : ''}`}
                onClick={() => setSaveModalTab('save')}
              >
                Save Current
              </button>
              <button
                className={`tab-button ${saveModalTab === 'load' ? 'active' : ''}`}
                onClick={() => setSaveModalTab('load')}
              >
                Load Saved ({savedConfigs.length})
              </button>
            </div>
            <div className="modal-body">
              {saveModalTab === 'save' && (
                <div className="save-config-section">
                  <h3>Save Current Pairings</h3>
                  <p className="save-description">Save your current Sunday pairing arrangement</p>
                  <div className="save-form">
                    <input
                      type="text"
                      className="config-name-input"
                      placeholder="Enter a name for this configuration"
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleSave()}
                      maxLength={50}
                    />
                    <button
                      className="btn btn-save"
                      onClick={handleSave}
                      disabled={!saveName.trim()}
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}
              {saveModalTab === 'load' && (
                <div className="load-config-section">
                  <h3>Saved Sunday Configurations</h3>
                  {savedConfigs.length === 0 ? (
                    <div className="no-configs">
                      <p>No saved Sunday configurations yet.</p>
                    </div>
                  ) : (
                    <div className="config-list">
                      {savedConfigs.map(config => (
                        <div key={config.id} className="config-item">
                          <div className="config-info">
                            <div className="config-name">{config.name}</div>
                            <div className="config-date">{formatDate(config.date)}</div>
                            <div className="config-stats">
                              {config.groups.filter(g => g.pairs.length > 0).length} groups filled
                            </div>
                          </div>
                          <div className="config-actions">
                            <button
                              className="btn btn-load"
                              onClick={() => handleLoad(config)}
                            >
                              Load
                            </button>
                            <button
                              className="btn btn-delete"
                              onClick={() => {
                                if (window.confirm(`Delete "${config.name}"?`)) {
                                  handleDelete(config.id);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sunday-layout">
        {/* Unassigned Pairs Pool */}
        <div className="sunday-pool-section">
          <h2>Unassigned Pairs</h2>
          <div className="sunday-controls">
            <button className="btn" onClick={() => setIsSaveModalOpen(true)}>
              Save/Load
            </button>
            <button className="btn" onClick={() => {
              localStorage.removeItem(SUNDAY_WORKING_DRAFT_KEY);
              importFromSaturdayTeams();
            }}>
              Re-import Teams
            </button>
          </div>
          <div
            className="sunday-pool"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOnPool}
          >
            {pairs.length === 0 ? (
              <div className="sunday-pool-empty">All pairs assigned to groups</div>
            ) : (
              pairs.map(pair => (
                <div key={pair.id} className="sunday-pair-wrapper">
                  <PairCard
                    pair={pair}
                    teamIndex={teamIndexMap.get(pair.sourceTeamId) ?? 0}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    sourceGroupId={null}
                  />
                  {pair.players.map((player, idx) => (
                    <button
                      key={player.id}
                      className="swap-btn"
                      onClick={() => swapPlayerBetweenPairs(pair.id, idx)}
                      title={`Swap ${player.name} with other pair`}
                    >
                      &#8644;
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sunday Groups */}
        <div className="sunday-groups-section">
          <h2>Sunday Groups</h2>
          <div className="sunday-groups-grid">
            {groups.map(group => (
              <SundayGroupBox
                key={group.id}
                group={group}
                teamIndexMap={teamIndexMap}
                onDrop={handleDropOnGroup}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SundayPairings;
