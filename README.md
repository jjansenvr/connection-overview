# Connection Overview

Visualiseer applicatiekoppelingen met React Flow op basis van CSV of YAML data.

## Features

- Upload of plak CSV/YAML data.
- Automatische parsing naar bron/doel-relaties.
- React Flow visualisatie met nodes, pijlen en labels voor type koppeling.
- Hosting-indicatie per applicatie (SaaS / On-premises / Unknown).

## Starten

1. Installeer dependencies:

```bash
npm install
```

2. Start de app:

```bash
npm run dev
```

3. Open de URL die Vite toont (meestal http://localhost:5173).

## Starten Met Docker Compose

```bash
docker compose up --build
```

Open daarna: http://localhost:5173

Stoppen:

```bash
docker compose down
```

## Ondersteunde Dataformaten

De app verwacht records met deze velden (hoofdlettergevoeligheid maakt niet uit):

- Bronapplicatie
- Doelapplicatie
- bronapplicatie Saas of on premises
- Doelapplicatie Saas/on premises
- Soort koppeling

De parser accepteert ook een aantal Engelse aliassen zoals `Source`, `Target` en `Connection type`.

### CSV voorbeeld

```csv
Bronapplicatie,Doelapplicatie,bronapplicatie Saas of on premises,Doelapplicatie Saas/on premises,Soort koppeling
ERP,CRM,On premises,SaaS,API
CRM,Datawarehouse,SaaS,On premises,Batch
HRM,ERP,SaaS,On premises,Event
```

### YAML voorbeeld

```yaml
- Bronapplicatie: ERP
	Doelapplicatie: CRM
	bronapplicatie Saas of on premises: On premises
	Doelapplicatie Saas/on premises: SaaS
	Soort koppeling: API
```

## Build

```bash
npm run build
```
