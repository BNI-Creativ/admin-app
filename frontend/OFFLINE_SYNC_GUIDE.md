# Ghid: Aplicație Android Offline-First cu Sincronizare

## Arhitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    TABLETA ANDROID                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React App (WebView)                     │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │ Dashboard   │  │  Members     │  │  Settings  │ │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘ │   │
│  │           │              │               │          │   │
│  │           └──────────────┼───────────────┘          │   │
│  │                          │                          │   │
│  │                  ┌───────▼───────┐                  │   │
│  │                  │ OfflineContext │                  │   │
│  │                  └───────┬───────┘                  │   │
│  │                          │                          │   │
│  │    ┌─────────────────────┼─────────────────────┐   │   │
│  │    │                     │                     │   │   │
│  │    ▼                     ▼                     │   │   │
│  │ ┌────────────┐   ┌──────────────┐             │   │   │
│  │ │DatabaseSvc │   │  SyncService │             │   │   │
│  │ └─────┬──────┘   └──────┬───────┘             │   │   │
│  │       │                 │                      │   │   │
│  │       ▼                 │                      │   │   │
│  │ ┌──────────┐            │                      │   │   │
│  │ │  SQLite  │            │                      │   │   │
│  │ │ (Local)  │            │                      │   │   │
│  │ └──────────┘            │                      │   │   │
│  └─────────────────────────┼──────────────────────┘   │   │
│                            │                           │
└────────────────────────────┼───────────────────────────┘
                             │ (când are internet)
                             ▼
                    ┌─────────────────┐
                    │  Backend FastAPI │
                    │    + MongoDB     │
                    └─────────────────┘
```

## Funcționalitate Offline

### Stocare Locală (SQLite)
- **Membri**: Toate datele membrilor
- **Prezență**: Înregistrări zilnice de prezență
- **Invitați**: Lista de invitați per dată
- **Totaluri lunare**: Calcule pentru taxa lunară

### Sincronizare
- **Automată**: La fiecare 5 minute când este online
- **Manuală**: Buton "Sincronizează" în header
- **La reconectare**: Automat când se reconectează la internet

### Rezolvare Conflicte
- **Prioritate locală**: Datele de pe tabletă suprascriu cele de pe server
- Dacă modificați local și pe server, versiunea locală câștigă

---

## Structura Fișierelor Noi

```
frontend/src/
├── services/
│   ├── DatabaseService.js   # Operații SQLite locale
│   └── SyncService.js       # Logica de sincronizare
├── contexts/
│   └── OfflineContext.js    # Provider pentru starea offline
└── components/
    └── SyncIndicator.js     # UI pentru status sincronizare
```

---

## Configurare Backend pentru Sincronizare

Backend-ul are acum endpoint-uri noi:

### POST `/api/sync/push`
Primește date de la aplicația mobilă și le salvează în MongoDB.

```json
{
  "members": [...],
  "attendance": [...],
  "guests": [...]
}
```

### GET `/api/sync/pull`
Trimite toate datele către aplicația mobilă.

Query params:
- `since` (opțional): Timestamp ISO pentru a primi doar date noi

---

## Instalare și Build

### 1. Instalare dependențe
```bash
cd frontend
yarn install
```

### 2. Build pentru Android
```bash
yarn build
npx cap sync android
```

### 3. Deschidere în Android Studio
```bash
npx cap open android
```

### 4. Generare APK
- Build → Build APK(s)
- SAU din terminal: `cd android && ./gradlew assembleDebug`

---

## Configurare URL Backend

### Pentru dezvoltare locală:
Editați `frontend/.env`:
```
REACT_APP_BACKEND_URL=http://192.168.1.100:8001
```

### Pentru producție:
Editați `frontend/.env.production`:
```
REACT_APP_BACKEND_URL=https://your-server.com
```

### Pentru mod complet offline:
Lăsați `REACT_APP_BACKEND_URL` gol sau nu-l setați. Aplicația va funcționa doar local.

---

## Baza de Date SQLite Locală

### Tabele

**members**
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | TEXT | UUID unic |
| nr | INTEGER | Număr ordine |
| prenume | TEXT | Prenume |
| nume | TEXT | Nume |
| synced | INTEGER | 0=nesincronizat, 1=sincronizat |

**attendance**
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | TEXT | member_id + data |
| member_id | TEXT | FK către members |
| data | TEXT | Data (YYYY-MM-DD) |
| prezent | INTEGER | 0/1 |
| taxa | REAL | Taxa zilnică |
| nume_inlocuitor | TEXT | Nume înlocuitor |
| synced | INTEGER | 0/1 |

**guests**
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | TEXT | UUID unic |
| prenume, nume | TEXT | Date personale |
| companie | TEXT | Companie |
| invitat_de | TEXT | Cine l-a invitat |
| taxa | REAL | Taxa |
| data | TEXT | Data |
| is_inlocuitor | INTEGER | 0/1 |
| member_id | TEXT | FK dacă e înlocuitor |
| synced | INTEGER | 0/1 |

---

## Utilizare în Cod

### Accesare bază de date locală
```javascript
import { useOffline } from '../contexts/OfflineContext';

function MyComponent() {
  const { db, isOnline, sync, syncStatus } = useOffline();

  // Citire membri
  const membri = await db.getMembers();

  // Salvare prezență
  await db.saveAttendance(date, memberId, prezent, taxa, numeInlocuitor);

  // Sincronizare manuală
  await sync();
}
```

---

## Indicator Sincronizare

Componenta `SyncIndicator` afișează:
- 🟢 Online / 🔴 Offline
- Număr de înregistrări nesincronizate
- Ultima sincronizare
- Buton pentru sincronizare manuală

---

## Troubleshooting

### Eroare: "Database not initialized"
- Asigurați-vă că `OfflineProvider` învelește aplicația în `App.js`
- Verificați că jeep-sqlite este încărcat în index.html (pentru web)

### Datele nu se sincronizează
- Verificați conexiunea la internet
- Verificați URL-ul backend în `.env`
- Verificați că backend-ul rulează și endpoint-urile `/api/sync/*` funcționează

### SQLite nu funcționează pe web
- Adăugați `<jeep-sqlite></jeep-sqlite>` în body-ul HTML
- Importați script-ul jeep-sqlite în head

---

## Versiuni

- Android minim: **10** (API 29)
- Android target: **14** (API 34)
- Capacitor: **5.7.8**
- SQLite Plugin: **7.0.3**
