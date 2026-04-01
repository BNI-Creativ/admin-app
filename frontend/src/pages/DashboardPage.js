import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Users,
  CalendarDays,
  LogOut,
  FileText,
  Plus,
  Trash2,
  Settings,
  Monitor,
  Key,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import html2pdf from 'html2pdf.js';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [membri, setMembri] = useState([]);
  const [invitati, setInvitati] = useState([]);
  const [totalTaxaMembri, setTotalTaxaMembri] = useState(0);
  const [totalTaxaInvitati, setTotalTaxaInvitati] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [datesWithData, setDatesWithData] = useState([]);
  const [storedEmails, setStoredEmails] = useState([]);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [monthlyDeduction, setMonthlyDeduction] = useState(0);
  const [newGuest, setNewGuest] = useState({
    prenume: '',
    nume: '',
    companie: '',
    telefon: '',
    invitat_de: '',
    taxa: 0,
  });

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth() + 1;
  
  // Check if monthly deduction feature is enabled (from April 2026 onwards)
  const deductionStartDate = new Date(2026, 3, 1); // April 1, 2026
  const isDeductionEnabled = selectedDate >= deductionStartDate;
  
  // Check if selected date is in the past (not editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDateClean = new Date(selectedDate);
  selectedDateClean.setHours(0, 0, 0, 0);
  const isPastDate = selectedDateClean < today;

  // Fetch stored emails
  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await axios.get(`${API_URL}/settings/emails`);
        setStoredEmails(response.data.emails || []);
      } catch (error) {
        console.error('Error fetching emails:', error);
      }
    };
    fetchEmails();
  }, []);

  // Fetch monthly deduction when month changes
  useEffect(() => {
    const fetchMonthlyDeduction = async () => {
      if (!isDeductionEnabled) {
        setMonthlyDeduction(0);
        return;
      }
      try {
        const response = await axios.get(`${API_URL}/monthly-deduction/${selectedYear}/${selectedMonth}`);
        setMonthlyDeduction(response.data.suma || 0);
      } catch (error) {
        console.error('Error fetching monthly deduction:', error);
        setMonthlyDeduction(0);
      }
    };
    fetchMonthlyDeduction();
  }, [selectedYear, selectedMonth, isDeductionEnabled]);

  // Fetch dates that have saved data
  const fetchDatesWithData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/attendance/dates/list`);
      setDatesWithData(response.data.dates || []);
    } catch (error) {
      console.error('Error fetching dates:', error);
    }
  }, []);

  // Main data fetch from server
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/attendance/${dateString}`);
      const serverData = response.data;

      // Process server data with inlocuitori sync
      let membriData = serverData.membri;
      const invitatiData = serverData.invitati;

      invitatiData.forEach(invitat => {
        if (invitat.is_inlocuitor && invitat.member_id) {
          const memberIndex = membriData.findIndex(m => m.id === invitat.member_id);
          if (memberIndex >= 0) {
            membriData[memberIndex] = {
              ...membriData[memberIndex],
              nume_inlocuitor: `${invitat.prenume} ${invitat.nume}`
            };
          }
        }
      });

      setMembri(membriData);
      setInvitati(invitatiData);
      setTotalTaxaMembri(serverData.total_taxa_membri);
      setTotalTaxaInvitati(serverData.total_taxa_invitati);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateString]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchDatesWithData();
  }, [fetchDatesWithData]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Handle member attendance (checkbox and taxa)
  const handleAttendanceChange = async (memberId, prezent, taxa) => {
    const membru = membri.find(m => m.id === memberId);
    const oldTaxa = membru?.taxa || 0;
    const newTaxaLunara = (membru?.taxa_lunara || 0) - oldTaxa + taxa;

    // Update UI immediately (optimistic update)
    setMembri((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, prezent, taxa, taxa_lunara: newTaxaLunara } : m
      )
    );
    setTotalTaxaMembri((prev) => prev - oldTaxa + taxa);

    // Save to server
    try {
      await axios.post(`${API_URL}/attendance/${dateString}`, {
        member_id: memberId,
        prezent,
        taxa,
        nume_inlocuitor: membru?.nume_inlocuitor || '',
      });
    } catch (error) {
      console.error('Error saving attendance:', error);
      // Revert on error
      setMembri((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, prezent: !prezent, taxa: oldTaxa, taxa_lunara: membru?.taxa_lunara || 0 } : m
        )
      );
      setTotalTaxaMembri((prev) => prev + oldTaxa - taxa);
    }
  };

  // Add new guest
  const handleAddGuest = async (e) => {
    e.preventDefault();

    // Find member_id if invitat_de is set
    let memberId = null;
    if (newGuest.invitat_de) {
      const matchingMember = membri.find(m =>
        `${m.prenume} ${m.nume}` === newGuest.invitat_de
      );
      memberId = matchingMember?.id || null;
    }

    const guestData = {
      ...newGuest,
      data: dateString,
      prezent: false,
      is_inlocuitor: false,
      member_id: memberId,
    };

    try {
      const response = await axios.post(`${API_URL}/guests?data=${dateString}`, guestData);
      setInvitati([...invitati, response.data]);
      setTotalTaxaInvitati((prev) => prev + newGuest.taxa);
      setNewGuest({ prenume: '', nume: '', companie: '', telefon: '', invitat_de: '', taxa: 0 });
    } catch (error) {
      console.error('Error adding guest:', error);
    }
  };

  // Update guest field
  const handleUpdateGuest = async (guestId, field, value) => {
    const guest = invitati.find(g => g.id === guestId);
    if (!guest) return;

    let updatedGuest = { ...guest, [field]: value };

    // Special handling for is_inlocuitor change
    if (field === 'is_inlocuitor') {
      if (value && (!guest.invitat_de || guest.invitat_de === '-------' || !guest.member_id)) {
        return;
      }
      updatedGuest.is_inlocuitor = value;

      const memberId = guest.member_id;
      const membru = membri.find(m => m.id === memberId);

      if (value && memberId) {
        const guestName = `${guest.prenume} ${guest.nume}`;
        setMembri((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, nume_inlocuitor: guestName } : m
          )
        );

        // Save inlocuitor to server
        if (membru) {
          try {
            await axios.post(`${API_URL}/attendance/${dateString}`, {
              member_id: memberId,
              prezent: membru.prezent || false,
              taxa: membru.taxa || 0,
              nume_inlocuitor: guestName,
            });
          } catch (error) {
            console.error('Error saving inlocuitor:', error);
          }
        }
      } else if (!value && memberId) {
        setMembri((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, nume_inlocuitor: '' } : m
          )
        );

        if (membru) {
          try {
            await axios.post(`${API_URL}/attendance/${dateString}`, {
              member_id: memberId,
              prezent: membru.prezent || false,
              taxa: membru.taxa || 0,
              nume_inlocuitor: '',
            });
          } catch (error) {
            console.error('Error clearing inlocuitor:', error);
          }
        }
      }
    }

    // Update local state immediately
    setInvitati((prev) =>
      prev.map((g) => (g.id === guestId ? updatedGuest : g))
    );

    // Update taxa total if taxa changed
    if (field === 'taxa') {
      const oldTaxa = guest.taxa || 0;
      const newTaxa = value || 0;
      setTotalTaxaInvitati((prev) => prev - oldTaxa + newTaxa);
    }

    // Sync to server
    try {
      await axios.put(`${API_URL}/guests/${guestId}`, {
        prenume: updatedGuest.prenume,
        nume: updatedGuest.nume,
        companie: updatedGuest.companie,
        telefon: updatedGuest.telefon,
        invitat_de: updatedGuest.invitat_de,
        taxa: updatedGuest.taxa,
        prezent: updatedGuest.prezent,
        is_inlocuitor: updatedGuest.is_inlocuitor,
        member_id: updatedGuest.member_id,
      });
    } catch (error) {
      console.error('Error updating guest:', error);
    }
  };

  // Delete guest
  const handleDeleteGuest = async (guestId) => {
    const guest = invitati.find((g) => g.id === guestId);

    // If deleting an inlocuitor, clear the nume_inlocuitor from member
    if (guest?.is_inlocuitor && guest?.member_id) {
      const membru = membri.find(m => m.id === guest.member_id);
      if (membru) {
        setMembri((prev) =>
          prev.map((m) =>
            m.id === guest.member_id ? { ...m, nume_inlocuitor: '' } : m
          )
        );

        try {
          await axios.post(`${API_URL}/attendance/${dateString}`, {
            member_id: guest.member_id,
            prezent: membru.prezent || false,
            taxa: membru.taxa || 0,
            nume_inlocuitor: '',
          });
        } catch (error) {
          console.error('Error clearing inlocuitor:', error);
        }
      }
    }

    // Update UI immediately
    setInvitati((prev) => prev.filter((g) => g.id !== guestId));
    setTotalTaxaInvitati((prev) => prev - (guest?.taxa || 0));

    // Delete from server
    try {
      await axios.delete(`${API_URL}/guests/${guestId}`);
    } catch (error) {
      console.error('Error deleting guest:', error);
    }
  };

  // Handle PDF export button click
  const handleExportPdfClick = () => {
    const element = document.querySelector('.paper-container');
    if (!element) return;

    setIsPdfMode(true);

    setTimeout(() => {
      element.classList.add('pdf-export-mode');

      const opt = {
        margin: [0.2, 0.2, 0.2, 0.2],
        filename: `prezenta_${dateString}.pdf`,
        image: { type: 'jpeg', quality: 0.5 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
        },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.page-break-before' }
      };

      html2pdf().from(element).set(opt).save().then(() => {
        element.classList.remove('pdf-export-mode');
        setIsPdfMode(false);
      }).catch((error) => {
        console.error('PDF generation error:', error);
        element.classList.remove('pdf-export-mode');
        setIsPdfMode(false);
      });
    }, 300);
  };

  // Generate PDF as base64
  const generatePdfBase64 = async () => {
    const element = document.querySelector('.paper-container');
    if (!element) return null;

    // Activează modul PDF pentru a converti input-urile în text static
    setIsPdfMode(true);

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const opt = {
            margin: [5, 5, 5, 5],
            filename: `prezenta_${dateString}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          const pdfBlob = await html2pdf().from(element).set(opt).outputPdf('blob');
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(pdfBlob);
        } finally {
          setIsPdfMode(false);
        }
      }, 300);
    });
  };

  // Send PDF via email
  const handleSendPdfEmail = async () => {
    setIsSendingEmail(true);
    setShowEmailPrompt(false);

    try {
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) {
        alert('Eroare la generarea PDF-ului');
        return;
      }

      await axios.post(`${API_URL}/send-pdf-email`, {
        data: dateString,
        pdf_base64: pdfBase64
      });

      alert(`PDF-ul a fost trimis pe: ${storedEmails.join(', ')}`);
    } catch (error) {
      alert('Eroare la trimiterea email-ului: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Open projector page
  const handleOpenProjector = () => {
    const projectorUrl = `${window.location.origin}/proiector?data=${dateString}`;
    window.open(projectorUrl, '_blank');
  };

  const formattedDate = format(selectedDate, "EEEE, d MMMM yyyy", { locale: ro });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const sortedMembersForDropdown = [...membri].sort((a, b) =>
    `${a.prenume} ${a.nume}`.localeCompare(`${b.prenume} ${b.nume}`)
  );

  const totalInvitatiPrezenti = invitati.filter(g => g.prezent).length;

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className={`${sidebarOpen ? 'w-[280px]' : 'w-[60px]'} fixed top-0 left-0 h-screen bg-white border-r border-zinc-200 flex flex-col no-print transition-all duration-300 ease-in-out flex-shrink-0 z-40`}>
        <div className="p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-sm flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-zinc-700 transition-colors" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Users className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-zinc-900 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>Membri & Invitați</h1>
                <p className="text-xs text-zinc-500 truncate">{user?.name}</p>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-1">
            <Link to="/dashboard" className="sidebar-link active flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium"><CalendarDays className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />{sidebarOpen && <span>Prezență</span>}</Link>
            <Link to="/members" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"><Settings className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />{sidebarOpen && <span>Administrare Membri</span>}</Link>
            <Link to="/treasury" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"><Wallet className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />{sidebarOpen && <span>Trezorerie</span>}</Link>
            <Link to="/settings" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"><Key className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />{sidebarOpen && <span>Setări</span>}</Link>
          </div>
        </nav>
        <div className="p-2 border-t border-zinc-200 flex-shrink-0">
          <Button variant="ghost" className={`w-full ${sidebarOpen ? 'justify-start' : 'justify-center'} text-zinc-600 hover:bg-zinc-100`} onClick={handleLogout}><LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />{sidebarOpen && <span className="ml-2">Deconectare</span>}</Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 pb-16">
        <div className="flex items-center justify-between mb-8 no-print">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" className="rounded-sm border-zinc-200"><CalendarDays className="w-4 h-4 mr-2" strokeWidth={1.5} />Selectează data</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} locale={ro} modifiers={{ hasData: datesWithData.map(d => new Date(d + 'T00:00:00')) }} modifiersClassNames={{ hasData: 'calendar-has-data' }} />
            </PopoverContent>
          </Popover>
          <div className="flex gap-2">
            <Button onClick={handleOpenProjector} variant="outline" className="rounded-sm border-zinc-300"><Monitor className="w-4 h-4 mr-2" strokeWidth={1.5} />Proiector</Button>
            <Button onClick={handleExportPdfClick} className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" disabled={isSendingEmail}><FileText className="w-4 h-4 mr-2" strokeWidth={1.5} />{isSendingEmail ? 'Se trimite...' : 'Exportă PDF'}</Button>
          </div>
        </div>

        {showEmailPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Trimite PDF pe email?</h3>
              <p className="text-zinc-600 mb-6">Doriți ca PDF-ul să fie trimis pe email-urile stocate în setări?</p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => { setShowEmailPrompt(false); handleExportPdfClick(); }}>Nu, exportă local</Button>
                <Button onClick={handleSendPdfEmail} className="bg-blue-600 hover:bg-blue-700 rounded-sm">Da, trimite pe email</Button>
              </div>
            </div>
          </div>
        )}

        <div className="paper-container print-container">
          <div className="text-right mb-8"><p className="date-display text-xl text-zinc-900">{capitalizedDate}</p></div>
          {isPastDate && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-sm text-amber-700 text-sm no-print">
              Lista de prezență pentru această dată nu mai poate fi modificată.
            </div>
          )}
          {loading ? (
            <div className="text-center py-12 text-zinc-500">Se încarcă...</div>
          ) : (
            <div className="space-y-12">
              <section className="animate-fade-in">
                <h2 className="text-2xl font-semibold tracking-tight mb-6 text-zinc-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Membri</h2>
                <Table className="swiss-table membri-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Nr.</TableHead>
                      <TableHead>Prenume</TableHead>
                      <TableHead>Nume</TableHead>
                      <TableHead>Înlocuitor</TableHead>
                      <TableHead className="w-16 text-center">Prez</TableHead>
                      <TableHead className="w-20 text-right">Taxa</TableHead>
                      <TableHead className="w-24 text-right">Total Lună</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(isPdfMode ? membri.slice(0, 24) : membri).map((membru, index) => {
                      const hasInlocuitor = membru.nume_inlocuitor && membru.nume_inlocuitor.length > 0;
                      const isDisabled = isPastDate || hasInlocuitor;
                      return (
                        <TableRow key={membru.id} className={hasInlocuitor ? 'bg-yellow-100' : membru.prezent ? 'bg-green-100' : ''}>
                          <TableCell className="font-medium tabular-nums">{index + 1}</TableCell>
                          <TableCell>{membru.prenume}</TableCell>
                          <TableCell>{membru.nume}</TableCell>
                          <TableCell>{isPdfMode ? (membru.nume_inlocuitor || '-') : (membru.nume_inlocuitor || '')}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox checked={hasInlocuitor ? false : membru.prezent} onCheckedChange={(checked) => handleAttendanceChange(membru.id, checked, membru.taxa)} disabled={isDisabled} className={`attendance-checkbox ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} />
                          </TableCell>
                          <TableCell className="text-right">
                            {isPdfMode ? (<span className="tabular-nums">{membru.taxa}</span>) : (
                              <Input type="number" value={membru.taxa} onChange={(e) => handleAttendanceChange(membru.id, membru.prezent, parseFloat(e.target.value) || 0)} className="taxa-input table-input" disabled={isPastDate} />
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-zinc-500">{(membru.taxa_lunara || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {(!isPdfMode || membri.length <= 24) && (
                      <TableRow className="total-row">
                        <TableCell colSpan={4} className="text-right font-bold">TOTAL</TableCell>
                        <TableCell className="text-center font-bold">{membri.filter(m => m.prezent).length}</TableCell>
                        <TableCell className="text-right font-bold">{totalTaxaMembri.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold">{membri.reduce((sum, m) => sum + (m.taxa_lunara || 0), 0).toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {isPdfMode && membri.length > 24 && (
                  <div className="page-break-before" style={{ marginTop: '40px' }}>
                    <h2 className="text-2xl font-semibold mb-6 invisible-h2">Membri (continuare)</h2>
                    <Table className="swiss-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">Nr.</TableHead>
                          <TableHead>Prenume</TableHead><TableHead>Nume</TableHead><TableHead>Înlocuitor</TableHead>
                          <TableHead className="w-16 text-center">Prez</TableHead><TableHead className="w-20 text-right">Taxa</TableHead>
                          <TableHead className="w-24 text-right">Total Lună</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membri.slice(24).map((membru, index) => (
                          <TableRow key={membru.id} className={membru.nume_inlocuitor ? 'bg-yellow-100' : membru.prezent ? 'bg-green-100' : ''}>
                            <TableCell>{index + 25}</TableCell>
                            <TableCell>{membru.prenume}</TableCell><TableCell>{membru.nume}</TableCell>
                            <TableCell>{membru.nume_inlocuitor || '-'}</TableCell>
                            <TableCell className="text-center"><Checkbox checked={membru.prezent} className="attendance-checkbox" /></TableCell>
                            <TableCell className="text-right"><span className="tabular-nums">{membru.taxa}</span></TableCell>
                            <TableCell className="text-right">{(membru.taxa_lunara || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="total-row">
                          <TableCell colSpan={4} className="text-right font-bold">TOTAL</TableCell>
                          <TableCell className="text-center font-bold">{membri.filter(m => m.prezent).length}</TableCell>
                          <TableCell className="text-right font-bold">{totalTaxaMembri.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{membri.reduce((sum, m) => sum + (m.taxa_lunara || 0), 0).toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <section className="animate-fade-in invitati-section page-break-before">
                <h2 className="text-2xl font-semibold tracking-tight mb-6 text-zinc-900">Invitați</h2>
                {!isPastDate && (
                  <form onSubmit={handleAddGuest} className="flex gap-3 mb-6 p-4 bg-zinc-50 rounded-sm no-print" data-testid="add-guest-form">
                    <Input placeholder="Prenume" value={newGuest.prenume} onChange={(e) => setNewGuest({ ...newGuest, prenume: e.target.value })} className="rounded-sm" required data-testid="guest-prenume-input" />
                    <Input placeholder="Nume" value={newGuest.nume} onChange={(e) => setNewGuest({ ...newGuest, nume: e.target.value })} className="rounded-sm" required data-testid="guest-nume-input" />
                    <Input placeholder="Companie" value={newGuest.companie} onChange={(e) => setNewGuest({ ...newGuest, companie: e.target.value })} className="rounded-sm" data-testid="guest-companie-input" />
                    <Input placeholder="Telefon" value={newGuest.telefon} onChange={(e) => setNewGuest({ ...newGuest, telefon: e.target.value })} className="rounded-sm w-32" data-testid="guest-telefon-input" />
                    <Select value={newGuest.invitat_de || 'none'} onValueChange={(value) => setNewGuest({ ...newGuest, invitat_de: value === 'none' ? '' : value })}>
                      <SelectTrigger className="rounded-sm w-40" data-testid="guest-invitat-de-select">
                        <SelectValue placeholder="Invitat de">
                          {newGuest.invitat_de || '-------'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-------</SelectItem>
                        {sortedMembersForDropdown.map((membru) => (
                          <SelectItem key={membru.id} value={`${membru.prenume} ${membru.nume}`}>
                            {membru.prenume} {membru.nume}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="add-guest-button">
                      <Plus className="w-4 h-4" strokeWidth={1.5} />
                    </Button>
                  </form>
                )}

                <Table className="swiss-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Nr.</TableHead><TableHead>Nume</TableHead><TableHead>Companie</TableHead><TableHead className="w-32">Telefon</TableHead><TableHead className="w-40">Invitat de</TableHead>
                      <TableHead className="w-16 text-center">Prez</TableHead><TableHead className="w-16 text-center">Înloc</TableHead><TableHead className="w-20 text-right">Taxa</TableHead>{!isPastDate && <TableHead className="w-12 no-print"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...invitati].sort((a, b) => `${a.prenume} ${a.nume}`.localeCompare(`${b.prenume} ${b.nume}`)).map((invitat, index) => {
                      const canEditInlocuitor = !isPastDate && invitat.invitat_de && invitat.invitat_de !== '-------';
                      return (
                        <TableRow key={invitat.id} className={invitat.prezent ? 'bg-green-100' : (invitat.is_inlocuitor ? 'bg-blue-50' : '')}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{invitat.prenume} {invitat.nume}</TableCell><TableCell>{invitat.companie}</TableCell><TableCell>{invitat.telefon || '-'}</TableCell><TableCell>{invitat.invitat_de || '-------'}</TableCell>
                          <TableCell className="text-center"><Checkbox checked={invitat.prezent || false} onCheckedChange={(checked) => handleUpdateGuest(invitat.id, 'prezent', checked)} disabled={isPastDate} className={`attendance-checkbox ${isPastDate ? 'opacity-50 cursor-not-allowed' : ''}`} /></TableCell>
                          <TableCell className="text-center"><Checkbox checked={invitat.is_inlocuitor || false} onCheckedChange={(checked) => handleUpdateGuest(invitat.id, 'is_inlocuitor', checked)} disabled={!canEditInlocuitor} className={`attendance-checkbox ${!canEditInlocuitor ? 'opacity-50 cursor-not-allowed' : ''}`} /></TableCell>
                          <TableCell className="text-right">
                            {isPdfMode || isPastDate ? (<span className="tabular-nums">{invitat.taxa}</span>) : (
                              <Input type="number" value={invitat.taxa} onChange={(e) => handleUpdateGuest(invitat.id, 'taxa', parseFloat(e.target.value) || 0)} className="taxa-input table-input rounded-sm w-16" />
                            )}
                          </TableCell>
                          {!isPastDate && <TableCell className="no-print"><Button variant="ghost" size="sm" onClick={() => handleDeleteGuest(invitat.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button></TableCell>}
                        </TableRow>
                      );
                    })}
                    <TableRow className="total-row">
                      <TableCell colSpan={5} className="text-right font-bold">TOTAL</TableCell>
                      <TableCell className="text-center font-bold">{totalInvitatiPrezenti}</TableCell><TableCell></TableCell>
                      <TableCell className="text-right font-bold">{totalTaxaInvitati.toFixed(2)}</TableCell>{!isPastDate && <TableCell className="no-print"></TableCell>}
                    </TableRow>
                  </TableBody>
                </Table>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
