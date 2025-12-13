import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Lock, Mail } from 'lucide-react';

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ email: '', password: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(loginData.email, loginData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Eroare la autentificare');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await register(registerData.email, registerData.password, registerData.name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Eroare la înregistrare');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-100">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 rounded-sm mb-4">
              <Users className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Membri & Invitați
            </h1>
            <p className="text-zinc-500">Gestionare prezență și taxe</p>
          </div>

          <Card className="border-zinc-200 shadow-sm rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Bine ai venit
              </CardTitle>
              <CardDescription>
                Conectează-te pentru a continua
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">
                    Utilizator
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                    <Input
                      id="login-email"
                      type="text"
                      placeholder="admin"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10 rounded-sm border-zinc-300 focus:ring-2 focus:ring-blue-500/20"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium">
                    Parolă
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pl-10 rounded-sm border-zinc-300 focus:ring-2 focus:ring-blue-500/20"
                      required
                      data-testid="login-password-input"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-red-500 text-sm" data-testid="login-error">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 rounded-sm"
                  disabled={isLoading}
                  data-testid="login-submit-button"
                >
                  {isLoading ? 'Se încarcă...' : 'Autentificare'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Side - Image */}
      <div
        className="hidden lg:block flex-1 login-bg"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1590235808792-673079562820?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwyfHxtaW5pbWFsaXN0JTIwYWJzdHJhY3QlMjB3aGl0ZSUyMG9mZmljZSUyMGFyY2hpdGVjdHVyZSUyMGdlb21ldHJ5fGVufDB8fHx8MTc2NTYxNzY4MHww&ixlib=rb-4.1.0&q=85')`,
        }}
      />
    </div>
  );
};

export default LoginPage;
