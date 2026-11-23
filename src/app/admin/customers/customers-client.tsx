"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  SearchIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER";
  createdAt: string;
  updatedAt: string;
  _count: {
    accessRequests: number;
    videoPermissions: number;
  };
}

export function CustomersClient({
  initialCustomers,
}: {
  initialCustomers: CustomerRow[];
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  // Create Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Edit Dialog State
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Delete Dialog State
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerRow | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredCustomers = initialCustomers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

  function openEditDialog(customer: CustomerRow) {
    setEditCustomer(customer);
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditPassword("");
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t("Gagal membuat akun customer", "Failed to create customer")
        );
        setIsCreating(false);
        return;
      }

      toast.success(
        t("Akun customer berhasil dibuat", "Customer account created")
      );
      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat membuat customer",
          "Network error while creating customer"
        )
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editCustomer) return;
    setIsEditing(true);

    try {
      const response = await fetch(`/api/admin/customers/${editCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          password: editPassword || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t("Gagal memperbarui customer", "Failed to update customer")
        );
        setIsEditing(false);
        return;
      }

      toast.success(
        t("Customer berhasil diperbarui", "Customer updated successfully")
      );
      setEditCustomer(null);
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat memperbarui customer",
          "Network error while updating customer"
        )
      );
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteCustomer) return;
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/admin/customers/${deleteCustomer.id}`,
        {
          method: "DELETE",
        }
      );

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t("Gagal menghapus customer", "Failed to delete customer")
        );
        setIsDeleting(false);
        return;
      }

      toast.success(
        t(
          `Customer ${deleteCustomer.name} berhasil dihapus`,
          `Deleted customer ${deleteCustomer.name}`
        )
      );
      setDeleteCustomer(null);
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat menghapus customer",
          "Network error while deleting customer"
        )
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("Manajemen Customer", "Customer Management")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Buat dan kelola akun customer. Registrasi mandiri publik dinonaktifkan.",
              "Provision and manage customer accounts. Public self-registration is disabled."
            )}
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-1.5 size-4" />
          {t("Tambah Customer", "Add Customer")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {t("Daftar Customer", "Customers")} ({filteredCustomers.length})
              </CardTitle>
              <CardDescription>
                {t(
                  "Seluruh pengguna customer terdaftar beserta jumlah permintaan dan izin akses.",
                  "All registered customer users with access request and permission counts."
                )}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                placeholder={t(
                  "Cari nama atau email...",
                  "Search by name or email..."
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Nama Customer", "Customer")}</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>
                    {t("Request / Izin Akses", "Requests / Passes")}
                  </TableHead>
                  <TableHead>{t("Dibuat Pada", "Created")}</TableHead>
                  <TableHead className="text-right">
                    {t("Aksi", "Actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-muted-foreground"
                    >
                      {t("Tidak ada customer ditemukan.", "No customers found.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                            <UserIcon className="size-4 text-muted-foreground" />
                          </div>
                          <span>{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{customer.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer._count.accessRequests} req /{" "}
                        {customer._count.videoPermissions}{" "}
                        {t("izin", "passes")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(customer.createdAt).toLocaleDateString(
                          locale
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(customer)}
                          >
                            <PencilIcon className="mr-1 size-3.5" />
                            {t("Ubah", "Edit")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteCustomer(customer)}
                          >
                            <Trash2Icon className="mr-1 size-3.5" />
                            {t("Hapus", "Delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Customer Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("Buat Akun Customer", "Create Customer Account")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Tambahkan pengguna customer baru beserta kredensial login.",
                "Provision a new customer user with login credentials."
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">
                {t("Nama Lengkap", "Full Name")}
              </Label>
              <Input
                id="create-name"
                placeholder="Jane Doe"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">
                {t("Alamat Email", "Email Address")}
              </Label>
              <Input
                id="create-email"
                type="email"
                placeholder="customer@mediatama.test"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">
                {t("Kata Sandi Awal", "Initial Password")}
              </Label>
              <PasswordInput
                id="create-password"
                placeholder={t("Minimal 6 karakter", "Minimum 6 characters")}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t("Buat Customer", "Create Customer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog
        open={Boolean(editCustomer)}
        onOpenChange={(open) => !open && setEditCustomer(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Ubah Customer", "Edit Customer")}</DialogTitle>
            <DialogDescription>
              {t(
                "Perbarui informasi profil atau atur kata sandi baru untuk mereset akses.",
                "Update profile information or set a new password to reset access."
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                {t("Nama Lengkap", "Full Name")}
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">
                {t("Alamat Email", "Email Address")}
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">
                {t("Kata Sandi Baru", "New Password")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {t(
                    "(Kosongkan jika tidak diubah)",
                    "(Leave blank to keep existing)"
                  )}
                </span>
              </Label>
              <PasswordInput
                id="edit-password"
                placeholder={t(
                  "Reset kata sandi opsional",
                  "Optional password reset"
                )}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCustomer(null)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t("Simpan Perubahan", "Save Changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteCustomer)}
        onOpenChange={(open) => !open && setDeleteCustomer(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("Hapus Akun Customer (Soft Delete)", "Delete Customer Account (Soft Delete)")}
            </DialogTitle>
            <DialogDescription>
              {t(
                `Apakah Anda yakin ingin menonaktifkan / menghapus ${deleteCustomer?.name || ""} (${deleteCustomer?.email || ""})? Akun akan di-soft delete (deletedAt), seluruh izin akses aktif dicabut, dan histori data tetap tersimpan di database.`,
                `Are you sure you want to deactivate / soft-delete ${deleteCustomer?.name || ""} (${deleteCustomer?.email || ""})? The account will be marked deleted (deletedAt), active permissions will be revoked, and historical audit data will be preserved.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCustomer(null)}
            >
              {t("Batal", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              {t("Hapus Customer", "Delete Customer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
