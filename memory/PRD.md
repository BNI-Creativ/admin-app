# BNI Prezență - Product Requirements Document

## Descriere Proiect
Aplicație web în limba română pentru gestionarea prezenței membrilor și invitaților la un club/organizație (BNI). Aplicație online-only cu interfață modernă și funcționalități complete.

## Utilizatori și Credențiale
- **Admin**: `admin` / `admin123`
- Pagina de înregistrare a fost dezactivată conform cerințelor

## Funcționalități Implementate

### 1. Autentificare (✅ COMPLET)
- Login cu username/password
- JWT token pentru sesiuni
- Schimbare parolă în Settings

### 2. Dashboard Prezență (✅ COMPLET)
- Afișare dată curentă în format românesc
- Calendar cu marcaj pentru zilele cu date salvate
- Două tabele pe o singură pagină: Membri și Invitați
- **Salvare instant fără reload** - toate modificările sunt salvate direct în API

### 3. Tabel Membri (✅ COMPLET)
- Coloane: Nr., Prenume, Nume, Înlocuitor, Prezent, Taxă, Total Lună
- Sortare alfabetică după Prenume, apoi Nume
- Nr. secvențial care se actualizează la sortare
- Total row pentru Prezent, Taxă și Total Lună
- Total Lună calculat lunar per membru

### 4. Tabel Invitați (✅ COMPLET)
- Formular pentru adăugare invitați
- Dropdown "Invitat de" cu lista membrilor
- Coloane: Nr., Prenume, Nume, Companie, Invitat de, Prezent, Înlocuitor, Taxă
- Taxă editabilă direct în tabel
- Sortare alfabetică

### 5. Logica Înlocuitori (✅ COMPLET)
- Checkbox "Înlocuitor" pentru invitați
- Când un invitat e marcat ca înlocuitor, numele său apare automat în coloana "Înlocuitor" a membrului
- Rândul membrului devine galben și checkbox-ul "Prezent" este dezactivat
- Datele persistă corect

### 6. Evidențiere Rânduri (✅ COMPLET)
- **Verde** (bg-green-100): când membrul/invitatul este marcat prezent
- **Galben** (bg-yellow-100): când membrul are un înlocuitor
- **Albastru deschis** (bg-blue-50): când invitatul este marcat ca înlocuitor

### 7. UI/UX (✅ COMPLET)
- Sidebar colapsabil, implicit închis
- Toggle prin icon în stânga-sus
- Design minimalist Swiss-style
- Calendar românesc

### 8. Export PDF (✅ COMPLET)
- Buton "Exportă PDF" în header
- Convertește input-urile în text static pentru randare corectă
- Flexbox centering pentru celule tabel
- Opțiune de trimitere pe email sau descărcare locală

### 9. Export/Import Date (✅ COMPLET)
- Export JSON versionat cu toată baza de date
- Import JSON cu confirmare (înlocuiește datele existente)
- UI în pagina Settings

### 10. Pagina Proiector (✅ COMPLET)
- URL public: `/proiector?data=YYYY-MM-DD`
- Afișează lista persoanelor prezente în format multi-coloană
- Lista randomizată la fiecare încărcare
- Nu necesită autentificare

### 11. Email PDF (✅ COMPLET - necesită configurare SMTP)
- Setări email în pagina Settings
- Dialog de confirmare pentru trimitere sau descărcare locală
- **NOTĂ**: Necesită configurare SMTP (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT, SMTP_FROM)

## Arhitectura Tehnică

```
/app/
├── backend/
│   └── server.py       # FastAPI, Motor, JWT, toate endpoint-urile
├── frontend/
│   ├── src/
│   │   ├── components/ui/  # Shadcn UI
│   │   ├── contexts/       # AuthContext.js
│   │   ├── pages/          
│   │   │   ├── DashboardPage.js  # Prezență membri/invitați
│   │   │   ├── LoginPage.js
│   │   │   ├── MembersPage.js    # Administrare membri
│   │   │   ├── SettingsPage.js   # Setări, Export/Import
│   │   │   └── ProjectorPage.js  # Pagina proiector public
│   │   └── App.js
│   └── package.json
└── memory/
    └── PRD.md
```

## Endpoint-uri API

### Autentificare
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - User curent
- `POST /api/auth/change-password` - Schimbare parolă

### Membri
- `GET /api/members` - Lista membri
- `POST /api/members` - Adaugă membru
- `PUT /api/members/{id}` - Actualizează membru
- `DELETE /api/members/{id}` - Șterge membru

### Invitați
- `GET /api/guests/{data}` - Lista invitați pentru dată
- `POST /api/guests?data=YYYY-MM-DD` - Adaugă invitat
- `PUT /api/guests/{id}` - Actualizează invitat
- `DELETE /api/guests/{id}` - Șterge invitat

### Prezență
- `GET /api/attendance/{data}` - Date prezență zilnică (membri + invitați + totaluri)
- `POST /api/attendance/{data}` - Salvează prezență membru
- `GET /api/attendance/dates/list` - Lista date cu date salvate

### Export/Import
- `GET /api/export` - Export JSON complet
- `POST /api/import` - Import JSON (înlocuiește datele)
- `DELETE /api/clear-all` - Șterge toate datele

### Proiector
- `GET /api/proiector/{data}` - Date pentru proiector (endpoint public)

### Setări
- `GET /api/settings/emails` - Lista email-uri
- `POST /api/settings/emails` - Salvează email-uri
- `POST /api/send-pdf-email` - Trimite PDF pe email

## Backlog (P2)

### Build APK Android
- Configurație Capacitor existentă (dar neactivă)
- Necesită Android Studio sau build CLI
- Opțional - aplicația funcționează bine în browser

## Data: 11 Februarie 2026

### Actualizări Recente
- **Bug Fix Critic REZOLVAT**: Salvarea prezenței funcționează corect fără page reload
- Arhitectura offline-first a fost **ELIMINATĂ** pentru simplificare
- Aplicația folosește acum apeluri directe la API (axios) pentru toate operațiunile
- Testare completă: Backend 100% (27 teste), Frontend 100% (toate funcționalitățile)
