// lib/trajectory.js - Trajectory Substrate (v2.1 W7a)
// Records human-AI interaction trajectories for organizational learning.
// This is the first truly new code of Roadmap 2.1 — the "录像系统".
// Storage: labos/trajectories/YYYY-MM-DD-{actor_id}-{n}.json

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, '..', 'labos', 'trajectories');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

// Generate a trajectory file path with auto-incrementing sequence number
function trajPath(date, actorId, seq) {
  return join(STORAGE, `${date}-${actorId}-${String(seq).padStart(3, '0')}.json`);
}

// Get next sequence number for a given date+actor
function nextSeq(date, actorId) {
  ensureDir();
  const prefix = `${date}-${actorId}-`;
  let max = 0;
  try {
    for (const f of readdirSync(STORAGE)) {
      if (f.startsWith(prefix) && f.endsWith('.json')) {
        const m = f.match(/-(\d+)\.json$/);
        if (m) max = Math.max(max, parseInt(m[1]));
      }
    }
  } catch {}
  return max + 1;
}

// Log a trajectory — the core function
// @param {Object} params
// @param {string} params.actor_type - student | ai_agent | professor
// @param {string} params.actor_id - e.g. s01, t01, agent:literature
// @param {string} params.session_type - chat | task | review | meeting
// @param {Array} params.messages - [{role, content, agent?}]
// @param {Object} params.outcome - {artifact?, quality?, verified_by?}
// @param {Array} params.tags - e.g. ['literature', 'v2g']
// @returns {Object} the saved trajectory
export function logTrajectory({ actor_type, actor_id, session_type, messages, outcome, tags }) {
  ensureDir();
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const seq = nextSeq(date, actor_id);
  const id = `traj-${date.replace(/-/g, '')}-${actor_id}-${String(seq).padStart(3, '0')}`;

  const record = {
    trajectory_id: id,
    actor_type: actor_type || 'student',
    actor_id: actor_id || 'unknown',
    session_type: session_type || 'chat',
    timestamp: now.toISOString(),
    messages: messages || [],
    outcome: outcome || {},
    extracted_skills: [],  // W12 will fill this
    tags: tags || [session_type || 'chat', actor_id || 'unknown']
  };

  const path = trajPath(date, actor_id, seq);
  writeFileSync(path, JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

// Search trajectories by tags, actor, or session_type
// @param {Object} query - {tags?, actor_id?, session_type?, limit?}
// @returns {Array} matching trajectories (newest first)
export function searchTrajectories({ tags, actor_id, session_type, limit = 20 } = {}) {
  ensureDir();
  const results = [];
  try {
    const files = readdirSync(STORAGE).filter(f => f.endsWith('.json')).sort().reverse();
    for (const f of files) {
      if (results.length >= limit) break;
      try {
        const traj = JSON.parse(readFileSync(join(STORAGE, f), 'utf-8'));
        // Filter by actor_id
        if (actor_id && traj.actor_id !== actor_id) continue;
        // Filter by session_type
        if (session_type && traj.session_type !== session_type) continue;
        // Filter by tags (match any)
        if (tags && tags.length > 0) {
          const trajTags = traj.tags || [];
          const hasTag = tags.some(t => trajTags.includes(t));
          if (!hasTag) continue;
        }
        results.push(traj);
      } catch {}
    }
  } catch {}
  return results;
}

// Get statistics for an actor
// @param {string} actor_id
// @returns {Object} {total, by_session_type, top_tags, last_activity}
export function getTrajectoryStats(actor_id) {
  ensureDir();
  let total = 0;
  const byType = {};
  const tagCount = {};
  let lastActivity = null;

  try {
    const files = readdirSync(STORAGE).filter(f => f.endsWith('.json')).sort();
    for (const f of files) {
      try {
        const traj = JSON.parse(readFileSync(join(STORAGE, f), 'utf-8'));
        if (actor_id && traj.actor_id !== actor_id) continue;
        total++;
        const st = traj.session_type || 'unknown';
        byType[st] = (byType[st] || 0) + 1;
        for (const t of (traj.tags || [])) {
          tagCount[t] = (tagCount[t] || 0) + 1;
        }
        if (!lastActivity || traj.timestamp > lastActivity) {
          lastActivity = traj.timestamp;
        }
      } catch {}
    }
  } catch {}

  // Top 5 tags
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return { actor_id: actor_id || 'all', total, by_session_type: byType, top_tags: topTags, last_activity: lastActivity };
}

// List all trajectory files (for browsing)
export function listTrajectories(limit = 50) {
  ensureDir();
  const results = [];
  try {
    const files = readdirSync(STORAGE).filter(f => f.endsWith('.json')).sort().reverse();
    for (const f of files.slice(0, limit)) {
      try {
        const traj = JSON.parse(readFileSync(join(STORAGE, f), 'utf-8'));
        results.push({
          trajectory_id: traj.trajectory_id,
          actor_id: traj.actor_id,
          session_type: traj.session_type,
          timestamp: traj.timestamp,
          tags: traj.tags || [],
          message_count: (traj.messages || []).length
        });
      } catch {}
    }
  } catch {}
  return results;
}

// --- Cordis shape (W3 deferred) ---
export function apply(ctx, config = {}) {
  const ns = config.namespace || 'trajectory';
  if (ctx.reflect?.provide) {
    ctx.reflect.provide(ns, {
      logTrajectory, searchTrajectories, getTrajectoryStats, listTrajectories
    });
  }
  ctx.effect(() => () => {});
}

export default {
  logTrajectory, searchTrajectories, getTrajectoryStats, listTrajectories, apply
};
