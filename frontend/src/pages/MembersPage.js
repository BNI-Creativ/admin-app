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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
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
  Pencil,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Wallet,
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MembersPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newMember, setNewMember] = useState({
    prenume: '',
    nume: '',
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/members`);
      setMembers(response.data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const sortMembers = (membersList) => {
    return [...membersList].sort((a, b) => {
      const prenumeCompare = a.prenume.localeCompare(b.prenume, 'ro');
      if (prenumeCompare !== 0) return prenumeCompare;
      return a.nume.localeCompare(b.nume, 'ro');
    });
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/members`, newMember);
      setMembers(sortMembers([...members, response.data]));
      setNewMember({ prenume: '', nume: '' });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleEditMember = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      const response = await axios.put(`${API_URL}/members/${editingMember.id}`, {
        prenume: editingMember.prenume,
        nume: editingMember.nume,
        telefon: editingMember.telefon || '',
        email: editingMember.email || '',
        companie: editingMember.companie || '',
        domeniu: editingMember.domeniu || '',
        website: editingMember.website || '',
        instagram: editingMember.instagram || '',
        tiktok: editingMember.tiktok || '',
        strada: editingMember.strada || '',
        oras: editingMember.oras || '',
        judet: editingMember.judet || '',
        cod_postal: editingMember.cod_postal || '',
        tara: editingMember.tara || '',
      });
      const updatedMembers = members.map((m) => (m.id === editingMember.id ? response.data : m));
      setMembers(sortMembers(updatedMembers));
      setEditingMember(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const handleDeleteMember = async (memberId) => {
    try {
      await axios.delete(`${API_URL}/members/${memberId}`);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (error) {
      console.error('Error deleting member:', error);
    }
  };

  const openEditDialog = (member) => {
    setEditingMember({ ...member });
    setIsEditDialogOpen(true);
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
              className="sidebar-link active flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium"
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
              title="Setări"
            >
              <Key className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Setări</span>}
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight text-zinc-900"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Administrare Membri
              </h1>
              <p className="text-zinc-500 mt-1">Adaugă, editează sau șterge membri</p>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-zinc-900 hover:bg-zinc-800 rounded-sm"
                  data-testid="add-member-button"
                >
                  <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Adaugă Membru
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-sm">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Adaugă Membru Nou
                  </DialogTitle>
                  <DialogDescription>
                    Completează datele pentru noul membru
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddMember}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="prenume">Prenume</Label>
                      <Input
                        id="prenume"
                        value={newMember.prenume}
                        onChange={(e) =>
                          setNewMember({ ...newMember, prenume: e.target.value })
                        }
                        className="rounded-sm"
                        required
                        data-testid="new-member-prenume"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nume">Nume</Label>
                      <Input
                        id="nume"
                        value={newMember.nume}
                        onChange={(e) =>
                          setNewMember({ ...newMember, nume: e.target.value })
                        }
                        className="rounded-sm"
                        required
                        data-testid="new-member-nume"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      className="rounded-sm"
                    >
                      Anulează
                    </Button>
                    <Button
                      type="submit"
                      className="bg-zinc-900 hover:bg-zinc-800 rounded-sm"
                      data-testid="save-new-member"
                    >
                      Salvează
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Members Table */}
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm">
            {loading ? (
              <div className="text-center py-12 text-zinc-500">Se încarcă...</div>
            ) : (
              <Table className="swiss-table" data-testid="members-management-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Nr.</TableHead>
                    <TableHead>Prenume</TableHead>
                    <TableHead>Nume</TableHead>
                    <TableHead className="w-24 text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member, index) => (
                    <TableRow key={member.id} data-testid={`member-row-${member.id}`}>
                      <TableCell className="font-medium tabular-nums">
                        {index + 1}
                      </TableCell>
                      <TableCell>{member.prenume}</TableCell>
                      <TableCell>{member.nume}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(member)}
                            className="text-zinc-600 hover:text-zinc-900"
                            data-testid={`edit-member-${member.id}`}
                          >
                            <Pencil className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                data-testid={`delete-member-${member.id}`}
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
                                  Șterge membru
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ești sigur că vrei să ștergi membrul{' '}
                                  <strong>
                                    {member.prenume} {member.nume}
                                  </strong>
                                  ? Această acțiune nu poate fi anulată.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-sm">
                                  Anulează
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteMember(member.id)}
                                  className="bg-red-500 hover:bg-red-600 rounded-sm"
                                  data-testid={`confirm-delete-${member.id}`}
                                >
                                  Șterge
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && members.length === 0 && (
              <p className="text-center py-12 text-zinc-500">
                Nu există membri. Adaugă primul membru folosind butonul de mai sus.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Editează Membru
            </DialogTitle>
            <DialogDescription>Modifică datele membrului</DialogDescription>
          </DialogHeader>
          {editingMember && (
            <form onSubmit={handleEditMember}>
              <div className="space-y-6 py-4">
                {/* Date personale */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Date personale</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-prenume">Prenume</Label>
                      <Input
                        id="edit-prenume"
                        value={editingMember.prenume}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, prenume: e.target.value })
                        }
                        className="rounded-sm"
                        required
                        data-testid="edit-member-prenume"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-nume">Nume</Label>
                      <Input
                        id="edit-nume"
                        value={editingMember.nume}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, nume: e.target.value })
                        }
                        className="rounded-sm"
                        required
                        data-testid="edit-member-nume"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-telefon">Telefon</Label>
                      <Input
                        id="edit-telefon"
                        value={editingMember.telefon || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, telefon: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="0722 123 456"
                        data-testid="edit-member-telefon"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editingMember.email || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, email: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="email@exemplu.ro"
                        data-testid="edit-member-email"
                      />
                    </div>
                  </div>
                </div>

                {/* Date profesionale */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Date profesionale</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-companie">Companie</Label>
                      <Input
                        id="edit-companie"
                        value={editingMember.companie || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, companie: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="Numele companiei"
                        data-testid="edit-member-companie"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-domeniu">Domeniu</Label>
                      <Input
                        id="edit-domeniu"
                        value={editingMember.domeniu || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, domeniu: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="Ex: IT, Construcții, Marketing"
                        data-testid="edit-member-domeniu"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="edit-website">Website</Label>
                      <Input
                        id="edit-website"
                        value={editingMember.website || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, website: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="https://www.exemplu.ro"
                        data-testid="edit-member-website"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Social Media</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-instagram">Instagram (URL)</Label>
                      <Input
                        id="edit-instagram"
                        value={editingMember.instagram || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, instagram: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="https://instagram.com/username"
                        data-testid="edit-member-instagram"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-tiktok">TikTok (URL)</Label>
                      <Input
                        id="edit-tiktok"
                        value={editingMember.tiktok || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, tiktok: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="https://tiktok.com/@username"
                        data-testid="edit-member-tiktok"
                      />
                    </div>
                  </div>
                </div>

                {/* Adresă */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Adresă</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="edit-strada">Strada</Label>
                      <Input
                        id="edit-strada"
                        value={editingMember.strada || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, strada: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="Str. Exemplu, Nr. 10"
                        data-testid="edit-member-strada"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-oras">Oraș</Label>
                      <Input
                        id="edit-oras"
                        value={editingMember.oras || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, oras: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="București"
                        data-testid="edit-member-oras"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-judet">Județ</Label>
                      <Input
                        id="edit-judet"
                        value={editingMember.judet || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, judet: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="Ilfov"
                        data-testid="edit-member-judet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-cod-postal">Cod Poștal</Label>
                      <Input
                        id="edit-cod-postal"
                        value={editingMember.cod_postal || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, cod_postal: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="012345"
                        data-testid="edit-member-cod-postal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-tara">Țara</Label>
                      <Input
                        id="edit-tara"
                        value={editingMember.tara || ''}
                        onChange={(e) =>
                          setEditingMember({ ...editingMember, tara: e.target.value })
                        }
                        className="rounded-sm"
                        placeholder="România"
                        data-testid="edit-member-tara"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="rounded-sm"
                >
                  Anulează
                </Button>
                <Button
                  type="submit"
                  className="bg-zinc-900 hover:bg-zinc-800 rounded-sm"
                  data-testid="save-edit-member"
                >
                  Salvează
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembersPage;
