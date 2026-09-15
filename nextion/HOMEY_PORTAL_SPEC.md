# Homey Portal TFT — ontwerp voor NSPanel EU (480×320)

De echte portal-look vereist een aangepaste Nextion HMI/TFT. ESPHome kan alleen
bestaande componenten wijzigen; het kan geen nieuwe grafische layout aanmaken.

## Nieuwe pagina

Pagina: `homeyportal`

Aanbevolen componenten:

Header:
- `p_title` — titel, bv. Home
- `p_subtitle` — subtitel
- `p_time` — tijd
- `p_date` — datum
- `p_temp` — temperatuur
- `p_wifi` — wifi icoon

Tiles 1..8:
- `tile01_bg` .. `tile08_bg`
- `tile01_icon` .. `tile08_icon`
- `tile01_label` .. `tile08_label`
- `tile01_info` .. `tile08_info`
- `tile01_touch` .. `tile08_touch`

Footer:
- `nav_home`
- `nav_dots`
- `nav_menu`

## Touch protocol

Iedere tegel stuurt bij kort drukken:

`homeyportal,short_click,tile01`

en bij lang drukken:

`homeyportal,long_click,tile01`

Dit sluit aan op de Homey event parser.

## Visuele richting

Zie `docs/homey-portal-concept.png`.

- donkere Homey-achtige achtergrond;
- 2 rijen × 4 tegels;
- afgeronde kaart-look;
- duidelijke statuskleur per tegel;
- label + info/status;
- header met tijd/temperatuur;
- footer met pagina-indicatie.

## Belangrijk

De `.HMI` van Blackymas is een Nextion Editor projectbestand. Dat bestand moet in
Nextion Editor worden aangepast en daarna naar `.TFT` worden gecompileerd.
Dit pakket bevat daarom alvast de volledige Homey/ESPHome protocolkant; de
uiteindelijke pixel-layout moet in de HMI worden gebouwd/gecompileerd.
