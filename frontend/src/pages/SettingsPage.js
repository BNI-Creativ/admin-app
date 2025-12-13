import React, { useState } from 'react';
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
  PanelLeftClose,
  PanelLeft,
  Key,
  Check,
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

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
              {sidebarOpen && <span>Schimbă Parola</span>}
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
        <div className="max-w-md mx-auto">
          <h1
            className="text-3xl font-bold tracking-tight text-zinc-900 mb-8"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Schimbă Parola
          </h1>

          <Card className="border-zinc-200 shadow-sm rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Key className="w-5 h-5" strokeWidth={1.5} />
                Parolă Nouă
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
