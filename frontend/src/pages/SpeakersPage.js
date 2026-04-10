import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  Key,
  CalendarDays,
  LogOut,
  Settings,
  Wallet,
  Mic2,
  Download,
  Upload,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SpeakersPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [speakers, setSpeakers] = useState([]);
  const [nextSpeakers, setNextSpeakers] = useState([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [speakersRes, nextRes] = await Promise.all([
        axios.get(`${API_URL}/speakers`),
        axios.get(`${API_URL}/speakers/next`),
      ]);
      setSpeakers(speakersRes.data);
      const nextRaw = nextRes.data.next_speakers || [];
      // Sort on load: by next_date ascending (default=today for empty), same slot order for ties
      const sorted = [...nextRaw].sort((a, b) => {
        const da = a.next_date || today;
        const db2 = b.next_date || today;
        if (da === db2) return a.slot - b.slot;
        return da.localeCompare(db2);
      });
      setNextSpeakers(sorted);
      setEligibleCount(nextRes.data.eligible_count || 0);
    } catch (error) {
      console.error('Error fetching speakers:', error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const handleNextDateChange = async (memberId, newDate) => {
    setNextSpeakers((prev) => {
      const updated = prev.map((s) => s.member_id === memberId ? { ...s, next_date: newDate } : s);
      return sortNextSpeakers(updated);
    });
    try {
      await axios.post(`${API_URL}/speakers/schedule/${memberId}`, { next_date: newDate });
    } catch (error) {
      console.error('Error saving next date:', error);
    }
  };

  const sortNextSpeakers = (list) =>
    [...list].sort((a, b) => {
      const da = a.next_date || today;
      const db2 = b.next_date || today;
      if (da === db2) return a.slot - b.slot;
      return da.localeCompare(db2);
    });

  const handleStatusCheck = async (speaker) => {
    const isChecked = !speaker.checked;
    const effectiveDate = speaker.next_date || today;

    // Optimistic UI update for checkbox
    setNextSpeakers((prev) =>
      prev.map((s) => s.member_id === speaker.member_id ? { ...s, checked: isChecked } : s)
    );

    try {
      await axios.post(`${API_URL}/speakers/schedule/${speaker.member_id}`, { checked: isChecked });

      // If checked AND date is today or past → move to Istoric
      if (isChecked && effectiveDate <= today) {
        await axios.post(`${API_URL}/speakers`, {
          prenume: speaker.prenume,
          nume: speaker.nume,
          data: effectiveDate,
          member_id: speaker.member_id,
        });
        // Clear schedule for this member
        await axios.post(`${API_URL}/speakers/schedule/${speaker.member_id}`, {
          next_date: '',
          checked: false,
        });
        // Refresh both tables
        await fetchAll();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`${API_URL}/speakers/export-csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vorbitori.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const response = await axios.post(`${API_URL}/speakers/import-csv`, {
        csv_content: text,
        replace: false,
      });
      alert(`Import reușit: ${response.data.imported} înregistrări importate.`);
      await fetchAll();
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Eroare la import CSV.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), 'd MMMM yyyy', { locale: ro });
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
            <Link to="/dashboard" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600" data-testid="nav-dashboard" title="Prezență">
              <CalendarDays className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Prezență</span>}
            </Link>
            <Link to="/members" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600" data-testid="nav-members" title="Administrare Membri">
              <Settings className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Administrare Membri</span>}
            </Link>
            <Link to="/speakers" className="sidebar-link active flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium" data-testid="nav-speakers" title="Administrare Vorbitori">
              <Mic2 className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Administrare Vorbitori</span>}
            </Link>
            <Link to="/treasury" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600" data-testid="nav-treasury" title="Trezorerie">
              <Wallet className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Trezorerie</span>}
            </Link>
            <Link to="/settings" className="sidebar-link flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium text-zinc-600" data-testid="nav-settings" title="Setări">
              <Key className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Setări</span>}
            </Link>
          </div>
        </nav>

        <div className="p-2 border-t border-zinc-200 space-y-1 flex-shrink-0">
          <Button variant="ghost" className={`w-full ${sidebarOpen ? 'justify-start' : 'justify-center'} text-zinc-600 hover:bg-zinc-100`} onClick={handleLogout} data-testid="logout-button" title="Deconectare">
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            {sidebarOpen && <span className="ml-2">Deconectare</span>}
          </Button>
          <Button variant="ghost" className={`w-full ${sidebarOpen ? 'justify-start' : 'justify-center'} text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600`} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? 'Restrânge meniu' : 'Extinde meniu'}>
            {sidebarOpen ? (
              <><PanelLeftClose className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /><span className="ml-2">Restrânge</span></>
            ) : (
              <PanelLeft className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Administrare Vorbitori
              </h1>
              <p className="text-zinc-500 mt-1">Istoric vorbitori și programare automată</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-sm border-zinc-300 text-sm" onClick={handleExportCSV} data-testid="export-csv-btn">
                <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Export CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportCSV}
                data-testid="import-csv-input"
              />
              <Button variant="outline" className="rounded-sm border-zinc-300 text-sm" onClick={() => fileInputRef.current?.click()} disabled={importing} data-testid="import-csv-btn">
                <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
                {importing ? 'Se importă...' : 'Import CSV'}
              </Button>
            </div>
          </div>

          {/* Add Speaker Form - REMOVED */}

          {/* Next 12 Speakers - Round Robin */}
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Următorii Vorbitori
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {eligibleCount} membri eligibili (activi, MSP valid, doresc prezentare)
                </p>
              </div>
              <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full font-medium">
                Următoarele 12 sesiuni
              </span>
            </div>
            {loading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Se încarcă...</div>
            ) : nextSpeakers.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">
                Niciun vorbitor eligibil. Verificați că membrii au Status Activ, MSP verde și „Dorește Prezentare" bifat.
              </div>
            ) : (
              <Table className="swiss-table" data-testid="next-speakers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Slot</TableHead>
                    <TableHead>Prenume</TableHead>
                    <TableHead>Nume</TableHead>
                    <TableHead>Ultima Prezentare</TableHead>
                    <TableHead className="w-44">Următoarea Prezentare</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nextSpeakers.map((s) => (
                    <TableRow key={`${s.slot}-${s.member_id}`} data-testid={`next-speaker-slot-${s.slot}`}>
                      <TableCell className="font-medium tabular-nums text-zinc-400">#{s.slot}</TableCell>
                      <TableCell className="font-medium">{s.prenume}</TableCell>
                      <TableCell>{s.nume}</TableCell>
                      <TableCell className="text-zinc-500 text-sm">
                        {s.last_date ? formatDate(s.last_date) : <span className="text-zinc-400 italic">Niciodată</span>}
                      </TableCell>
                      <TableCell>
                        <input
                          type="date"
                          min={today}
                          value={s.next_date || today}
                          onChange={(e) => handleNextDateChange(s.member_id, e.target.value)}
                          className="w-full rounded-sm border border-zinc-200 px-2 py-1 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          data-testid={`next-date-${s.member_id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={!!s.checked}
                          onChange={() => handleStatusCheck(s)}
                          className="w-4 h-4 accent-zinc-900 cursor-pointer"
                          data-testid={`status-check-${s.member_id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Speakers History */}
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm">
            <div className="p-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Istoric Vorbitori
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">{speakers.length} înregistrări</p>
            </div>
            {loading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Se încarcă...</div>
            ) : speakers.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">
                Nu există vorbitori în istoric. Importați din CSV.
              </div>
            ) : (
              <Table className="swiss-table" data-testid="speakers-history-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Nr.</TableHead>
                    <TableHead>Prenume</TableHead>
                    <TableHead>Nume</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {speakers.map((s, index) => (
                    <TableRow key={s.id} data-testid={`speaker-row-${s.id}`}>
                      <TableCell className="font-medium tabular-nums text-zinc-400">{index + 1}</TableCell>
                      <TableCell>{s.prenume}</TableCell>
                      <TableCell>{s.nume}</TableCell>
                      <TableCell className="text-zinc-600">{formatDate(s.data)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default SpeakersPage;
