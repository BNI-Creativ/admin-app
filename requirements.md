# Membri & Invitați - Requirements Document

## Problem Statement Original
Aplicație web în română pentru gestionarea membrilor și invitaților.
- Autentificare cu JWT (email/parolă)
- După logare: 2 tabele (Membri și Invitați)
- Data curentă în dreapta sus
- Tabel Membri: nr, prenume, nume, nume inlocuitor, prezent (checkbox), taxa (editabil cu total)
- Tabel Invitați: nr, prenume, nume, companie, invitat de, taxa (doar nr needitabil)
- Membri se adaugă în meniu separat
- Format A4 pentru export PDF
- Istoric prezențe pe zile diferite
- Design: light mode, modern/profesional, minimal

## Architecture & Features Implemented

### Backend (FastAPI + MongoDB)
- **Auth System**: JWT authentication with register/login
- **Members CRUD**: Create, Read, Update, Delete members
- **Guests CRUD**: Create, Read, Update, Delete guests per date
- **Attendance Tracking**: Mark attendance and taxes per member per date
- **Date-based Records**: All attendance and guests are stored by date

### Frontend (React + Tailwind + Shadcn UI)
- **Login/Register Page**: Split-screen design with form and architectural image
- **Dashboard**: Sidebar navigation, date display, tabs for Members/Guests
- **Members Table**: Checkbox for attendance, editable taxa field, auto-calculated total
- **Guests Table**: Fully editable fields (except Nr.), add/delete guests
- **Members Management**: Separate page for CRUD operations on members
- **Date Picker**: Select different dates to view/edit historical data
- **PDF Export**: Print-optimized layout with A4 format

### Database Collections
- `users`: User accounts with hashed passwords
- `members`: Member list with nr, prenume, nume, nume_inlocuitor
- `guests`: Guests per date with all fields
- `attendance`: Attendance records per member per date

## Next Tasks / Improvements
1. **Export to Excel**: Add CSV/Excel export functionality
2. **Statistics Dashboard**: Add charts showing attendance trends over time
3. **Member Categories**: Add categories/groups for members
4. **Email Notifications**: Send reminders for meetings
5. **Backup/Restore**: Database backup functionality
6. **Multi-language Support**: Add English language option
7. **Role-based Access**: Admin vs regular user permissions
8. **Meeting Templates**: Pre-define meeting types with default settings
