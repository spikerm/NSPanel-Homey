# Homey Energy / utilities page v0.1.0

Deze pagina gebruikt het bestaande Blackymas `utilities` page-slot.

## Importeren in Nextion Editor
1. Maak eerst een kopie van je HMI.
2. Hernoem de bestaande `utilities` tijdelijk naar `utilities_old`.
3. Importeer `utilities_homey_energy_v0.1.0.page`.
4. Zorg dat de nieuwe pagina `utilities` heet en op exact dezelfde pagina-positie staat als de oude `utilities`.
5. Importeer `energy_background_480x320.png` bij Pictures.
6. Selecteer pagina `utilities`, zet `sta` op `image` en kies bij `pic` het ID van `energy_background_480x320.png`.
7. Verwijder daarna `utilities_old`, compileer en upload de TFT.

De map `icons` bevat losse 64x64 transparante PNG-iconen voor latere uitbreidingen.

## Dynamische Nextion componenten
- `sol_w` / `sol_day`
- `bat_soc` / `bat_w` / `bat_st`
- `ev_w` / `ev_a` / `ev_st`
- `grid_w` / `grid_st`
- `home_w`
- `e_time` / `e_temp`

## Homey bridge protocol
Voorbeelden:
- `portal:navigate:energy_homey`
- `portal:energy:solar_power:2.84 kW`
- `portal:energy:solar_today:11.7 kWh`
- `portal:energy:battery_soc:72%`
- `portal:energy:battery_power:-1.85 kW`
- `portal:energy:battery_state:Ontladen`
- `portal:energy:ev_power:7.20 kW`
- `portal:energy:ev_current:16 A`
- `portal:energy:ev_state:Laden`
- `portal:energy:grid_power:-0.64 kW`
- `portal:energy:grid_state:Teruglevering`
- `portal:energy:home_power:1.56 kW`

Homey-app v0.8.0 bevat daarnaast de Flow-actie `Stel Energy-paginawaarde in`.
