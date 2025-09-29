export default {
  httpPort: process.env.PORT || 3000,
  staticDir: 'public',
  dataDir: 'data',
  dbFile: 'data/app.sqlite',
  led: {
    totalLeds: 900,
    gpioPin: 18,
    brightness: 128,
    stripType: 'ws2812',
    dma: 10,
  },
  flow: {
    enabled: true,
    pin: 23
  },
  audio: {
    enabled: true,
    dir: 'public/audio'
  },
  security: {
    updateToken: process.env.UPDATE_TOKEN || null
  }
};
