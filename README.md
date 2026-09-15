# NSPanel for Homey v0.7.1


## v0.7.2

- Stuurt het display na een afgeronde Blackymas-boot automatisch één keer naar `home_smpl` (Homey Portal).
- Laat de originele `Wake-up page`-logica ongemoeid; `home` blijft daardoor als veilige fallback beschikbaar.
- Logt elk ontvangen `localevent` als `Display localevent raw (...)` voor diagnose van `portal_ready` en touch-events.
- Zet vóór de redirect `api=1`, zodat de Portalpagina niet door oude Blueprint-logica wordt geblokkeerd.

Deze versie corrigeert twee belangrijke punten tijdens de eerste custom TFT-test.

## 1. TFT-upload start direct

De knop **Upload Homey Portal TFT** omzeilt nu alleen voor de Portal-upload de
originele Blackymas wachttijd van 5 minuten. Na drukken hoort het NSPanel dus
vrijwel direct de `.tft` URL op te vragen.

De herstelknop voor de standaard EU TFT blijft de originele uploadroutine gebruiken.

## 2. Geen nieuwe pagina-ID 30 gebruiken

Blackymas v2026041 kent in firmware alleen de bestaande pagina-ID's 0..29.
Daarom gebruikt de Homey Portal vanaf v0.7.1 bestaande veilige pagina-slots.

Zie:

`nextion/PAGE_SLOT_MAPPING.md`

Voor de Home-pagina gebruiken we fysiek **home_smpl**. De Homey-app blijft
logisch gewoon `homeyportal` noemen.

## Portal TFT marker

Zet in de Preinitialize Event van `home_smpl` de code uit:

`nextion/events/home_smpl_preinitialize_portal_marker.txt`

Daarmee meldt de TFT:

`home_smpl,portal_ready,0.1.0`

ESPHome toont daarna **Homey Portal TFT Version = 0.1.0**.

## Eerste tegel

Kopieer je huidige header en `tile01_touch` van de zelfgemaakte pagina
`homeyportal` naar de bestaande pagina `home_smpl`.

Gebruik vervolgens voor `tile01_touch`:

`nextion/events/tile01_touch_release_home_smpl.txt`

## ESPHome opnieuw flashen

`homey_bridge.yaml` is aangepast:

```powershell
esphome config wandpaneel-homey.yaml
esphome compile wandpaneel-homey.yaml
esphome run wandpaneel-homey.yaml
```

Daarna kan de aangepaste TFT via `wandpaneel.local` direct OTA worden geladen.
