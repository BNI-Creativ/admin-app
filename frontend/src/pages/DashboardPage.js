import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
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
  PanelLeftClose,
  PanelLeft,
  UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Debounce hook
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null);
  
  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [membri, setMembri] = useState([]);
  const [invitati, setInvitati] = useState([]);
  const [totalTaxaMembri, setTotalTaxaMembri] = useState(0);
  const [totalTaxaInvitati, setTotalTaxaInvitati] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [datesWithData, setDatesWithData] = useState([]);
  const [newGuest, setNewGuest] = useState({
    prenume: '',
    nume: '',
    companie: '',
    invitat_de: '',
    taxa: 0,
  });
  
  // Track pending inlocuitor updates
  const pendingInlocuitorRef = useRef({});

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
      setMembri(response.data.membri);
      setInvitati(response.data.invitati);
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

  // Save attendance to API (called with debounce for text fields)
  const saveAttendanceToAPI = useCallback(async (memberId, prezent, taxa, numeInlocuitor, oldNumeInlocuitor) => {
    try {
      const membru = membri.find(m => m.id === memberId);
      
      await axios.post(`${API_URL}/attendance/${dateString}`, {
        member_id: memberId,
        prezent,
        taxa,
        nume_inlocuitor: numeInlocuitor,
      });

      // Handle inlocuitor guest creation/update/deletion
      if (numeInlocuitor && numeInlocuitor.trim()) {
        const parts = numeInlocuitor.trim().split(' ');
        const prenume = parts[0] || '';
        const nume = parts.slice(1).join(' ') || '';
        const membruNume = `${membru?.prenume || ''} ${membru?.nume || ''}`;

        const existingInlocuitor = invitati.find(
          g => g.is_inlocuitor && g.member_id === memberId
        );

        if (existingInlocuitor) {
          await axios.put(`${API_URL}/guests/${existingInlocuitor.id}`, {
            prenume,
            nume,
            invitat_de: membruNume,
          });
          setInvitati((prev) =>
            prev.map((g) =>
              g.id === existingInlocuitor.id
                ? { ...g, prenume, nume, invitat_de: membruNume }
                : g
            )
          );
        } else {
          const guestData = {
            prenume,
            nume,
            companie: 'Înlocuitor',
            invitat_de: membruNume,
            taxa: 0,
            is_inlocuitor: true,
            member_id: memberId,
          };
          const response = await axios.post(`${API_URL}/guests?data=${dateString}`, guestData);
          setInvitati((prev) => [...prev, response.data]);
        }
      } else if (!numeInlocuitor && oldNumeInlocuitor) {
        const existingInlocuitor = invitati.find(
          g => g.is_inlocuitor && g.member_id === memberId
        );
        if (existingInlocuitor) {
          await axios.delete(`${API_URL}/guests/${existingInlocuitor.id}`);
          setInvitati((prev) => prev.filter((g) => g.id !== existingInlocuitor.id));
          setTotalTaxaInvitati((prev) => prev - (existingInlocuitor.taxa || 0));
        }
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
    }
  }, [dateString, membri, invitati]);

  // Debounced version for text input (800ms delay)
  const debouncedSaveInlocuitor = useDebounce(saveAttendanceToAPI, 800);

  // Update local state immediately, debounce API call for text fields
  const handleNumeInlocuitorChange = (memberId, numeInlocuitor) => {
    const membru = membri.find(m => m.id === memberId);
    const oldNumeInlocuitor = pendingInlocuitorRef.current[memberId]?.old || membru?.nume_inlocuitor || '';
    
    // Store the original value for comparison
    if (!pendingInlocuitorRef.current[memberId]) {
      pendingInlocuitorRef.current[memberId] = { old: membru?.nume_inlocuitor || '' };
    }

    // Update UI immediately
    setMembri((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, nume_inlocuitor: numeInlocuitor } : m
      )
    );

    // Debounce API call
    debouncedSaveInlocuitor(memberId, membru?.prezent || false, membru?.taxa || 0, numeInlocuitor, oldNumeInlocuitor);
  };

  // Handle checkbox and taxa changes (immediate API call)
  const handleAttendanceChange = async (memberId, prezent, taxa) => {
    const membru = membri.find(m => m.id === memberId);
    const numeInlocuitor = membru?.nume_inlocuitor || '';

    // Update UI immediately
    setMembri((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, prezent, taxa } : m
      )
    );

    // Recalculate total
    setTotalTaxaMembri((prev) => {
      const oldTaxa = membru?.taxa || 0;
      return prev - oldTaxa + taxa;
    });

    // Save to API immediately for checkbox/taxa
    try {
      await axios.post(`${API_URL}/attendance/${dateString}`, {
        member_id: memberId,
        prezent,
        taxa,
        nume_inlocuitor: numeInlocuitor,
      });
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    try {
      const guestData = {
        ...newGuest,
        is_inlocuitor: false,
        member_id: null,
      };
      const response = await axios.post(`${API_URL}/guests?data=${dateString}`, guestData);
      setInvitati([...invitati, response.data]);
      setTotalTaxaInvitati((prev) => prev + newGuest.taxa);
      setNewGuest({ prenume: '', nume: '', companie: '', invitat_de: '', taxa: 0 });
    } catch (error) {
      console.error('Error adding guest:', error);
    }
  };

  const handleUpdateGuest = async (guestId, field, value) => {
    try {
      await axios.put(`${API_URL}/guests/${guestId}`, { [field]: value });
      setInvitati((prev) =>
        prev.map((g) => (g.id === guestId ? { ...g, [field]: value } : g))
      );
      if (field === 'taxa') {
        const newTotal = invitati.reduce((sum, g) => {
          if (g.id === guestId) return sum + value;
          return sum + g.taxa;
        }, 0);
        setTotalTaxaInvitati(newTotal);
      }
    } catch (error) {
      console.error('Error updating guest:', error);
    }
  };

  const handleDeleteGuest = async (guestId) => {
    try {
      const guest = invitati.find((g) => g.id === guestId);
      
      // If deleting an inlocuitor, also clear the nume_inlocuitor from the member
      if (guest?.is_inlocuitor && guest?.member_id) {
        await axios.post(`${API_URL}/attendance/${dateString}`, {
          member_id: guest.member_id,
          prezent: membri.find(m => m.id === guest.member_id)?.prezent || false,
          taxa: membri.find(m => m.id === guest.member_id)?.taxa || 0,
          nume_inlocuitor: '',
        });
        setMembri((prev) =>
          prev.map((m) =>
            m.id === guest.member_id ? { ...m, nume_inlocuitor: '' } : m
          )
        );
      }

      await axios.delete(`${API_URL}/guests/${guestId}`);
      setInvitati((prev) => prev.filter((g) => g.id !== guestId));
      setTotalTaxaInvitati((prev) => prev - (guest?.taxa || 0));
    } catch (error) {
      console.error('Error deleting guest:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = format(selectedDate, "EEEE, d MMMM yyyy", { locale: ro });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-[280px]' : 'w-[60px]'} h-screen bg-white border-r border-zinc-200 flex flex-col no-print transition-all duration-300 ease-in-out flex-shrink-0`}
      >
        <div className="p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-sm flex items-center justify-center flex-shrink-0">
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
          </div>
        </nav>

        <div className="p-2 border-t border-zinc-200 space-y-1 flex-shrink-0">
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
          <Button
            variant="ghost"
            className={`w-full ${sidebarOpen ? 'justify-start' : 'justify-center'} text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="toggle-sidebar"
            title={sidebarOpen ? 'Restrânge meniu' : 'Extinde meniu'}
          >
            {sidebarOpen ? (
              <>
                <PanelLeftClose className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                <span className="ml-2">Restrânge</span>
              </>
            ) : (
              <PanelLeft className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
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
                  modifiersStyles={{
                    hasData: {
                      position: 'relative'
                    }
                  }}
                  components={{
                    DayContent: ({ date, displayMonth, ...props }) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const hasData = datesWithData.includes(dateStr);
                      return (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <span>{date.getDate()}</span>
                          {hasData && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 border border-blue-500 rounded-full" />
                          )}
                        </div>
                      );
                    }
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
                      <TableHead className="w-16">Nr.</TableHead>
                      <TableHead>Prenume</TableHead>
                      <TableHead>Nume</TableHead>
                      <TableHead>Nume Înlocuitor</TableHead>
                      <TableHead className="w-24 text-center">Prezent</TableHead>
                      <TableHead className="w-32 text-right">Taxa (RON)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membri.map((membru, index) => (
                      <TableRow key={membru.id} data-testid={`membru-row-${membru.id}`}>
                        <TableCell className="font-medium tabular-nums">
                          {index + 1}
                        </TableCell>
                        <TableCell>{membru.prenume}</TableCell>
                        <TableCell>{membru.nume}</TableCell>
                        <TableCell>
                          <Input
                            value={membru.nume_inlocuitor || ''}
                            onChange={(e) => handleNumeInlocuitorChange(membru.id, e.target.value)}
                            placeholder="Prenume Nume"
                            className="table-input rounded-sm text-zinc-500"
                            data-testid={`inlocuitor-input-${membru.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={membru.prezent}
                            onCheckedChange={(checked) =>
                              handleAttendanceChange(membru.id, checked, membru.taxa)
                            }
                            className="attendance-checkbox"
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
                      </TableRow>
                    ))}
                    <TableRow className="total-row">
                      <TableCell colSpan={5} className="text-right font-bold">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums" data-testid="total-taxa-membri">
                        {totalTaxaMembri.toFixed(2)} RON
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
                    required
                    data-testid="guest-companie-input"
                  />
                  <Input
                    placeholder="Invitat de"
                    value={newGuest.invitat_de}
                    onChange={(e) => setNewGuest({ ...newGuest, invitat_de: e.target.value })}
                    className="rounded-sm"
                    required
                    data-testid="guest-invitat-input"
                  />
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
                      <TableHead className="w-16">Nr.</TableHead>
                      <TableHead>Prenume</TableHead>
                      <TableHead>Nume</TableHead>
                      <TableHead>Companie</TableHead>
                      <TableHead>Invitat de</TableHead>
                      <TableHead className="w-24 text-center">Înlocuitor</TableHead>
                      <TableHead className="w-32 text-right">Taxa (RON)</TableHead>
                      <TableHead className="w-16 no-print"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitati.map((invitat) => (
                      <TableRow 
                        key={invitat.id} 
                        data-testid={`invitat-row-${invitat.id}`}
                        className={invitat.is_inlocuitor ? 'bg-blue-50' : ''}
                      >
                        <TableCell className="font-medium tabular-nums">
                          {invitat.nr}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={invitat.prenume}
                            onChange={(e) =>
                              handleUpdateGuest(invitat.id, 'prenume', e.target.value)
                            }
                            className="table-input rounded-sm"
                            data-testid={`invitat-prenume-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={invitat.nume}
                            onChange={(e) =>
                              handleUpdateGuest(invitat.id, 'nume', e.target.value)
                            }
                            className="table-input rounded-sm"
                            data-testid={`invitat-nume-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={invitat.companie}
                            onChange={(e) =>
                              handleUpdateGuest(invitat.id, 'companie', e.target.value)
                            }
                            className="table-input rounded-sm"
                            data-testid={`invitat-companie-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={invitat.invitat_de}
                            onChange={(e) =>
                              handleUpdateGuest(invitat.id, 'invitat_de', e.target.value)
                            }
                            className={`table-input rounded-sm ${invitat.is_inlocuitor ? 'bg-blue-100' : ''}`}
                            readOnly={invitat.is_inlocuitor}
                            data-testid={`invitat-invitat-de-${invitat.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={invitat.is_inlocuitor || false}
                              disabled={true}
                              className="attendance-checkbox cursor-not-allowed"
                              data-testid={`inlocuitor-checkbox-${invitat.id}`}
                            />
                            {invitat.is_inlocuitor && (
                              <UserCheck className="w-4 h-4 ml-1 text-blue-600" strokeWidth={1.5} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={invitat.taxa}
                            onChange={(e) =>
                              handleUpdateGuest(
                                invitat.id,
                                'taxa',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="taxa-input table-input rounded-sm"
                            data-testid={`invitat-taxa-${invitat.id}`}
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
                      <TableCell colSpan={6} className="text-right font-bold">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums" data-testid="total-taxa-invitati">
                        {totalTaxaInvitati.toFixed(2)} RON
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
