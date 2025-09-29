import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import morgan from 'morgan';
import serveIndex from 'serve-index';
import { Server as SocketIOServer } from 'socket.io';
import config from './config.js';
import { initDB } from './services/db.js';
import * as Scheduler from './services/scheduler.js';
import apiRouter from './routes/api.js';
import { Log } from './services/log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

Log.attachIO(io);
await initDB();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, config.staticDir)));
app.use('/public', serveIndex(path.join(__dirname, 'public'), { icons: true }));

app.use('/api', apiRouter);

io.on('connection', (socket) => {
  Log.info('Client verbunden: ' + socket.id);
  socket.emit('log', { level: 'info', msg: 'Willkommen! Logs werden hier angezeigt.' });
  socket.on('disconnect', () => Log.info('Client getrennt: ' + socket.id));
});

Scheduler.start(io);

const PORT = config.httpPort;
server.listen(PORT, () => {
  Log.success(`Server läuft auf http://localhost:${PORT}`);
});
