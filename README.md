# NSPanel Homey

Homey-first firmware/UI project for the Sonoff NSPanel EU.

This repository contains the Homey app, ESPHome bridge, Nextion page sources/assets and compiled display files.

Current project version: **0.8.0**

## Structure

- `app.js`, `app.json`, `drivers/`, `lib/` — Homey app
- `esphome/` — ESPHome bridge/config
- `nextion/` — Nextion page specs, importable pages, icons and backgrounds
- `dist/` — compiled TFT files when available

The current Energy page reuses the original Blackymas `utilities` page slot so the upstream page numbering stays intact.
