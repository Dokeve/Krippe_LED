// services/scheduler.js
// Einfache Modul-Logik über Kalender:
// - "Modul 1" im aktuellen Eventtitel -> alles an (Hook)
// - "Modul 2" -> Szenarien + Audio (Hook)
import { query } from "./db.js";
import { initLEDs } from "./ws2812.js";

let timer = null;

async function tick(){
  try{
    const now = new Date().toISOString();
    const rows = await query(
      "SELECT * FROM calendar_event WHERE start<=:now AND (`end` IS NULL OR `end`>:now) ORDER BY start DESC LIMIT 1",
      { now }
    );
    const cur = rows[0];
    if (!cur) return;

    const title = String(cur.title || "").toLowerCase();
    if (title.includes("modul 1")) {
      await initLEDs(1000);
      // TODO: "alles an"  Farben/Gruppen aus DB ziehen und anwenden
    }
    if (title.includes("modul 2")) {
      await initLEDs(1000);
      // TODO: Szenarien fahren + passende Audiofiles abspielen
    }
  } catch (e) {
    console.error("[scheduler] tick error:", e?.message || e);
  }
}

export async function startScheduler(){
  if (timer) return;
  timer = setInterval(tick, 5000);
  console.log("[scheduler] gestartet");
}
export async function stopScheduler(){
  if (timer) { clearInterval(timer); timer = null; console.log("[scheduler] gestoppt"); }
}
