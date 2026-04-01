import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Users,
  Key,
  CalendarDays,
  LogOut,
  Plus,
  Trash2,
  Settings,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TreasuryPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newEntry, setNewEntry] = useState({
    suma: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    explicatii: '',
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const [entriesRes, totalRes] = await Promise.all([
        axios.get(`${API_URL}/treasury`),
        axios.get(`${API_URL}/treasury/total`)
      ]);
      setEntries(entriesRes.data);
      setTotal(totalRes.data.total);
    } catch (error) {
      console.error('Error fetching treasury:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!newEntry.suma || !newEntry.data) return;
    
    try {
      const response = await axios.post(`${API_URL}/treasury`, {
        suma: parseFloat(newEntry.suma),
        data: newEntry.data,
        explicatii: newEntry.explicatii,
      });
      
      // Add new entry and re-sort by date descending
      const updatedEntries = [response.data, ...entries].sort((a, b) => 
        new Date(b.data) - new Date(a.data)
      );
      setEntries(updatedEntries);
      setTotal(prev => prev + parseFloat(newEntry.suma));
      setNewEntry({
        suma: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        explicatii: '',
      });
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

  const handleDeleteEntry = async (entryId, suma) => {
    try {
      await axios.delete(`${API_URL}/treasury/${entryId}`);
      setEntries(entries.filter(e => e.id !== entryId));
      setTotal(prev => prev - suma);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return format(date, 'd MMMM yyyy', { locale: ro });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-[280px]' : 'w-[60px]'} h-screen bg-white border-r border-zinc-200 flex flex-col transition-all duration-300 ease-in-out flex-shrink-0`}
      >
        <div className="p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 bg-zinc-900 rounded-sm flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-zinc-700 transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Restrânge meniu' : 'Extinde meniu'}
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
              className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"
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
              to="/treasury"
              className="sidebar-link active flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium"
              data-testid="nav-treasury"
              title="Trezorerie"
            >
              <Wallet className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Trezorerie</span>}
            </Link>
            <Link
              to="/settings"
              className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600"
              data-testid="nav-settings"
              title="Setări"
            >
              <Key className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Setări</span>}
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
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight text-zinc-900"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Trezorerie
              </h1>
              <p className="text-zinc-500 mt-1">Gestionează intrările și ieșirile financiare</p>
            </div>

            {/* Total */}
            <div className="bg-white border border-zinc-200 rounded-sm px-6 py-4 shadow-sm">
              <p className="text-sm text-zinc-500 mb-1">Total</p>
              <p className={`text-3xl font-bold tabular-nums ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {total.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
              </p>
            </div>
          </div>

          {/* Add Entry Form */}
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Adaugă intrare nouă
            </h2>
            <form onSubmit={handleAddEntry} className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="suma">Suma (RON)</Label>
                <Input
                  id="suma"
                  type="number"
                  step="0.01"
                  value={newEntry.suma}
                  onChange={(e) => setNewEntry({ ...newEntry, suma: e.target.value })}
                  className="rounded-sm w-32"
                  placeholder="0.00"
                  required
                  data-testid="treasury-suma-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={newEntry.data}
                  onChange={(e) => setNewEntry({ ...newEntry, data: e.target.value })}
                  className="rounded-sm w-40"
                  required
                  data-testid="treasury-data-input"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="explicatii">Explicații</Label>
                <Input
                  id="explicatii"
                  value={newEntry.explicatii}
                  onChange={(e) => setNewEntry({ ...newEntry, explicatii: e.target.value })}
                  className="rounded-sm"
                  placeholder="Descriere opțională"
                  data-testid="treasury-explicatii-input"
                />
              </div>
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="treasury-add-button">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Adaugă
              </Button>
            </form>
          </div>

          {/* Entries Table */}
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm">
            {loading ? (
              <div className="text-center py-12 text-zinc-500">Se încarcă...</div>
            ) : (
              <Table className="swiss-table" data-testid="treasury-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Data</TableHead>
                    <TableHead className="w-32 text-right">Suma</TableHead>
                    <TableHead>Explicații</TableHead>
                    <TableHead className="w-16 text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} data-testid={`treasury-row-${entry.id}`}>
                      <TableCell className="text-zinc-600">
                        {formatDate(entry.data)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${entry.suma >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.suma >= 0 ? '+' : ''}{entry.suma.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {entry.explicatii || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              data-testid={`delete-treasury-${entry.id}`}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
                                Șterge intrare
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Ești sigur că vrei să ștergi această intrare de{' '}
                                <strong>{entry.suma.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</strong>?
                                Această acțiune nu poate fi anulată.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-sm">Anulează</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteEntry(entry.id, entry.suma)}
                                className="bg-red-500 hover:bg-red-600 rounded-sm"
                              >
                                Șterge
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && entries.length === 0 && (
              <p className="text-center py-12 text-zinc-500">
                Nu există intrări în trezorerie. Adaugă prima intrare folosind formularul de mai sus.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TreasuryPage;
