// Vercel serverless function wrapper for Express app
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Database connection pool
// SSL disabled for simplicity
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const cleanConnectionString = (() => {
  if (!connectionString) return undefined;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return connectionString;
  }
})();

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Initialize database schema
let schemaInitialized = false;
async function initDatabase() {
  if (schemaInitialized) return;

  const client = await pool.connect();
  try {
    console.log('Initializing database schema...');

    // Roster Config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_config (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rating VARCHAR(3) NOT NULL CHECK (rating IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rating VARCHAR(3) NOT NULL CHECK (rating IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Teams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Team players junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_players (
        team_id VARCHAR(50) REFERENCES teams(id) ON DELETE CASCADE,
        player_id VARCHAR(50) REFERENCES players(id) ON DELETE CASCADE,
        is_locked BOOLEAN DEFAULT FALSE,
        position INTEGER,
        PRIMARY KEY (team_id, player_id)
      )
    `);

    // Saved configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_configurations (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_players_team ON team_players(team_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_players_player ON team_players(player_id);
    `);

    console.log('Database schema initialized successfully');
    schemaInitialized = true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

// Initialize DB on first request
app.use(async (req, res, next) => {
  try {
    await initDatabase();
    next();
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({
      error: 'Database initialization failed',
      details: error.message,
      hint: 'Make sure POSTGRES_URL environment variable is set correctly'
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
      hint: 'Check POSTGRES_URL environment variable'
    });
  }
});

// Seed database with default roster
app.get('/api/seed', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Check if already seeded
      const check = await client.query('SELECT COUNT(*) FROM roster_config');
      const count = parseInt(check.rows[0].count);

      if (count > 0) {
        return res.json({
          status: 'already_seeded',
          message: `Database already has ${count} players. Delete them first if you want to reseed.`,
          count
        });
      }

      // Default roster data
      const defaultRoster = [
        { name: 'Pops', rating: 'B-' },
        { name: 'Kevin', rating: 'A-' },
        { name: 'Dylan', rating: 'B+' },
        { name: 'Connor', rating: 'B' },
        { name: 'Allen', rating: 'C+' },
        { name: 'Eric W.', rating: 'C' },
        { name: 'Uncle Tim', rating: 'C' },
        { name: 'Tim', rating: 'B-' },
        { name: 'Jimmy', rating: 'C+' },
        { name: 'Kyle', rating: 'B' },
        { name: 'Eric R.', rating: 'C' },
        { name: 'Scott', rating: 'C-' },
        { name: 'Cory', rating: 'B+' },
        { name: 'Mom', rating: 'D+' },
        { name: 'Jared', rating: 'C' },
        { name: 'Joe R.', rating: 'C' },
        { name: 'Sean G.', rating: 'C+' },
        { name: 'Don', rating: 'A' },
        { name: 'Stephen', rating: 'B' },
        { name: 'Christian', rating: 'C' },
        { name: 'Samantha', rating: 'D' },
        { name: 'Eric', rating: 'C' },
        { name: 'Rob E.', rating: 'C' },
        { name: 'Mark G.', rating: 'B' },
        { name: 'Mark N.', rating: 'C+' },
        { name: 'Mark G Sr.', rating: 'C-' },
        { name: 'Tim H.', rating: 'C' },
        { name: 'Tony', rating: 'B-' },
        { name: 'Austin H.', rating: 'C' },
        { name: 'Sean M.', rating: 'C' },
        { name: 'TBD', rating: 'C' },
        { name: 'TBD', rating: 'C' }
      ];

      await client.query('BEGIN');

      for (const player of defaultRoster) {
        await client.query(
          'INSERT INTO roster_config (name, rating) VALUES ($1, $2)',
          [player.name, player.rating]
        );
      }

      await client.query('COMMIT');

      res.json({
        status: 'success',
        message: `Successfully seeded ${defaultRoster.length} players to roster_config`,
        count: defaultRoster.length,
        players: defaultRoster
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      hint: 'Make sure database tables are initialized first'
    });
  }
});

// Database diagnostics endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Get data from both tables
      const rosterConfig = await client.query('SELECT * FROM roster_config ORDER BY id ASC');
      const players = await client.query('SELECT * FROM players ORDER BY created_at ASC');
      const teams = await client.query('SELECT * FROM teams ORDER BY id ASC');

      // Check which tables exist
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      // Count records in each table
      const counts = {};
      for (const table of tables.rows) {
        const result = await client.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        counts[table.table_name] = parseInt(result.rows[0].count);
      }

      res.json({
        status: 'ok',
        database: {
          connected: true,
          url: process.env.POSTGRES_URL ? 'Set' : 'Not set',
          tables: tables.rows.map(t => t.table_name),
          counts
        },
        data: {
          roster_config: rosterConfig.rows,
          players: players.rows,
          teams: teams.rows
        },
        schemaInitialized
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: error.stack,
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV
      }
    });
  }
});

// ==================== ROSTER CONFIG ENDPOINTS ====================

app.get('/api/roster-config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roster_config ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roster config:', error);
    res.status(500).json({ error: 'Failed to fetch roster config' });
  }
});

