"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

export function LogoutButton({
  variant = "outline",
  className,
}: {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  className?: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success(t("Berhasil keluar dari sesi", "Signed out successfully"));
      router.push("/login");
      router.refresh();
    } catch {
      toast.error(t("Gagal keluar dari sesi", "Failed to sign out"));
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <Loader2Icon className="mr-1.5 size-4 animate-spin" />
      ) : (
        <LogOutIcon className="mr-1.5 size-4" />
      )}
      {t("Keluar", "Logout")}
    </Button>
  );
}
