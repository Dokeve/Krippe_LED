// public/js/audio.js
// Letzte Änderung: 30.08.2025 19.15 Uhr
// Zweck: Verwaltung von Audiosprachdateien (mit Datum/Zeit) und Hintergrundmusik-Zuordnungen.
// Robust gegen fehlende DOM-Elemente (Null-Checks). Lädt lokale MP3-Listen via /api/list-files.

(function () {
  "use strict";

  // ---- Hilfen -------------------------------------------------------------

  const SPEECH_PATH = "/home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien";
  const BG_PATH = "/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik";

  const $ = (id) => document.getElementById(id);
  const logOut = () => $("log-output");

  function ts() {
    // Kompakter Zeitstempel im deutschen Format
    try {
      const d = new Date();
      return `[${d.toLocaleString("de-DE")}]`;
    } catch {
      return "[Zeit]";
    }
  }

  function log(msg, isError = false) {
    const out = logOut();
    const line = `${ts()} ${isError ? "❌" : "ℹ️"} ${msg}\n`;
    if (out) out.textContent += line;
    if (isError) console.error(line);
    else console.log(line);
  }

  async function apiGet(url) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function combineDateTime(dateStr, timeStr) {
    // Gibt ISO-String zurück oder "" wenn leer/undefiniert
    if (!dateStr && !timeStr) return "";
    const d = dateStr || new Date().toISOString().slice(0, 10);
    const t = timeStr || "00:00";
    // ISO ohne Zeitzone (lokale Interpretation reicht für Server-Filespeicher)
    return `${d}T${t}:00`;
  }

  function splitDateTime(iso) {
    // Teilt "YYYY-MM-DDTHH:mm:ss" in {date, time} oder leere Strings
    if (!iso) return { date: "", time: "" };
    const parts = iso.split("T");
    if (parts.length < 2) return { date: iso.slice(0, 10), time: "" };
    return { date: parts[0], time: parts[1]?.slice(0, 5) || "" };
  }

  function optionify(selectEl, list, currentValue) {
    if (!selectEl) return;
    const opts = ['<option value="">— bitte wählen —</option>'].concat(
      (list || []).map((f) => `<option value="${escapeHtml(f)}"${f === currentValue ? " selected" : ""}>${escapeHtml(f)}</option>`)
    );
    selectEl.innerHTML = opts.join("");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const clampPercent = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  };

  // ---- DOM ready ----------------------------------------------------------

  document.addEventListener("DOMContentLoaded", async () => {
    // Elemente ermitteln (sicher)
    const elSpeechLabel = $("speech-label");
    const elSpeechFile = $("speech-file");
    const elSpeechFromDate = $("speech-from-date");
    const elSpeechFromTime = $("speech-from-time");
    const elSpeechToDate = $("speech-to-date");
    const elSpeechToTime = $("speech-to-time");
    const elSpeechSave = $("speech-save");
    const elSpeechReset = $("speech-reset");
    const elSpeechTable = $("speech-table");

    const elBgDay = $("bg-day");
    const elBgDayNight = $("bg-daynight");
    const elBgNight = $("bg-night");
    const elBgNightDay = $("bg-nightday");
    const elBgSave = $("bg-save");

    const elVolSpeech = $("volume-speech");
    const elVolSpeechVal = $("volume-speech-value");
    const elVolBg = $("volume-bg");
    const elVolBgVal = $("volume-bg-value");

    // Nichts tun, wenn zentrale Elemente fehlen (Seite wurde verändert)
    if (!elSpeechFile || !elSpeechTable || !elBgDay || !elBgSave) {
      log("Kritische Elemente nicht gefunden. Überprüfe IDs in audio.html.", true);
      return;
    }

    // Zustand im Speicher
    let audioCfg = {
      volume: { speech: 100, background: 100 },
      speech: [],
      background: { "Tag": "", "Tag-Nacht": "", "Nacht": "", "Nacht-Tag": "" }
    };
    let editIndex = null; // wenn Eintrag bearbeitet wird

    // ---- Initial laden ----------------------------------------------------

    try {
      await loadFileLists();   // Dropdown-Dateien laden
      await loadAudioConfig(); // Konfiguration laden + UI befüllen
      log("Audio UI initialisiert");
    } catch (e) {
      log(`Fehler beim Initialisieren: ${e.message}`, true);
    }

    // ---- Event-Handler ----------------------------------------------------

    // Sprachdatei speichern (neu oder Änderung)
    if (elSpeechSave) {
      elSpeechSave.addEventListener("click", async () => {
        try {
          const label = elSpeechLabel?.value?.trim() || "";
          const file = elSpeechFile?.value || "";
          if (!file) throw new Error("Bitte eine MP3-Datei auswählen.");

          const fromIso = combineDateTime(elSpeechFromDate?.value || "", elSpeechFromTime?.value || "");
          const toIso = combineDateTime(elSpeechToDate?.value || "", elSpeechToTime?.value || "");

          const entry = { label, file, from: fromIso, to: toIso };

          if (editIndex !== null) {
            audioCfg.speech[editIndex] = entry;
            editIndex = null;
          } else {
            audioCfg.speech.push(entry);
          }

          await persistAudio();
          renderSpeechTable();
          clearSpeechForm();
          log("Sprachdatei-Eintrag gespeichert");
        } catch (e) {
          log(`Fehler beim Speichern: ${e.message}`, true);
        }
      });
    }

    if (elSpeechReset) {
      elSpeechReset.addEventListener("click", () => {
        editIndex = null;
        clearSpeechForm();
      });
    }

    // Hintergrundmusik speichern
    if (elBgSave) {
      elBgSave.addEventListener("click", async () => {
        try {
          audioCfg.background = {
            "Tag": elBgDay?.value || "",
            "Tag-Nacht": elBgDayNight?.value || "",
            "Nacht": elBgNight?.value || "",
            "Nacht-Tag": elBgNightDay?.value || ""
          };
          // Lautstärken mitschreiben
        audioCfg.volume = {
          speech: clampPercent(parseInt(elVolSpeech?.value || "100", 10)),
          background: clampPercent(parseInt(elVolBg?.value || "100", 10))
        };
          await persistAudio();
          log("Hintergrundmusik-Zuordnungen gespeichert");
        } catch (e) {
          log(`Fehler beim Speichern der Hintergrundmusik: ${e.message}`, true);
        }
      });
    }

    // Lautstärkeanzeige aktualisieren
    if (elVolSpeech && elVolSpeechVal) {
      elVolSpeech.addEventListener("input", () => {
        const percent = clampPercent(elVolSpeech.value);
        elVolSpeech.value = String(percent);
        elVolSpeechVal.textContent = `${percent}%`;
      });
    }
    if (elVolBg && elVolBgVal) {
      elVolBg.addEventListener("input", () => {
        const percent = clampPercent(elVolBg.value);
        elVolBg.value = String(percent);
        elVolBgVal.textContent = `${percent}%`;
      });
    }

    // Tabelle: Aktionen (Edit/Delete) via Event-Delegation
    if (elSpeechTable) {
      elSpeechTable.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-action]");
        if (!btn) return;
        const idx = parseInt(btn.dataset.index, 10);
        const action = btn.dataset.action;
        if (isNaN(idx) || !audioCfg.speech[idx]) return;

        if (action === "edit") {
          const ent = audioCfg.speech[idx];
          fillSpeechForm(ent);
          editIndex = idx;
        } else if (action === "del") {
          audioCfg.speech.splice(idx, 1);
          persistAudio().then(() => {
            renderSpeechTable();
            log("Sprachdatei-Eintrag gelöscht");
          }).catch(e => log(`Fehler beim Löschen: ${e.message}`, true));
        }
      });
    }

    // ---- Funktionen: Laden/Rendern/Speichern -----------------------------

    async function loadFileLists() {
      try {
        const [speechFiles, bgFiles] = await Promise.all([
          apiGet(`/api/list-files?path=${encodeURIComponent(SPEECH_PATH)}`),
          apiGet(`/api/list-files?path=${encodeURIComponent(BG_PATH)}`)
        ]);

        // Dropdowns füllen
        optionify(elSpeechFile, speechFiles, "");
        optionify(elBgDay, bgFiles, "");
        optionify(elBgDayNight, bgFiles, "");
        optionify(elBgNight, bgFiles, "");
        optionify(elBgNightDay, bgFiles, "");

        log("MP3-Listen geladen");
      } catch (e) {
        log(`Fehler beim Laden der Audiodateien: ${e.message}`, true);
        // Trotzdem leere Dropdowns herstellen, damit später kein innerHTML auf null passiert
        optionify(elSpeechFile, [], "");
        optionify(elBgDay, [], "");
        optionify(elBgDayNight, [], "");
        optionify(elBgNight, [], "");
        optionify(elBgNightDay, [], "");
      }
    }

    async function loadAudioConfig() {
      try {
        const cfg = await apiGet("/api/audio");
        // Merge mit Default-Struktur, um fehlende Felder abzufangen
        audioCfg = {
          volume: {
            speech: clampPercent(cfg?.volume?.speech ?? 100),
            background: clampPercent(cfg?.volume?.background ?? 100)
          },
          speech: Array.isArray(cfg?.speech) ? cfg.speech : [],
          background: {
            "Tag": cfg?.background?.["Tag"] || "",
            "Tag-Nacht": cfg?.background?.["Tag-Nacht"] || "",
            "Nacht": cfg?.background?.["Nacht"] || "",
            "Nacht-Tag": cfg?.background?.["Nacht-Tag"] || ""
          }
        };

        // Volumes in UI
        if (elVolSpeech && elVolSpeechVal) {
          elVolSpeech.value = String(audioCfg.volume.speech);
          elVolSpeechVal.textContent = `${audioCfg.volume.speech}%`;
        }
        if (elVolBg && elVolBgVal) {
          elVolBg.value = String(audioCfg.volume.background);
          elVolBgVal.textContent = `${audioCfg.volume.background}%`;
        }

        // Hintergrundmusik Auswahl setzen (Dropdowns sind bereits befüllt)
        if (elBgDay) elBgDay.value = audioCfg.background["Tag"] || "";
        if (elBgDayNight) elBgDayNight.value = audioCfg.background["Tag-Nacht"] || "";
        if (elBgNight) elBgNight.value = audioCfg.background["Nacht"] || "";
        if (elBgNightDay) elBgNightDay.value = audioCfg.background["Nacht-Tag"] || "";

        renderSpeechTable();
      } catch (e) {
        log(`Fehler beim Laden der Audio-Konfiguration: ${e.message}`, true);
        // audioCfg bleibt default, Tabelle wird leer gezeichnet
        renderSpeechTable();
      }
    }

    function renderSpeechTable() {
      const tbody = elSpeechTable?.querySelector("tbody");
      if (!tbody) return;

      if (!Array.isArray(audioCfg.speech) || audioCfg.speech.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">Keine Sprach-Einträge vorhanden</td></tr>`;
        return;
      }

      const rows = audioCfg.speech.map((ent, i) => {
        const from = splitDateTime(ent.from);
        const to = splitDateTime(ent.to);
        return `
          <tr>
            <td>${escapeHtml(ent.label || "")}</td>
            <td>${escapeHtml(ent.file || "")}</td>
            <td>${escapeHtml(from.date)} ${escapeHtml(from.time)}</td>
            <td>${escapeHtml(to.date)} ${escapeHtml(to.time)}</td>
            <td>
              <button type="button" data-action="edit" data-index="${i}" class="btn btn-small">✏️ Ändern</button>
              <button type="button" data-action="del" data-index="${i}" class="btn btn-small btn-danger">🗑 Löschen</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = rows.join("");
    }

    async function persistAudio() {
      await apiPut("/api/audio", audioCfg);
    }

    function clearSpeechForm() {
      if (elSpeechLabel) elSpeechLabel.value = "";
      if (elSpeechFile) elSpeechFile.value = "";
      if (elSpeechFromDate) elSpeechFromDate.value = "";
      if (elSpeechFromTime) elSpeechFromTime.value = "";
      if (elSpeechToDate) elSpeechToDate.value = "";
      if (elSpeechToTime) elSpeechToTime.value = "";
    }

    function fillSpeechForm(ent) {
      if (elSpeechLabel) elSpeechLabel.value = ent.label || "";
      if (elSpeechFile) elSpeechFile.value = ent.file || "";
      const f = splitDateTime(ent.from);
      const t = splitDateTime(ent.to);
      if (elSpeechFromDate) elSpeechFromDate.value = f.date || "";
      if (elSpeechFromTime) elSpeechFromTime.value = f.time || "";
      if (elSpeechToDate) elSpeechToDate.value = t.date || "";
      if (elSpeechToTime) elSpeechToTime.value = t.time || "";
    }
  });
})();
