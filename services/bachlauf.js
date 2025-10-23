import * as gpio from './gpio.js';

// Bachlauf service: stateful controller for pump
let state = {
  pumpState: 'off',           // 'on' | 'off'
  manualOverride: null,       // null | 'on' | 'off'
  module2Active: false
};

function _applyState() {
  const shouldBeOn = (state.manualOverride === 'on') || (state.manualOverride === null && state.module2Active === true);
  const desired = shouldBeOn ? 'on' : 'off';
  if (state.pumpState !== desired) {
    state.pumpState = desired;
    try {
      gpio.setPump(desired === 'on');
      console.log(`[bachlauf] pump -> ${desired} (manual=${state.manualOverride}, module2=${state.module2Active})`);
    } catch (err) {
      console.warn('[bachlauf] gpio.setPump error', err?.message || err);
    }
  }
}

export function init() {
  // ensure safe defaults
  state = { pumpState: 'off', manualOverride: null, module2Active: false };
  // apply initial physical state
  try { gpio.setPump(false); } catch (e) { console.warn('[bachlauf] init gpio failed', e?.message || e); }
}

export function getStatus() {
  return { ok: true, pumpState: state.pumpState, source: state.manualOverride ? 'manual' : 'auto', module2Active: !!state.module2Active, manualOverride: state.manualOverride };
}

export function setManual(action) {
  if (action === 'on') state.manualOverride = 'on';
  else if (action === 'off') state.manualOverride = 'off';
  else if (action === 'clear') state.manualOverride = null;
  else throw new Error('invalid action');
  _applyState();
  return getStatus();
}

export function clearManual() { return setManual('clear'); }

export function handleModule2(active) {
  state.module2Active = !!active;
  // if manual override is set, scheduler shouldn't change pump
  _applyState();
}

export default {
  init, getStatus, setManual, clearManual, handleModule2
};
