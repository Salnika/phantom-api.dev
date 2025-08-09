import { useState, useEffect } from 'react';
import { DataTable } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useApiService } from '../hooks/useApiService';

interface SystemUser {
  id: string;
  email: string;
  roleId: string;
  createdAt: string;
  updatedAt: string;
}

interface SystemRole {
  id: string;
  name: string;
}

export function SystemUsers() {
  const apiService = useApiService();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiService.getSystemUsers();
      setUsers(response.data ?? []);
    } catch (error) {
      console.error('Failed to fetch system users:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiService.getSystemRoles();
      setRoles(response?.data ?? []);
    } catch (error) {
      console.error('Failed to fetch system roles:', error);
    }
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await apiService.updateSystemUser(editingUser.id, { email, password, roleId });
      } else {
        await apiService.createSystemUser({ email, password, roleId });
      }
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await apiService.deleteSystemUser(id);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setRoleId(user.roleId);
    setPassword(''); // Password should not be pre-filled for security
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setRoleId('');
  };

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'email', title: 'Email' },
    { key: 'roleId', title: 'Role' },
    {
      key: 'actions',
      title: 'Actions',
      cell: ({ row }: any) => (
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleEditUser(row.original)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(row.original.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">System Users</h1>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Button onClick={resetForm} className="mb-4">Add New User</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSaveUser}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DataTable columns={columns} data={users} />
    </div>
  );
}