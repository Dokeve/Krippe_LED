import config from '../config.js';
import { Log } from './log.js';
import onoff from 'onoff';
const { Gpio } = onoff;

let flow = null;
let inited = false;

function ensure() {
  if (inited) return;
  if (process.platform !== 'linux') {
    Log.warn('GPIO wird auf dieser Plattform nicht initialisiert.');
    inited = true;
    return;
  }
  flow = new Gpio(config.flow.pin, 'out');
  inited = true;
  Log.success('Bachlauf GPIO initialisiert auf Pin ' + config.flow.pin);
}

export function flowOn() {
  ensure();
  if (!flow) return;
  flow.writeSync(1);
  Log.info('Bachlauf EIN');
}

export function flowOff() {
  ensure();
  if (!flow) return;
  flow.writeSync(0);
  Log.info('Bachlauf AUS');
}
