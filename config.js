// config.js
export const CYCLE_SECONDS = {
  total: 300,
  day: 100,
  dayNight: 50,
  night: 100,
  nightDay: 50
};

export const AUDIO_PATHS = {
  speech: '/home/singer/led-sound-bachlauf/audio/krippe/Audioprachdateien',
  bgm: '/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik'
};

// Standard-GPIOs (werden von DB settings ggf. überschrieben)
export const GPIO_DEFAULTS = {
  ws2812Primary: 18,
  ws2812Alt: 12,
  pump: 19,
  audioButton: 13
};
