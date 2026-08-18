// lib/chatroom.js - F4: Group chat rooms with AI integration
// SSE-first (no WebSocket needed); real-time broadcast via in-memory client registry
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, '..', 'labos', 'chatrooms');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

// In-memory SSE client registry: Map<roomId, Set<res>>
const clients = new Map();

export function addClient(roomId, res) {
  if (!clients.has(roomId)) clients.set(roomId, new Set());
  clients.get(roomId).add(res);
  return () => { clients.get(roomId)?.delete(res); };
}

export function broadcast(roomId, event) {
  const set = clients.get(roomId);
  if (!set) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch {}
  }
}

export function createRoom({ name, created_by, created_by_name, members = [], ai_enabled = true }) {
  ensureDir();
  const roomId = 'room-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const room = {
    room_id: roomId,
    name: name || '新讨论组',
    created_by,
    created_by_name: created_by_name || created_by,
    members: [...new Set([created_by, ...members])],
    ai_enabled: ai_enabled !== false,
    messages: [],
    created_at: new Date().toISOString(),
  };
  writeFileSync(join(STORAGE, `${roomId}.json`), JSON.stringify(room, null, 2), 'utf-8');
  return room;
}

export function listRooms(userId) {
  ensureDir();
  const files = readdirSync(STORAGE).filter(f => f.endsWith('.json'));
  const rooms = [];
  for (const f of files) {
    try {
      const room = JSON.parse(readFileSync(join(STORAGE, f), 'utf-8'));
      if (room.members.includes(userId)) {
        rooms.push({
          room_id: room.room_id,
          name: room.name,
          members: room.members,
          member_count: room.members.length,
          ai_enabled: room.ai_enabled,
          message_count: (room.messages || []).length,
          last_message: room.messages && room.messages.length > 0 ? room.messages[room.messages.length - 1] : null,
          created_at: room.created_at,
        });
      }
    } catch {}
  }
  rooms.sort((a, b) => {
    const ta = a.last_message ? new Date(a.last_message.timestamp).getTime() : new Date(a.created_at).getTime();
    const tb = b.last_message ? new Date(b.last_message.timestamp).getTime() : new Date(b.created_at).getTime();
    return tb - ta;
  });
  return rooms;
}

export function getRoom(roomId) {
  const p = join(STORAGE, `${roomId}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function addMessage(roomId, { sender_id, sender_name, content, is_ai = false }) {
  const room = getRoom(roomId);
  if (!room) return null;
  const msg = {
    id: 'msg-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    sender_id,
    sender_name: sender_name || sender_id,
    content,
    is_ai,
    timestamp: new Date().toISOString(),
  };
  room.messages = room.messages || [];
  room.messages.push(msg);
  // Cap at 200 messages per room
  if (room.messages.length > 200) room.messages = room.messages.slice(-200);
  writeFileSync(join(STORAGE, `${roomId}.json`), JSON.stringify(room, null, 2), 'utf-8');
  return msg;
}

export function joinRoom(roomId, userId, userName) {
  const room = getRoom(roomId);
  if (!room) return null;
  if (!room.members.includes(userId)) {
    room.members.push(userId);
    writeFileSync(join(STORAGE, `${roomId}.json`), JSON.stringify(room, null, 2), 'utf-8');
  }
  return room;
}

export function leaveRoom(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.members = room.members.filter(m => m !== userId);
  writeFileSync(join(STORAGE, `${roomId}.json`), JSON.stringify(room, null, 2), 'utf-8');
  return room;
}

export function deleteRoom(roomId) {
  const p = join(STORAGE, `${roomId}.json`);
  if (existsSync(p)) unlinkSync(p);
  clients.delete(roomId);
  return true;
}

// Check if message mentions AI
export function shouldTriggerAI(content, aiEnabled) {
  if (!aiEnabled) return false;
  return /@ai|@AI|@助手|@小助/i.test(content);
}

// Build AI context from room history + student memories
export function buildAIContext(roomId, getMemoryContext) {
  const room = getRoom(roomId);
  if (!room) return [];
  // Last 20 messages for context
  const recent = (room.messages || []).slice(-20);
  const messages = recent.map(m => ({
    role: m.is_ai ? 'assistant' : 'user',
    content: `${m.sender_name}: ${m.content}`,
  }));
  // Prepend system prompt with room context
  const memberContexts = room.members
    .filter(m => m !== 't01') // students only
    .map(m => getMemoryContext(m))
    .filter(Boolean);
  const systemContent = `你是科研课题组的 AI 助手,正在参与一个群聊讨论。你的角色是激发灵感、提供方向建议,不要代替学生做决定。

讨论组: ${room.name}
参与学生上下文:
${memberContexts.join('\n---\n') || '(无学生上下文)'}

请保持简洁,每次回复不超过 3 句话,聚焦激发思路而非给答案。`;
  return [{ role: 'system', content: systemContent }, ...messages];
}

// Cordis form (W3 zero-change)
export function apply(ctx, config) {
  ctx.exports = ctx.exports || {};
  ctx.exports.chatroom = { createRoom, listRooms, getRoom, addMessage, joinRoom, leaveRoom, deleteRoom, shouldTriggerAI, buildAIContext, addClient, broadcast };
}