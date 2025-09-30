// services/ws2812.js
// WS2812 über rpi-ws281x, GPIO12 (Pin 32), GND Pin 14 – Hardware bevorzugt
let ws = null;
try { const mod = await import("rpi-ws281x"); ws = mod?.default || mod; } catch { ws = null; }

let active = false, numLEDs = 0, pixelData = null;
const gpioPin = 12;   // GPIO12 (Pin 32)
let brightness = 128; // 0..255

function hexToGRB(hex){
  const v = parseInt((hex || "#000000").slice(1), 16) >>> 0;
  const r = (v >> 16) & 0xff, g = (v >> 8) & 0xff, b = v & 0xff;
  return (g << 16) | (r << 8) | b; // WS281x erwartet GRB
}

export async function initLEDs(count = 1000){
  if (!ws) { console.log("[WS2812] rpi-ws281x nicht verfügbar – Simulation aktiv."); return; }
  numLEDs = count; pixelData = new Uint32Array(numLEDs);
  try { ws.init(numLEDs, { gpioPin, brightness }); }
  catch (e) { console.warn("[WS2812] Init-Optionen fehlgeschlagen:", e?.message || e); ws.init(numLEDs); try { ws.setBrightness?.(brightness); } catch {} }
  active = true;
  console.log(`[WS2812] Init: ${numLEDs} LEDs @ GPIO ${gpioPin} (Brightness ${brightness})`);
}

export function setPixel(i, hex) {
  if (!ws || !active || !pixelData) return;
  if (i < 0 || i >= numLEDs) return;
  pixelData[i] = hexToGRB(hex);
}
export function fillRange(a, b, hex){
  if (!ws || !active || !pixelData) return;
  const s = Math.max(0, Math.min(a, b));
  const e = Math.min(numLEDs - 1, Math.max(a, b));
  const v = hexToGRB(hex);
  for (let i = s; i <= e; i++) pixelData[i] = v;
}
export function render(){
  if (!ws || !active || !pixelData) return;
  try { ws.render(pixelData); } catch (e) { console.error("[WS2812] render-Fehler:", e); }
}
export async function shutdownLEDs(){
  if (!ws || !active) return;
  try { pixelData?.fill(0); try { ws.render(pixelData); } catch {} ws.reset?.(); }
  finally { active = false; console.log("[WS2812] Freigegeben."); }
}
