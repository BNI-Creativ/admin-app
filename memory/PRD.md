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
    server.py       # FastAPI, Motor, JWT, SSE, toate endpoint-urile (~1430 linii)
    .env
  frontend/
    src/
      components/ui/  # Shadcn UI
      contexts/       # AuthContext.js
      hooks/           # useRealtimeSync.js (SSE consumer)
      pages/          
        DashboardPage.js  # Prezenta membri/invitati
        LoginPage.js
        MembersPage.js    # Administrare membri (Status, MSP, Stats)
        SpeakersPage.js   # Administrare vorbitori (Round-Robin)
        TreasuryPage.js   # Trezorerie
        SettingsPage.js   # Setari, Export/Import
        ProjectorPage.js  # Pagina proiector public
      App.js
    package.json
  memory/
    PRD.md
    test_credentials.md
```

## Functionalitati Implementate

### 1. Autentificare (COMPLET)
- Login cu email/password, JWT token pentru sesiuni
- Schimbare parola in Settings

### 2. Dashboard Prezenta (COMPLET)
- Afisare data curenta in format romanesc, Calendar cu marcaj
- Doua tabele: Membri si Invitati, Salvare instant fara reload

### 3. Tabel Membri Dashboard (COMPLET)
- Coloane: Nr., Prenume, Nume, Inlocuitor, Prezent, Taxa, Total Luna
- Sortare alfabetica, Nr. secvential, Total row

### 4. Tabel Invitati Dashboard (COMPLET)
- Formular adaugare invitati, Dropdown "Invitat de", Taxa editabila

### 5. Logica Inlocuitori (COMPLET)
- Checkbox "Inlocuitor" cu autocompletare in coloana membrului

### 6. Evidentiire Randuri (COMPLET)
- Verde: prezent, Galben: inlocuitor, Albastru: invitat-inlocuitor

### 7. UI/UX (COMPLET)
- Sidebar colapsabil, design minimalist Swiss-style, Calendar romanesc

### 8. Export PDF (COMPLET)
- Buton "Exporta PDF", optiune email sau descarcare locala

### 9. Export/Import Date (COMPLET)
- Export JSON versionat, Import JSON cu confirmare

### 10. Pagina Proiector (COMPLET)
- URL public: `/proiector?data=YYYY-MM-DD`, lista randomizata

### 11. Email PDF (COMPLET - necesita configurare SMTP)
- NOTA: Necesita SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT, SMTP_FROM

### 12. Administrare Membri (COMPLET)
- Status Activ/Inactiv, Data MSP, Doreste Prezentare
- Statistici: Total Membri, Activi, cu MSP Activ

### 13. Administrare Vorbitori (COMPLET)
- Round-Robin automat, Export/Import CSV, Interval Vorbitori configurabil

### 14. SSE Real-Time Sync (COMPLET - FIXAT 15 Apr 2026)
- Server-Sent Events pe /api/events?token=JWT
- Hook useRealtimeSync pe toate paginile
- FIX CRITIC: Adaugat broadcast() lipsa pe POST /api/attendance/{data} si alte 5 endpoint-uri
- Testat si verificat: Dashboard, Members, Speakers, Treasury - toate sincronizeaza in real-time

### 15. Trezorerie (COMPLET)
- Intrari/iesiri cu sume colorate, Total general, deduceri lunare

## Key API Endpoints
- Auth: POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password
- Members: GET/POST/PUT/DELETE /api/members
- Guests: GET/POST/PUT/DELETE /api/guests/{data}
- Attendance: GET/POST /api/attendance/{data}, GET /api/attendance/dates/list
- Speakers: GET/POST/DELETE /api/speakers, GET /api/speakers/next, CSV export/import
- Settings: speaker-interval, msp-validity, emails
- Treasury: GET/POST/DELETE /api/treasury, GET /api/treasury/total
- SSE: GET /api/events?token=JWT
- Export: GET /api/export, POST /api/import

## Backlog

### P1 - Configurare SMTP
- Cod gata, necesita variabile de mediu SMTP

### P2 - Build APK Android
- Configuratie Capacitor existenta (neactiva)

### P2 - Refactoring
- server.py >1430 linii - impartire in route-uri separate
- DashboardPage.js >750 linii - componentizare

## Teste
- Iteration 7 (15 Apr 2026): 100% backend (27/27), 100% frontend
- Iteration 8 (15 Apr 2026): SSE sync - 100% (15/15 backend, all frontend pages)
