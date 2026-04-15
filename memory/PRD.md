# BNI Prezenta - Product Requirements Document

## Descriere Proiect
Aplicatie web in limba romana pentru gestionarea prezentei membrilor si invitatilor la un club/organizatie (BNI). Aplicatie online-only cu interfata moderna si functionalitati complete.

## Utilizatori si Credentiale
- **Admin**: `admin` / `admin123` (email field accepts 'admin' or 'admin@local')
- Pagina de inregistrare a fost dezactivata conform cerintelor

## Arhitectura Tehnica

```
/app/
  backend/
    server.py       # FastAPI, Motor, JWT, SSE, ContextVar middleware
    .env
  frontend/
    src/
      components/ui/  # Shadcn UI + sonner (Toaster)
      contexts/       # AuthContext.js (CLIENT_ID + X-Client-Id header)
      hooks/           # useRealtimeSync.js (SSE consumer with JSON payload parsing)
      pages/          
        DashboardPage.js  # Prezenta (silent fetch + toast)
        LoginPage.js
        MembersPage.js    # Membri (silent fetch + toast)
        SpeakersPage.js   # Vorbitori (silent fetch + toast)
        TreasuryPage.js   # Trezorerie (silent fetch + toast)
        SettingsPage.js
        ProjectorPage.js
      App.js             # Toaster mounted here
    package.json
```

## Functionalitati Implementate

### 1-13. [Toate functionalitatile anterioare - COMPLET]
(Login, Dashboard, Membri, Invitati, Inlocuitori, Evidentiire, UI/UX, PDF, Export/Import, Proiector, Email, Admin Membri, Admin Vorbitori)

### 14. SSE Real-Time Sync (COMPLET - FIXAT 15 Apr 2026)
- Server-Sent Events pe /api/events?token=JWT
- FIX CRITIC: Adaugat broadcast() lipsa pe POST /api/attendance/{data} si alte 5 endpoint-uri
- Testat: Dashboard, Members, Speakers, Treasury - sincronizare real-time

### 15. Toast Notifications + Silent Updates (COMPLET - 15 Apr 2026)
- **ContextVar middleware**: Backend extrage X-Client-Id din request headers
- **Broadcast payload**: Include sender, action, prenume, nume, taxa etc.
- **CLIENT_ID per tab**: Frontend genereaza ID unic per tab browser
- **Self-suppression**: Schimbarile proprii NU genereaza toast (sender === CLIENT_ID)
- **Silent fetch**: fetchData(true) / fetchMembers(true) — fara loading spinner
- **Toast sonner**: Notificari vizuale in coltul dreapta-sus cu detalii specifice
  - "Elena Vasilescu — absent, taxa 0 RON" (attendance)
  - "Membru nou: Ion Popescu" (member create)
  - "Intrare noua: +500 RON" (treasury)
  - "Vorbitor adaugat: Ion Popescu" (speaker)

### 16. Trezorerie (COMPLET)

## Key API Endpoints
- SSE: GET /api/events?token=JWT (payload: {sender, action, prenume, nume, ...})
- Auth, Members, Guests, Attendance, Speakers, Settings, Treasury, Export (unchanged)

## Backlog
- P1: Configurare SMTP pentru email PDF
- P2: Build APK Android
- P2: Refactoring server.py (>1450 linii) si DashboardPage.js (>750 linii)

## Teste
- Iteration 7: 100% backend (27/27), 100% frontend
- Iteration 8: SSE sync 100% (15/15)
- Iteration 9: Toast notifications 100% (10/10 backend, all frontend)
