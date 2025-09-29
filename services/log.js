let ioRef = null;
const emit = (level, msg) => {
  const payload = { ts: Date.now(), level, msg };
  if (ioRef) ioRef.emit('log', payload);
  const tag = level.toUpperCase().padEnd(7);
  console.log(`[${new Date().toISOString()}] ${tag} ${msg}`);
};
export const Log = {
  attachIO(io) { ioRef = io; },
  info(msg) { emit('info', msg); },
  warn(msg) { emit('warn', msg); },
  error(msg) { emit('error', msg); },
  success(msg) { emit('success', msg); }
};
