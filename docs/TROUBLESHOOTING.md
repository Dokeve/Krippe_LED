# TROUBLESHOOTING

- **ESM/CJS:** `type:"module"` setzen oder `.mjs` verwenden; CJS als `.cjs`.
- **Rechte:** Dienstuser `pi` braucht Leserechte auf Audio-Ordnern.
- **Audio-Picker:** serverseitige Whitelist + `readdir`; Frontend Filter `*.mp3, *.wav`.
- **Formulare:** localStorage-Puffer + klare 2xx/4xx-Serverantworten.
