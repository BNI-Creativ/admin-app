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
  Printer,
  Plus,
  Trash2,
  Settings,
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
  const [newGuest, setNewGuest] = useState({
    prenume: '',
    nume: '',
    companie: '',
    invitat_de: '',
    taxa: 0,
  });

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Fetch dates that have saved data
  const fetchDatesWithData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/attendance/dates/list`);
      setDatesWithData(response.data.dates || []);
    } catch (error) {
      console.error('Error fetching dates:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/attendance/${dateString}`);
      let membriData = response.data.membri;
      const invitatiData = response.data.invitati;
      
      // Sync inlocuitori from guests to members
      // For each guest marked as inlocuitor, update the corresponding member's nume_inlocuitor
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
      setTotalTaxaMembri(response.data.total_taxa_membri);
      setTotalTaxaInvitati(response.data.total_taxa_invitati);
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

    setMembri((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, prezent, taxa, taxa_lunara: newTaxaLunara } : m
      )
    );

    setTotalTaxaMembri((prev) => prev - oldTaxa + taxa);

    try {
      await axios.post(`${API_URL}/attendance/${dateString}`, {
        member_id: memberId,
        prezent,
        taxa,
        nume_inlocuitor: '',
      });
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  // Add new guest
  const handleAddGuest = async (e) => {
    e.preventDefault();
    try {
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
        prezent: false,
        is_inlocuitor: false,
        member_id: memberId,
      };
      const response = await axios.post(`${API_URL}/guests?data=${dateString}`, guestData);
      setInvitati([...invitati, response.data]);
      setTotalTaxaInvitati((prev) => prev + newGuest.taxa);
      setNewGuest({ prenume: '', nume: '', companie: '', invitat_de: '', taxa: 0 });
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
      // Can only set inlocuitor if invitat_de is set and matches a member
      if (value && (!guest.invitat_de || guest.invitat_de === '-------' || !guest.member_id)) {
        return;
      }
      updatedGuest.is_inlocuitor = value;
      
      const memberId = guest.member_id;
      const membru = membri.find(m => m.id === memberId);
      
      if (value && memberId) {
        // Set guest name as inlocuitor for the member
        const guestName = `${guest.prenume} ${guest.nume}`;
        setMembri((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, nume_inlocuitor: guestName } : m
          )
        );
        // Update attendance with inlocuitor name
        if (membru) {
          await axios.post(`${API_URL}/attendance/${dateString}`, {
            member_id: memberId,
            prezent: membru.prezent || false,
            taxa: membru.taxa || 0,
            nume_inlocuitor: guestName,
          });
        }
      } else if (!value && memberId) {
        // Clear inlocuitor from member
        setMembri((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, nume_inlocuitor: '' } : m
          )
        );
        if (membru) {
          await axios.post(`${API_URL}/attendance/${dateString}`, {
            member_id: memberId,
            prezent: membru.prezent || false,
            taxa: membru.taxa || 0,
            nume_inlocuitor: '',
          });
        }
      }
    }

    // Special handling for prezent change
    if (field === 'prezent') {
      updatedGuest.prezent = value;
    }

    // Update local state
    setInvitati((prev) =>
      prev.map((g) => (g.id === guestId ? updatedGuest : g))
    );

    // Update taxa total if taxa changed
    if (field === 'taxa') {
      const oldTaxa = guest.taxa || 0;
      const newTaxa = value || 0;
      setTotalTaxaInvitati((prev) => prev - oldTaxa + newTaxa);
    }

    // Save guest to API
    try {
      await axios.put(`${API_URL}/guests/${guestId}`, {
        prenume: updatedGuest.prenume,
        nume: updatedGuest.nume,
        companie: updatedGuest.companie,
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
    try {
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
          await axios.post(`${API_URL}/attendance/${dateString}`, {
            member_id: guest.member_id,
            prezent: membru.prezent || false,
            taxa: membru.taxa || 0,
            nume_inlocuitor: '',
          });
        }
      }
      
      await axios.delete(`${API_URL}/guests/${guestId}`);
      setInvitati((prev) => prev.filter((g) => g.id !== guestId));
      setTotalTaxaInvitati((prev) => prev - (guest?.taxa || 0));
    } catch (error) {
      console.error('Error deleting guest:', error);
    }
  };

  // PDF Export
  const handlePrint = () => {
    const element = document.querySelector('.paper-container');
    if (!element) {
      console.error('Paper container not found');
      return;
    }
    
    element.classList.add('pdf-export-mode');
    
    const opt = {
      margin: [0.2, 0.2, 0.2, 0.2],
      filename: `prezenta_${dateString}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'in', 
        format: 'a4', 
        orientation: 'portrait'
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['tr', 'td', '.total-row']
      }
    };
    
    html2pdf().from(element).set(opt).save().then(() => {
      element.classList.remove('pdf-export-mode');
    });
  };

  const formattedDate = format(selectedDate, "EEEE, d MMMM yyyy", { locale: ro });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  // Get sorted members for dropdown
  const sortedMembersForDropdown = [...membri].sort((a, b) => 
    `${a.prenume} ${a.nume}`.localeCompare(`${b.prenume} ${b.nume}`)
  );

  // Calculate total present guests
  const totalInvitatiPrezenti = invitati.filter(g => g.prezent).length;

  return (
    <div className="flex min-h-screen bg-zinc-100">
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-[280px]' : 'w-[60px]'} h-screen bg-white border-r border-zinc-200 flex flex-col no-print transition-all duration-300 ease-in-out flex-shrink-0`}
      >
        <div className="p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 bg-zinc-900 rounded-sm flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-zinc-700 transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Restrânge meniu' : 'Extinde meniu'}
              data-testid="toggle-sidebar"
            >
              <Users className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-zinc-900 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Membri & Invitați
                </h1>
                <p className="text-xs text-zinc-500 truncate">{user?.name}</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="sidebar-link active flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium"
              data-testid="nav-dashboard"
              title="Prezență"
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Prezență</span>}
            </Link>
            <Link
              to="/members"
              className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"
              data-testid="nav-members"
              title="Administrare Membri"
            >
              <Settings className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Administrare Membri</span>}
            </Link>
            <Link
              to="/settings"
              className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"
              data-testid="nav-settings"
              title="Schimbă Parola"
            >
              <Users className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Schimbă Parola</span>}
            </Link>
          </div>
        </nav>

        <div className="p-2 border-t border-zinc-200 flex-shrink-0">
          <Button
            variant="ghost"
            className={`w-full ${sidebarOpen ? 'justify-start' : 'justify-center'} text-zinc-600 hover:bg-zinc-100`}
            onClick={handleLogout}
            data-testid="logout-button"
            title="Deconectare"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            {sidebarOpen && <span className="ml-2">Deconectare</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 no-print">
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-sm border-zinc-200"
                  data-testid="date-picker-trigger"
                >
                  <CalendarDays className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Selectează data
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ro}
                  modifiers={{
                    hasData: datesWithData.map(d => new Date(d + 'T00:00:00'))
                  }}
                  modifiersClassNames={{
                    hasData: 'calendar-has-data'
                  }}
                  data-testid="date-calendar"
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button
            onClick={handlePrint}
            className="bg-zinc-900 hover:bg-zinc-800 rounded-sm"
            data-testid="print-button"
          >
            <Printer className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Exportă PDF
          </Button>
        </div>

        {/* Paper Container */}
        <div className="paper-container print-container">
          {/* Date Display */}
          <div className="text-right mb-8">
            <p className="date-display text-xl text-zinc-900" data-testid="current-date">
              {capitalizedDate}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-500">Se încarcă...</div>
          ) : (
            <div className="space-y-12">
              {/* Membri Table */}
              <section className="animate-fade-in">
                <h2
                  className="text-2xl font-semibold tracking-tight mb-6 text-zinc-900"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  Membri
                </h2>
                <Table className="swiss-table" data-testid="membri-table">
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
                    {membri.map((membru, index) => {
                      const hasInlocuitor = membru.nume_inlocuitor && membru.nume_inlocuitor.length > 0;
                      let rowClass = '';
                      if (hasInlocuitor) {
                        rowClass = 'bg-yellow-100';
                      } else if (membru.prezent) {
                        rowClass = 'bg-green-100';
                      }
                      
                      return (
                        <TableRow 
                          key={membru.id} 
                          data-testid={`membru-row-${membru.id}`}
                          className={rowClass}
                        >
                          <TableCell className="font-medium tabular-nums">
                            {index + 1}
                          </TableCell>
                          <TableCell>{membru.prenume}</TableCell>
                          <TableCell>{membru.nume}</TableCell>
                          <TableCell className="text-zinc-500 text-sm">
                            {membru.nume_inlocuitor || ''}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={hasInlocuitor ? false : membru.prezent}
                              onCheckedChange={(checked) =>
                                handleAttendanceChange(membru.id, checked, membru.taxa)
                              }
                              disabled={hasInlocuitor}
                              className={`attendance-checkbox ${hasInlocuitor ? 'opacity-30 cursor-not-allowed' : ''}`}
                              data-testid={`checkbox-${membru.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={membru.taxa}
                              onChange={(e) =>
                                handleAttendanceChange(
                                  membru.id,
                                  membru.prezent,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="taxa-input table-input rounded-sm"
                              data-testid={`taxa-input-${membru.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-zinc-500" data-testid={`taxa-lunara-${membru.id}`}>
                            {(membru.taxa_lunara || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="total-row">
                      <TableCell colSpan={4} className="text-right font-bold">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-center font-bold tabular-nums" data-testid="total-prezenti">
                        {membri.filter(m => m.prezent).length}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums" data-testid="total-taxa-membri">
                        {totalTaxaMembri.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums" data-testid="total-taxa-lunara">
                        {membri.reduce((sum, m) => sum + (m.taxa_lunara || 0), 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {membri.length === 0 && (
                  <p className="text-center py-8 text-zinc-500">
                    Nu există membri. Adaugă membri din meniul{' '}
                    <Link to="/members" className="text-blue-600 hover:underline">
                      Administrare Membri
                    </Link>
                    .
                  </p>
                )}
              </section>

              {/* Invitați Table */}
              <section className="animate-fade-in">
                <h2
                  className="text-2xl font-semibold tracking-tight mb-6 text-zinc-900"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  Invitați
                </h2>

                {/* Add Guest Form */}
                <form
                  onSubmit={handleAddGuest}
                  className="flex gap-3 mb-6 p-4 bg-zinc-50 rounded-sm no-print"
                  data-testid="add-guest-form"
                >
                  <Input
                    placeholder="Prenume"
                    value={newGuest.prenume}
                    onChange={(e) => setNewGuest({ ...newGuest, prenume: e.target.value })}
                    className="rounded-sm"
                    required
                    data-testid="guest-prenume-input"
                  />
                  <Input
                    placeholder="Nume"
                    value={newGuest.nume}
                    onChange={(e) => setNewGuest({ ...newGuest, nume: e.target.value })}
                    className="rounded-sm"
                    required
                    data-testid="guest-nume-input"
                  />
                  <Input
                    placeholder="Companie"
                    value={newGuest.companie}
                    onChange={(e) => setNewGuest({ ...newGuest, companie: e.target.value })}
                    className="rounded-sm"
                    data-testid="guest-companie-input"
                  />
                  <Select
                    value={newGuest.invitat_de || 'none'}
                    onValueChange={(value) => setNewGuest({ ...newGuest, invitat_de: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger className="rounded-sm w-40" data-testid="guest-invitat-de-select">
                      <SelectValue placeholder="Invitat de">
                        {newGuest.invitat_de || '-------'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-------</SelectItem>
                      {sortedMembersForDropdown.map((membru) => (
                        <SelectItem 
                          key={membru.id} 
                          value={`${membru.prenume} ${membru.nume}`}
                        >
                          {membru.prenume} {membru.nume}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Taxa"
                    value={newGuest.taxa}
                    onChange={(e) =>
                      setNewGuest({ ...newGuest, taxa: parseFloat(e.target.value) || 0 })
                    }
                    className="rounded-sm w-24"
                    data-testid="guest-taxa-input"
                  />
                  <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="add-guest-button">
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </form>

                <Table className="swiss-table" data-testid="invitati-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Nr.</TableHead>
                      <TableHead>Prenume</TableHead>
                      <TableHead>Nume</TableHead>
                      <TableHead>Companie</TableHead>
                      <TableHead className="w-40">Invitat de</TableHead>
                      <TableHead className="w-16 text-center">Prez</TableHead>
                      <TableHead className="w-16 text-center">Înloc</TableHead>
                      <TableHead className="w-20 text-right">Taxa</TableHead>
                      <TableHead className="w-12 no-print"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...invitati]
                      .sort((a, b) => {
                        const nameA = `${a.prenume} ${a.nume}`.toLowerCase();
                        const nameB = `${b.prenume} ${b.nume}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((invitat, index) => (
                      <TableRow 
                        key={invitat.id} 
                        data-testid={`invitat-row-${invitat.id}`}
                        className={invitat.prezent ? 'bg-green-100' : (invitat.is_inlocuitor ? 'bg-blue-50' : '')}
                      >
                        <TableCell className="font-medium tabular-nums">
                          {index + 1}
                        </TableCell>
                        <TableCell data-testid={`invitat-prenume-${invitat.id}`}>
                          {invitat.prenume}
                        </TableCell>
                        <TableCell data-testid={`invitat-nume-${invitat.id}`}>
                          {invitat.nume}
                        </TableCell>
                        <TableCell data-testid={`invitat-companie-${invitat.id}`}>
                          {invitat.companie}
                        </TableCell>
                        <TableCell data-testid={`invitat-invitat-de-${invitat.id}`}>
                          {invitat.invitat_de || '-------'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={invitat.prezent || false}
                            onCheckedChange={(checked) => handleUpdateGuest(invitat.id, 'prezent', checked)}
                            className="attendance-checkbox"
                            data-testid={`prezent-checkbox-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={invitat.is_inlocuitor || false}
                            onCheckedChange={(checked) => handleUpdateGuest(invitat.id, 'is_inlocuitor', checked)}
                            disabled={!invitat.invitat_de || invitat.invitat_de === '-------'}
                            className={`attendance-checkbox ${(!invitat.invitat_de || invitat.invitat_de === '-------') ? 'opacity-30 cursor-not-allowed' : ''}`}
                            data-testid={`inlocuitor-checkbox-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={invitat.taxa}
                            onChange={(e) => handleUpdateGuest(invitat.id, 'taxa', parseFloat(e.target.value) || 0)}
                            className="taxa-input table-input rounded-sm w-16"
                            data-testid={`invitat-taxa-input-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell className="no-print">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGuest(invitat.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-invitat-${invitat.id}`}
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="total-row">
                      <TableCell colSpan={5} className="text-right font-bold">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-center font-bold tabular-nums" data-testid="total-invitati-prezenti">
                        {totalInvitatiPrezenti}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold tabular-nums" data-testid="total-taxa-invitati">
                        {totalTaxaInvitati.toFixed(2)}
                      </TableCell>
                      <TableCell className="no-print"></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {invitati.length === 0 && (
                  <p className="text-center py-8 text-zinc-500">
                    Nu există invitați pentru această dată.
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
