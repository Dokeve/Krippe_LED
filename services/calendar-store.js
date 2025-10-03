// services/calendar-store.js
import path from 'node:path';
import config from '../config.js';
import { ensureDir, readJson, writeJson } from './file-utils.js';

const CALENDAR_FILE = path.join(config.paths.data, 'calendar.json');

function sanitizeEvent(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const id = String(ev.id || '').trim() || `e${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const module = ['1', '2'].includes(String(ev.module || ev.moduleId || '').trim())
    ? String(ev.module || ev.moduleId || '').trim()
    : (String(ev.title || '').includes('Modul 2') ? '2' : '1');
  const title = ev.title ? String(ev.title) : `Modul ${module}`;
  const start = typeof ev.start === 'string' ? ev.start : null;
  const end = typeof ev.end === 'string' ? ev.end : null;
  if (!start) return null;
  const seriesRoot = typeof ev.seriesRoot === 'string' ? ev.seriesRoot : null;
  const weekly = Boolean(ev.weekly);
  const allDay = Boolean(ev.allDay);
  return { id, module, title, start, end, seriesRoot, weekly, allDay };
}

function sanitizeEventList(list) {
  if (!Array.isArray(list)) return [];
  const sanitized = list.map(sanitizeEvent).filter(Boolean);
  sanitized.sort((a, b) => new Date(a.start) - new Date(b.start));
  return sanitized;
}

export function getCalendarEvents() {
  ensureDir(path.dirname(CALENDAR_FILE));
  const data = readJson(CALENDAR_FILE, []);
  return sanitizeEventList(data);
}

export function saveCalendarEvents(list) {
  const sanitized = sanitizeEventList(list);
  ensureDir(path.dirname(CALENDAR_FILE));
  writeJson(CALENDAR_FILE, sanitized);
  return sanitized;
}

export default {
  getCalendarEvents,
  saveCalendarEvents
};
