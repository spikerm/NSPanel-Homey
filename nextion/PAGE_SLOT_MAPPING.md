# Homey Portal page-slot mapping — v0.7.1

**Belangrijk:** Blackymas v2026041 heeft in de ESPHome firmware een vaste
`page_names[]` tabel met pagina-ID 0 t/m 29. Een nieuwe Nextion pagina met ID 30
kan de bestaande `on_page` logica buiten die tabel laten lezen.

Daarom voegen we géén nieuwe fysieke pagina-ID's toe. We hergebruiken bestaande,
geldige pagina-slots en geven ze een nieuwe Homey Portal-layout.

| Logische Portalpagina | Bestaande Nextion pagina |
|---|---|
| Home / Portal | `home_smpl` |
| Woonkamer / lampen | `weather01` |
| Keuken / apparaten | `weather02` |
| Klimaat | `climate` |
| Verlichting / scènes | `weather03` |
| EV / laden | `weather04` |
| Batterij / energie | `weather05` |
| TV / media | `media_player` |
| Deur / toegang | `qrcode` |
| Menu | `utilities` |
| Screensaver | `screensaver` |

## Wat je nu in Nextion Editor doet

1. Bewaar je huidige `homeyportal` pagina eventueel als ontwerpvoorbeeld.
2. Kopieer de vier headercomponenten en `tile01_touch` naar de bestaande pagina `home_smpl`.
3. Laat de fysieke paginanaam **home_smpl** staan.
4. Plaats de code uit `events/home_smpl_preinitialize_portal_marker.txt` in
   **Preinitialize Event** van `home_smpl`.
5. Plaats de code uit `events/tile01_touch_release_home_smpl.txt` in
   **Touch Release Event** van `tile01_touch`.
6. Compileer opnieuw naar `nspanel_homey_portal.tft`.

De software gebruikt naar buiten toe nog steeds logische namen zoals
`homeyportal` en `battery_homey`; ESPHome vertaalt die naar de veilige bestaande
pagina-slots.