app.post('/api/roster-config', async (req, res) => {
  try {
    const { name, rating } = req.body;
    const result = await pool.query(
      'INSERT INTO roster_config (name, rating) VALUES ($1, $2) RETURNING *',
      [name, rating]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating roster config:', error);
    res.status(500).json({ error: 'Failed to create roster config entry' });
  }
});

app.put('/api/roster-config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rating } = req.body;
    const result = await pool.query(
      'UPDATE roster_config SET name = $1, rating = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, rating, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Roster config entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating roster config:', error);
    res.status(500).json({ error: 'Failed to update roster config entry' });
  }
});

app.delete('/api/roster-config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM roster_config WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Roster config entry not found' });
    }
    res.json({ message: 'Roster config entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting roster config:', error);
    res.status(500).json({ error: 'Failed to delete roster config entry' });
  }
});

// ==================== PLAYERS ENDPOINTS ====================

app.get('/api/players', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

app.post('/api/players/sync', async (req, res) => {
  try {
    const { players } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const player of players) {
        await client.query(
          `INSERT INTO players (id, name, rating, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (id)
           DO UPDATE SET name = $2, rating = $3, updated_at = CURRENT_TIMESTAMP`,
          [player.id, player.name, player.rating]
        );
      }

      const playerIds = players.map(p => p.id);
      if (playerIds.length > 0) {
        await client.query(
          'DELETE FROM players WHERE id NOT IN (' + playerIds.map((_, i) => `$${i + 1}`).join(',') + ')',
          playerIds
        );
      } else {
        await client.query('DELETE FROM players');
      }

      await client.query('COMMIT');
      res.json({ message: 'Players synced successfully', count: players.length });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error syncing players:', error);
    res.status(500).json({ error: 'Failed to sync players' });
  }
});

// ==================== TEAMS ENDPOINTS ====================

app.get('/api/teams', async (req, res) => {
  try {
    const teamsResult = await pool.query('SELECT * FROM teams ORDER BY id ASC');
    const teams = teamsResult.rows;

    const teamPlayersResult = await pool.query(`
      SELECT tp.team_id, tp.is_locked, p.*
      FROM team_players tp
      JOIN players p ON tp.player_id = p.id
      ORDER BY tp.team_id, tp.position
    `);

    const teamPlayersMap = {};
    teamPlayersResult.rows.forEach(row => {
      if (!teamPlayersMap[row.team_id]) {
        teamPlayersMap[row.team_id] = { players: [], lockedPlayers: [] };
      }
      teamPlayersMap[row.team_id].players.push({
        id: row.id,
        name: row.name,
        rating: row.rating
      });
      if (row.is_locked) {
        teamPlayersMap[row.team_id].lockedPlayers.push(row.id);
      }
    });

    const teamsWithPlayers = teams.map(team => ({
      id: team.id,
      name: team.name,
      players: teamPlayersMap[team.id]?.players || [],
      lockedPlayers: teamPlayersMap[team.id]?.lockedPlayers || []
    }));

    res.json(teamsWithPlayers);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.post('/api/teams/sync', async (req, res) => {
  try {
    const { teams } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const team of teams) {
        await client.query(
          `INSERT INTO teams (id, name, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (id)
           DO UPDATE SET name = $2, updated_at = CURRENT_TIMESTAMP`,
          [team.id, team.name]
        );
      }

      const teamIds = teams.map(t => t.id);
      if (teamIds.length > 0) {
        await client.query(
          'DELETE FROM team_players WHERE team_id IN (' + teamIds.map((_, i) => `$${i + 1}`).join(',') + ')',
          teamIds
        );
      }

      for (const team of teams) {
        for (let i = 0; i < team.players.length; i++) {
          const player = team.players[i];
          const isLocked = team.lockedPlayers && team.lockedPlayers.includes(player.id);

          const playerExists = await client.query('SELECT id FROM players WHERE id = $1', [player.id]);
          if (playerExists.rows.length > 0) {
            await client.query(
              'INSERT INTO team_players (team_id, player_id, is_locked, position) VALUES ($1, $2, $3, $4)',
              [team.id, player.id, isLocked, i]
            );
          } else {
            console.warn(`Player ${player.id} (${player.name}) not found, skipping`);
          }
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Teams synced successfully', count: teams.length });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error syncing teams:', error);
    res.status(500).json({ error: 'Failed to sync teams' });
  }
});

// ==================== SAVED CONFIGURATIONS ====================

app.get('/api/saved-configs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM saved_configurations ORDER BY created_at DESC');
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      date: row.created_at,
      ...row.data
    })));
  } catch (error) {
    console.error('Error fetching saved configs:', error);
    res.status(500).json({ error: 'Failed to fetch saved configurations' });
  }
});

app.post('/api/saved-configs', async (req, res) => {
  try {
    const { id, name, teams, unassignedPlayers } = req.body;
    const data = { teams, unassignedPlayers };

    const result = await pool.query(
      `INSERT INTO saved_configurations (id, name, data, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id)
       DO UPDATE SET name = $2, data = $3
       RETURNING *`,
      [id, name, JSON.stringify(data)]
    );

    res.status(201).json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      date: result.rows[0].created_at,
      ...result.rows[0].data
    });
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.delete('/api/saved-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM saved_configurations WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json({ message: 'Configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
});

// Export for Vercel
module.exports = app;
