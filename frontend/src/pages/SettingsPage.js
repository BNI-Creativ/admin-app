import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Users,
  CalendarDays,
  LogOut,
  Settings,
  Key,
  Check,
  Download,
  Upload,
  AlertTriangle,
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [exportMessage, setExportMessage] = useState({ type: '', text: '' });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const fileInputRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'Parolele noi nu coincid' });
      return;
    }

    if (passwords.newPassword.length < 4) {
      setMessage({ type: 'error', text: 'Parola nouă trebuie să aibă minim 4 caractere' });
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/change-password`, {
        current_password: passwords.currentPassword,
        new_password: passwords.newPassword,
      });
      setMessage({ type: 'success', text: 'Parola a fost schimbată cu succes!' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Eroare la schimbarea parolei' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Export all data
  const handleExport = async () => {
    setExportMessage({ type: '', text: '' });
    setIsLoading(true);
    
    try {
      const response = await axios.get(`${API_URL}/export`);
      const data = response.data;
      
      // Create filename with date
      const date = new Date().toISOString().split('T')[0];
      const filename = `bni-prezenta-export-${date}.json`;
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportMessage({ 
        type: 'success', 
        text: `Export reușit! ${data.counts.members} membri, ${data.counts.attendance} prezențe, ${data.counts.guests} invitați` 
      });
    } catch (error) {
      setExportMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Eroare la export' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Import data from file
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Confirm before replacing all data
    const confirmed = window.confirm(
      '⚠️ ATENȚIE!\n\nImportul va ÎNLOCUI toate datele existente cu datele din fișier.\n\nDatele actuale vor fi șterse permanent.\n\nEști sigur că vrei să continui?'
    );
    
    if (!confirmed) {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setExportMessage({ type: '', text: '' });
    setIsLoading(true);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const response = await axios.post(`${API_URL}/import`, data);
      const results = response.data.results;
      const deleted = response.data.deleted;
      
      const summary = [
        `Membri: ${results.members.imported} importați`,
        `Prezențe: ${results.attendance.imported} importate`,
        `Invitați: ${results.guests.imported} importați`
      ].join(' | ');
      
      const deletedInfo = `(Șterse: ${deleted.members} membri, ${deleted.attendance} prezențe, ${deleted.guests} invitați)`;
      
      setExportMessage({ 
        type: 'success', 
        text: `Import reușit! ${summary} ${deletedInfo}` 
      });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setExportMessage({ type: 'error', text: 'Fișier JSON invalid' });
      } else {
        setExportMessage({ 
          type: 'error', 
          text: error.response?.data?.detail || 'Eroare la import' 
        });
      }
    } finally {
      setIsLoading(false);
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
              to="/settings"
              className="sidebar-link active flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium"
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
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1
            className="text-3xl font-bold tracking-tight text-zinc-900 mb-6"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Setări
          </h1>

          {/* Export/Import Card */}
          <Card className="border-zinc-200 shadow-sm rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Download className="w-5 h-5" strokeWidth={1.5} />
                Export / Import Date
              </CardTitle>
              <CardDescription>
                Exportă toate datele într-un fișier JSON sau importă date dintr-un fișier existent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  onClick={handleExport}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-sm"
                  disabled={isLoading}
                  data-testid="export-button"
                >
                  <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  {isLoading ? 'Se exportă...' : 'Exportă Date'}
                </Button>
                
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    ref={fileInputRef}
                    className="hidden"
                    id="import-file"
                    data-testid="import-file-input"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-green-600 hover:bg-green-700 rounded-sm"
                    disabled={isLoading}
                    data-testid="import-button"
                  >
                    <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
                    {isLoading ? 'Se importă...' : 'Importă Date'}
                  </Button>
                </div>
              </div>

              {exportMessage.text && (
                <div
                  className={`p-3 rounded-sm text-sm ${
                    exportMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                  data-testid="export-message"
                >
                  {exportMessage.type === 'success' && (
                    <Check className="w-4 h-4 inline mr-2" strokeWidth={1.5} />
                  )}
                  {exportMessage.type === 'error' && (
                    <AlertTriangle className="w-4 h-4 inline mr-2" strokeWidth={1.5} />
                  )}
                  {exportMessage.text}
                </div>
              )}

              <div className="text-xs text-zinc-500 space-y-1">
                <p>• Exportul include: membri, prezențe și invitați</p>
                <p>• Formatul JSON este versionat pentru compatibilitate în viitor</p>
                <p>• La import, datele existente vor fi actualizate, cele noi vor fi adăugate</p>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="border-zinc-200 shadow-sm rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Key className="w-5 h-5" strokeWidth={1.5} />
                Schimbă Parola
              </CardTitle>
              <CardDescription>
                Completează formularul pentru a schimba parola
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Parola Curentă</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                    className="rounded-sm"
                    required
                    data-testid="current-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Parola Nouă</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    className="rounded-sm"
                    required
                    data-testid="new-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmă Parola Nouă</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    className="rounded-sm"
                    required
                    data-testid="confirm-password-input"
                  />
                </div>

                {message.text && (
                  <div
                    className={`p-3 rounded-sm text-sm ${
                      message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                    data-testid="message"
                  >
                    {message.type === 'success' && (
                      <Check className="w-4 h-4 inline mr-2" strokeWidth={1.5} />
                    )}
                    {message.text}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 rounded-sm"
                  disabled={isLoading}
                  data-testid="change-password-button"
                >
                  {isLoading ? 'Se salvează...' : 'Schimbă Parola'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
