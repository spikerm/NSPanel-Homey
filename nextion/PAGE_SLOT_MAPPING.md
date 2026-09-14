# Homey Portal page-slot mapping

Blackymas v2026041 gebruikt vaste Nextion pagina-ID's 0 t/m 29. Daarom voegen we geen nieuwe fysieke pagina-ID's toe; we hergebruiken bestaande slots.

| Logische Homey pagina | Fysieke Nextion pagina |
|---|---|
| Home / Portal | `home_smpl` |
| Lampen | `weather01` |
| Apparaten | `weather02` |
| Klimaat | `climate` |
| Scenes | `weather03` |
| EV | `weather04` |
| Batterij | `weather05` |
| Energie | `utilities` |
| Media | `media_player` |
| Deur | `qrcode` |
| Screensaver | `screensaver` |

`utilities` blijft dus gereserveerd voor de Energy-pagina.
