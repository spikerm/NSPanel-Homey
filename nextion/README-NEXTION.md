# Homey Portal – Nextion Editor starter project

Ja: je kunt een echt `.HMI` project gebruiken als basis.

## 1. Maak het basisbestand automatisch

Open PowerShell in deze map en voer uit:

```powershell
.\prepare-nextion-project.ps1
```

Het script downloadt de officiële **Blackymas v2026041 `nspanel_eu.HMI`**
en slaat hem op als:

```text
nspanel_homey_portal.HMI
```

Dit is een echt, door Nextion Editor te openen HMI-project. We gebruiken bewust
het bestaande project als basis zodat boot, fonts, afbeeldingen en hardware-events
niet vanaf nul opnieuw hoeven.

## 2. Open in Nextion Editor

Open `nspanel_homey_portal.HMI`.

Maak daarna de pagina's uit `HOMEY_PORTAL_PAGES.csv`.

De exacte componentnamen en startposities staan in:

```text
HOMEY_PORTAL_COMPONENTS.csv
```

Die namen zijn belangrijk: de Homey/ESPHome software gebruikt dezelfde namen.

## 3. Events

In `events` staan voorbeeld-events voor touch.

De events sturen hetzelfde `localevent` protocol als de bestaande Blackymas TFT,
zodat ESPHome de aanraking kan ontvangen en naar Homey kan doorgeven.

## 4. Compileer

In Nextion Editor:

**File → TFT file output**

Sla het resultaat op als:

```text
nspanel_homey_portal.tft
```

## 5. OTA naar het NSPanel

Zet de `.tft` op een HTTP(S)-server die het NSPanel kan bereiken.
Vul die URL vervolgens in op `wandpaneel.local` bij:

**Homey Portal TFT URL**

en druk op:

**Upload Homey Portal TFT**

## Waarom ik niet rechtstreeks een compleet gewijzigd HMI binary uit ChatGPT lever

Het `.HMI` formaat is een proprietair binair Nextion projectformaat. Het wijzigen
en correct herschrijven daarvan gebeurt door Nextion Editor. Daarom levert deze
map een echt HMI-basisbestand via het downloadscript, plus een machineleesbare
pagina/component-specificatie en eventcode. Daarmee hoef je niet zelf namen,
coördinaten of protocol te bedenken.
