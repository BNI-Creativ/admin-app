# BNI Prezență - Product Requirements Document

## Descriere Proiect
Aplicație web în limba română pentru gestionarea prezenței membrilor și invitaților la un club/organizație (BNI). Include funcționalități offline-first pentru tablete Android.

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

### 3. Tabel Membri (✅ COMPLET)
- Coloane: Nr., Prenume, Nume, Înlocuitor, Prezent, Taxă, Total Lună
- Sortare alfabetică după Prenume, apoi Nume
- Nr. secvențial care se actualizează la sortare
- Total row pentru Prezent, Taxă și Total Lună
- Total Lună se actualizează în timp real

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
- Datele persistă la refresh

### 6. Evidențiere Rânduri (✅ COMPLET)
- **Verde** (bg-green-100): când membrul/invitatul este marcat prezent
- **Galben** (bg-yellow-100): când membrul are un înlocuitor

### 7. UI/UX (✅ COMPLET)
- Sidebar colapsabil, implicit închis
- Toggle prin icon în stânga-sus
- Design minimalist Swiss-style

### 8. Export PDF (✅ COMPLET)
- Buton "Exportă PDF" în header
- Text negru pentru lizibilitate
- Paginare pentru liste mari
- Styling compact

### 9. Export/Import Date (✅ COMPLET)
- Export JSON versionat cu toată baza de date
- Import JSON cu confirmare (înlocuiește datele existente)
- UI în pagina Settings

### 10. Bug Fixes (✅ COMPLET)
- Scroll excesiv la finalul paginii - REZOLVAT
  - Schimbat `h-screen` în `min-h-screen`
  - Eliminat `overflow-hidden` de pe container
  - Sidebar fix cu spacer pentru layout

## În Curs de Dezvoltare

### Offline-First Architecture (✅ COMPLET)
- **Capacitor**: Configurat pentru Android
- **SQLite**: Plugin instalat (@capacitor-community/sqlite)
- **DatabaseService.js**: Wrapper pentru SQLite/localStorage - IMPLEMENTAT
- **SyncService.js**: Serviciu pentru sincronizare - IMPLEMENTAT
- **OfflineContext.js**: Context React pentru starea offline - IMPLEMENTAT
- **DashboardPage.js**: Refactorizat pentru offline-first - COMPLET

**Funcționalități implementate:**
1. ✅ Indicator vizual Online/Offline (verde/portocaliu)
2. ✅ Buton de sincronizare manuală
3. ✅ Counter pentru modificări nesincronizate
4. ✅ Salvare locală instant pentru toate operațiunile
5. ✅ Sincronizare automată când revine online
6. ✅ Fallback pe date locale când serverul nu e disponibil

## Backlog (P2)

### Build APK Android
- Utilizare Capacitor toolchain
- Ghid disponibil: `/app/frontend/ANDROID_BUILD_GUIDE.md`
- Necesită Android Studio sau build CLI
- **Pregătit pentru build** - arhitectura offline-first este completă

## Arhitectura Tehnică

```
/app/
├── backend/
│   └── server.py       # FastAPI, Motor, JWT, toate endpoint-urile
├── frontend/
│   ├── android/        # Capacitor Android project
│   ├── src/
│   │   ├── components/ui/  # Shadcn UI
│   │   ├── contexts/       # Auth, Offline
│   │   ├── pages/          # Dashboard, Login, Members, Settings
│   │   └── services/       # Database, Sync
│   └── capacitor.config.json
```

## Endpoint-uri API

- `POST /api/auth/login` - Autentificare
- `GET /api/members` - Lista membri
- `POST /api/members` - Adaugă membru
- `GET /api/guests?data=YYYY-MM-DD` - Lista invitați
- `POST /api/guests?data=YYYY-MM-DD` - Adaugă invitat
- `PUT /api/guests/{id}` - Actualizează invitat
- `GET /api/attendance/{data}` - Date prezență zilnică
- `POST /api/attendance/{data}` - Salvează prezență
- `GET /api/export` - Export JSON
- `POST /api/import` - Import JSON

## Data: 6 Februarie 2026

### Actualizări Recente
- Bug scroll excesiv - REZOLVAT
- Export/Import JSON - TESTAT ȘI FUNCȚIONAL
- Toate testele passed (27/27 backend, 100% frontend)
