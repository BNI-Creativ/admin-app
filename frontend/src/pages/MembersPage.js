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
  CalendarDays,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Settings,
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
  const [newMember, setNewMember] = useState({
    prenume: '',
    nume: '',
    nume_inlocuitor: '',
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

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/members`, newMember);
      setMembers([...members, response.data]);
      setNewMember({ prenume: '', nume: '', nume_inlocuitor: '' });
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
        nume_inlocuitor: editingMember.nume_inlocuitor,
      });
      setMembers(members.map((m) => (m.id === editingMember.id ? response.data : m)));
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
    <div className="flex min-h-screen bg-zinc-100">
      {/* Sidebar */}
      <aside className="sidebar bg-white border-r border-zinc-200 flex flex-col">
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
              className="sidebar-link flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium text-zinc-600"
              data-testid="nav-dashboard"
            >
              <CalendarDays className="w-4 h-4" strokeWidth={1.5} />
              Prezență
            </Link>
            <Link
              to="/members"
              className="sidebar-link active flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium"
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
                    <div className="space-y-2">
                      <Label htmlFor="nume_inlocuitor">Nume Înlocuitor (opțional)</Label>
                      <Input
                        id="nume_inlocuitor"
                        value={newMember.nume_inlocuitor}
                        onChange={(e) =>
                          setNewMember({ ...newMember, nume_inlocuitor: e.target.value })
                        }
                        className="rounded-sm"
                        data-testid="new-member-inlocuitor"
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
                    <TableHead>Nume Înlocuitor</TableHead>
                    <TableHead className="w-24 text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} data-testid={`member-row-${member.id}`}>
                      <TableCell className="font-medium tabular-nums">
                        {member.nr}
                      </TableCell>
                      <TableCell>{member.prenume}</TableCell>
                      <TableCell>{member.nume}</TableCell>
                      <TableCell className="text-zinc-500">
                        {member.nume_inlocuitor || '-'}
                      </TableCell>
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
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Editează Membru
            </DialogTitle>
            <DialogDescription>Modifică datele membrului</DialogDescription>
          </DialogHeader>
          {editingMember && (
            <form onSubmit={handleEditMember}>
              <div className="space-y-4 py-4">
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
                  <Label htmlFor="edit-nume_inlocuitor">Nume Înlocuitor (opțional)</Label>
                  <Input
                    id="edit-nume_inlocuitor"
                    value={editingMember.nume_inlocuitor || ''}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        nume_inlocuitor: e.target.value,
                      })
                    }
                    className="rounded-sm"
                    data-testid="edit-member-inlocuitor"
                  />
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
