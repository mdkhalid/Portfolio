const { Server } = require('socket.io');
const ChatSession = require('../models/ChatSession');

const MAX_ACTIVE = 3;

function setupSocket(server) {
  const parseList = (val) =>
    (val || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const allowedOrigins = parseList(process.env.CLIENT_URL);
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const merged = [...new Set([...defaults, ...allowedOrigins])];
  const origins = process.env.NODE_ENV === 'production' ? allowedOrigins : merged;

  const io = new Server(server, {
    cors: { origin: origins, methods: ['GET', 'POST'], credentials: true },
  });

  io.on('connection', (socket) => {
    const role = socket.handshake.query.role || 'visitor';
    const visitorId = socket.handshake.query.visitorId || socket.id;

    if (role === 'admin') {
      socket.data.role = 'admin';
      socket.join('admin-room');
      broadcastState(io);
      setupAdminHandlers(io, socket);
      return;
    }

    // Visitor connection
    socket.data.role = 'visitor';
    socket.data.visitorId = visitorId;
    setupVisitorHandlers(io, socket);
  });
}

function setupVisitorHandlers(io, socket) {
  const { visitorId } = socket.data;

  socket.on('visitor:join', async (data) => {
    const name = data?.name?.trim() || 'Guest';

    const existing = await ChatSession.findOne({ visitorId, status: { $in: ['waiting', 'active'] } });
    if (existing) {
      existing.socketId = socket.id;
      existing.visitorName = name;
      await existing.save();
      socket.emit('chat:status', { status: existing.status, queuePosition: existing.queuePosition, sessionId: existing._id });
      if (existing.messages?.length) socket.emit('chat:history', existing.messages);
      broadcastState(io);
      return;
    }

    const activeCount = await ChatSession.countDocuments({ status: 'active' });
    const isActive = activeCount < MAX_ACTIVE;

    const session = await ChatSession.create({
      visitorId,
      visitorName: name,
      socketId: socket.id,
      status: isActive ? 'active' : 'waiting',
      queuePosition: isActive ? 0 : (await ChatSession.countDocuments({ status: 'waiting' })) + 1,
      startedAt: isActive ? new Date() : undefined,
    });

    socket.emit('chat:status', { status: session.status, queuePosition: session.queuePosition, sessionId: session._id });

    if (isActive) {
      io.to('admin-room').emit('chat:new', formatSession(session));
    }
    broadcastState(io);
  });

  socket.on('visitor:message', async (data) => {
    const content = data?.content?.trim();
    if (!content) return;

    const session = await ChatSession.findOne({ visitorId, status: { $in: ['waiting', 'active'] } });
    if (!session) return;

    if (session.status === 'waiting') {
      socket.emit('chat:error', { message: 'Please wait. An agent will be with you shortly.' });
      return;
    }

    const msg = { role: 'visitor', name: session.visitorName, content, timestamp: new Date() };
    session.messages.push(msg);
    await session.save();

    io.to('admin-room').emit('chat:message', { sessionId: session._id, message: msg });
  });

  socket.on('visitor:typing', () => {
    io.to('admin-room').emit('chat:typing', { sessionId: socket.data.sessionId || visitorId });
  });

  socket.on('disconnect', async () => {
    const session = await ChatSession.findOne({ visitorId, status: 'active' });
    if (session) {
      session.messages.push({ role: 'system', content: 'Visitor disconnected', timestamp: new Date() });
      session.status = 'closed';
      session.endedAt = new Date();
      session.socketId = '';
      await session.save();
      io.to('admin-room').emit('chat:closed', { sessionId: session._id });
      promoteNext(io);
    }
    broadcastState(io);
  });
}

function setupAdminHandlers(io, socket) {
  socket.on('admin:message', async (data) => {
    const { sessionId, content } = data || {};
    if (!content?.trim() || !sessionId) return;

    const session = await ChatSession.findById(sessionId);
    if (!session || session.status !== 'active') return;

    const msg = { role: 'admin', content: content.trim(), timestamp: new Date() };
    session.messages.push(msg);
    await session.save();

    const visitorSocket = findVisitorSocket(io, session.visitorId);
    if (visitorSocket) visitorSocket.emit('chat:message', msg);

    io.to('admin-room').emit('chat:message', { sessionId: session._id, message: msg });
  });

  socket.on('admin:end-chat', async (data) => {
    const { sessionId } = data || {};
    if (!sessionId) return;

    const session = await ChatSession.findById(sessionId);
    if (!session) return;

    session.status = 'closed';
    session.endedAt = new Date();
    session.messages.push({ role: 'system', content: 'Chat ended by admin', timestamp: new Date() });
    await session.save();

    const visitorSocket = findVisitorSocket(io, session.visitorId);
    if (visitorSocket) visitorSocket.emit('chat:closed', { reason: 'ended_by_admin' });

    io.to('admin-room').emit('chat:closed', { sessionId: session._id });
    promoteNext(io);
    broadcastState(io);
  });

  socket.on('disconnect', () => {
    broadcastState(io);
  });
}

async function promoteNext(io) {
  const next = await ChatSession.findOne({ status: 'waiting' }).sort({ createdAt: 1 });
  if (!next) return;

  next.status = 'active';
  next.queuePosition = 0;
  next.startedAt = new Date();
  await next.save();

  const visitorSocket = findVisitorSocket(io, next.visitorId);
  if (visitorSocket) {
    visitorSocket.emit('chat:status', { status: 'active', queuePosition: 0, sessionId: next._id });
    visitorSocket.emit('chat:message', { role: 'system', content: 'An agent is now connected with you.' });
  }

  io.to('admin-room').emit('chat:new', formatSession(next));
  broadcastState(io);
}

async function broadcastState(io) {
  const active = await ChatSession.find({ status: 'active' }).sort({ createdAt: 1 }).lean();
  const waiting = await ChatSession.find({ status: 'waiting' }).sort({ createdAt: 1 }).lean();

  io.to('admin-room').emit('chat:state', {
    active: active.map(formatSession),
    waiting: waiting.map((s, i) => ({ ...formatSession(s), queuePosition: i + 1 })),
    maxActive: MAX_ACTIVE,
  });
}

function findVisitorSocket(io, visitorId) {
  return [...io.sockets.sockets.values()].find(
    (s) => s.data.role === 'visitor' && s.data.visitorId === visitorId
  );
}

function formatSession(session) {
  return {
    _id: session._id,
    visitorId: session.visitorId,
    visitorName: session.visitorName,
    status: session.status,
    queuePosition: session.queuePosition,
    messageCount: session.messages?.length || 0,
    lastMessage: session.messages?.length ? session.messages[session.messages.length - 1] : null,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
  };
}

module.exports = { setupSocket };
