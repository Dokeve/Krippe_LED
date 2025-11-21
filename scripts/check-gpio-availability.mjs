// scripts/check-gpio-availability.mjs
import cfg from '../config.js';
import mod from 'pigpio-client';

const pigpio = (mod.pigpio ?? mod.default?.pigpio)({host:'127.0.0.1',port:8888});
pigpio.once('connected', info => {
  console.log('cfg.gpio=', cfg.gpio);
  console.log('userGpioMask=', info.userGpioMask);
  [2,3,4,5,17,18,22,27,23].forEach(p => {
    console.log('BCM', p, 'available?', !!(info.userGpioMask & (1<<p)));
  });
  pigpio.end();
});
pigpio.on('error', e=>console.error('pigpio error', e && e.message ? e.message : e));