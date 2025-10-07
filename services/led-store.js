// services/led-store.js
import path from 'node:path';
import config from '../config.js';
import { ensureDir, readJson, writeJson } from './file-utils.js';

const LED_FILE = path.join(config.paths.data, 'led-groups.json');
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const TRANSITION_COLOR_COUNT = 5;

const DEFAULT_TRANSITIONS = {
  dayNight: ['#FFF3C4', '#F7D08C', '#F0A45E', '#C9724A', '#493F66'],
  nightDay: ['#1F2A5F', '#274C8C', '#3A7CC3', '#78B9E0', '#F2F6FF']
};

const DEFAULT_LED = {
  adventActive: false,
  weihnachtActive: false,
  advent: [],
  weihnacht: [],
  lagerfeuer: {
    ledFrom: 0,
    ledTo: 0,
    ledCount: 0,
    colors: ['#FF4500', '#FF8C00', '#FFD700', '#FFA500', '#FF6347'],
    scenarios: []
  },
  transitions: {
    dayNight: DEFAULT_TRANSITIONS.dayNight.slice(),
    nightDay: DEFAULT_TRANSITIONS.nightDay.slice()
  }
};

function sanitizeScenario(sc) {
  if (!sc || typeof sc !== 'object') return null;
  const name = ['Tag', 'Tag-Nacht', 'Nacht', 'Nacht-Tag'].includes(sc.name) ? sc.name : String(sc.name || '').trim();
  if (!name) return null;
  const start = Number.isFinite(Number(sc.start)) ? Number(sc.start) : null;
  const end = Number.isFinite(Number(sc.end)) ? Number(sc.end) : null;
  const leds = Array.isArray(sc.leds)
    ? sc.leds.map(n => parseInt(n, 10)).filter(n => Number.isInteger(n) && n >= 0)
    : [];
  return { name, start, end, leds };
}

function sanitizeSubgroup(group) {
  if (!group || typeof group !== 'object') return null;
  const name = String(group.name || '').trim() || 'Untergruppe';
  const ledFrom = Number.isFinite(Number(group.ledFrom)) ? Number(group.ledFrom) : 0;
  const ledTo = Number.isFinite(Number(group.ledTo)) ? Number(group.ledTo) : ledFrom;
  const ledCount = Number.isFinite(Number(group.ledCount)) ? Number(group.ledCount) : Math.max(0, ledTo - ledFrom + 1);
  const wall = Boolean(group.wall);
  const alwaysOn = Boolean(group.alwaysOn);
  const colorDay = typeof group.colorDay === 'string' ? group.colorDay : '#000000';
  const colorNight = typeof group.colorNight === 'string' ? group.colorNight : '#000000';
  const individualColors = Array.isArray(group.individualColors)
    ? group.individualColors.map(c => (typeof c === 'string' ? c : '')).slice(0, Math.max(0, ledCount))
    : [];
  const scenarios = Array.isArray(group.scenarios)
    ? group.scenarios.map(sanitizeScenario).filter(Boolean)
    : [];
  return {
    name,
    ledFrom,
    ledTo,
    ledCount,
    wall,
    alwaysOn,
    colorDay,
    colorNight,
    individualColors,
    scenarios
  };
}

function sanitizePalette(list, fallback) {
  const result = [];
  const source = Array.isArray(list) ? list : [];
  for (let i = 0; i < TRANSITION_COLOR_COUNT; i += 1) {
    const candidate = typeof source[i] === 'string' ? source[i].trim() : '';
    if (HEX_COLOR.test(candidate)) {
      result.push(candidate.toUpperCase());
      continue;
    }
    const fb = Array.isArray(fallback) ? fallback[i] : null;
    if (typeof fb === 'string' && HEX_COLOR.test(fb)) {
      result.push(fb.toUpperCase());
      continue;
    }
    result.push(result[i - 1] || '#000000');
  }
  return result.slice(0, TRANSITION_COLOR_COUNT);
}

function sanitizeTransitions(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return {
    dayNight: sanitizePalette(raw.dayNight, DEFAULT_TRANSITIONS.dayNight),
    nightDay: sanitizePalette(raw.nightDay, DEFAULT_TRANSITIONS.nightDay)
  };
}

function sanitizeGroupList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(sanitizeSubgroup).filter(Boolean);
}

function sanitizeLagerfeuer(lf) {
  if (!lf || typeof lf !== 'object') return DEFAULT_LED.lagerfeuer;
  const ledFrom = Number.isFinite(Number(lf.ledFrom)) ? Number(lf.ledFrom) : 0;
  const ledTo = Number.isFinite(Number(lf.ledTo)) ? Number(lf.ledTo) : ledFrom;
  const ledCount = Number.isFinite(Number(lf.ledCount)) ? Number(lf.ledCount) : Math.max(0, ledTo - ledFrom + 1);
  const colors = Array.isArray(lf.colors)
    ? lf.colors.slice(0, 5).map(c => (typeof c === 'string' ? c : ''))
    : DEFAULT_LED.lagerfeuer.colors;
  const scenarios = Array.isArray(lf.scenarios)
    ? lf.scenarios.map(sanitizeScenario).filter(Boolean)
    : [];
  return { ledFrom, ledTo, ledCount, colors, scenarios };
}

function sanitizeConfig(input = {}) {
  return {
    adventActive: Boolean(input.adventActive),
    weihnachtActive: Boolean(input.weihnachtActive),
    advent: sanitizeGroupList(input.advent),
    weihnacht: sanitizeGroupList(input.weihnacht),
    lagerfeuer: sanitizeLagerfeuer(input.lagerfeuer),
    transitions: sanitizeTransitions(input.transitions)
  };
}

export function getLedConfig() {
  ensureDir(path.dirname(LED_FILE));
  const data = readJson(LED_FILE, DEFAULT_LED);
  return sanitizeConfig(data);
}

export function saveLedConfig(cfg) {
  const sanitized = sanitizeConfig(cfg);
  ensureDir(path.dirname(LED_FILE));
  writeJson(LED_FILE, sanitized);
  return sanitized;
}

export default {
  getLedConfig,
  saveLedConfig
};
