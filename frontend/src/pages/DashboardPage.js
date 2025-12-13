import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  UserPlus,
  CalendarDays,
  LogOut,
  Printer,
  Plus,
  Trash2,
  Settings,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

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
  const [newGuest, setNewGuest] = useState({
    prenume: '',
    nume: '',
    companie: '',
    invitat_de: '',
    taxa: 0,
  });

  const dateString = format(selectedDate, 'yyyy-MM-dd');

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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAttendanceChange = async (memberId, prezent, taxa) => {
    try {
      await axios.post(`${API_URL}/attendance/${dateString}`, {
        member_id: memberId,
        prezent,
        taxa,
      });
      // Update local state
      setMembri((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, prezent, taxa } : m
        )
      );
      // Recalculate total
      const newTotal = membri.reduce((sum, m) => {
        if (m.id === memberId) return sum + taxa;
        return sum + m.taxa;
      }, 0);
      setTotalTaxaMembri(newTotal);
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/guests?data=${dateString}`, newGuest);
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
    <div className="flex min-h-screen bg-zinc-100">
      {/* Sidebar */}
      <aside className="sidebar bg-white border-r border-zinc-200 flex flex-col no-print">
        <div className="p-6 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-sm flex items-center justify-center">
              <Users className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="font-bold text-zinc-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Membri & Invitați
              </h1>
              <p className="text-xs text-zinc-500">{user?.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="sidebar-link active flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium"
              data-testid="nav-dashboard"
            >
              <CalendarDays className="w-4 h-4" strokeWidth={1.5} />
              Prezență
            </Link>
            <Link
              to="/members"
              className="sidebar-link flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium text-zinc-600"
              data-testid="nav-members"
            >
              <Settings className="w-4 h-4" strokeWidth={1.5} />
              Administrare Membri
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-200">
          <Button
            variant="ghost"
            className="w-full justify-start text-zinc-600 hover:bg-zinc-100"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Deconectare
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content p-8">
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
            <Tabs defaultValue="membri" className="w-full">
              <TabsList className="mb-6 rounded-sm no-print">
                <TabsTrigger value="membri" className="rounded-sm" data-testid="tab-membri">
                  Membri
                </TabsTrigger>
                <TabsTrigger value="invitati" className="rounded-sm" data-testid="tab-invitati">
                  Invitați
                </TabsTrigger>
              </TabsList>

              {/* Membri Table */}
              <TabsContent value="membri" className="animate-fade-in">
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
                    {membri.map((membru) => (
                      <TableRow key={membru.id} data-testid={`membru-row-${membru.id}`}>
                        <TableCell className="font-medium tabular-nums">
                          {membru.nr}
                        </TableCell>
                        <TableCell>{membru.prenume}</TableCell>
                        <TableCell>{membru.nume}</TableCell>
                        <TableCell className="text-zinc-500">
                          {membru.nume_inlocuitor || '-'}
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
              </TabsContent>

              {/* Invitați Table */}
              <TabsContent value="invitati" className="animate-fade-in">
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
                      <TableHead className="w-32 text-right">Taxa (RON)</TableHead>
                      <TableHead className="w-16 no-print"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitati.map((invitat) => (
                      <TableRow key={invitat.id} data-testid={`invitat-row-${invitat.id}`}>
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
                            className="table-input rounded-sm"
                            data-testid={`invitat-invitat-de-${invitat.id}`}
                          />
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
                      <TableCell colSpan={5} className="text-right font-bold">
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
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
