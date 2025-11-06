#!/bin/bash
# Einfaches Fallback-Testscript, das den Pin mit `pigs` ausliest.
# Usage: BUTTON_PIN=17 ./test-audio-button-pigs.sh

PIN=${BUTTON_PIN:-17}
INTERVAL=${INTERVAL:-0.2}

echo "Reading GPIO pin $PIN via pigs every $INTERVAL seconds. Press Ctrl+C to stop."
while true; do
  VAL=$(pigs r $PIN 2>/dev/null || echo "ERR")
  echo "$(date +%T) pin $PIN = $VAL"
  sleep $INTERVAL
done
