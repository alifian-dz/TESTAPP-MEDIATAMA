"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockIcon, MailIcon, VideoIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as {
        error?: string;
        redirectTo?: string;
        user?: { name: string; role: string };
      };

      if (!response.ok) {
        toast.error(
          data.error ||
            t("Email atau kata sandi tidak valid", "Invalid credentials")
        );
        setIsLoading(false);
        return;
      }

      toast.success(
        t(
          `Selamat datang kembali, ${data.user?.name || "Pengguna"}!`,
          `Welcome back, ${data.user?.name || "User"}!`
        )
      );
      router.push(data.redirectTo || "/");
      router.refresh();
    } catch {
      toast.error(
        t(
          "Gagal masuk. Silakan coba lagi.",
          "Failed to sign in. Please try again."
        )
      );
      setIsLoading(false);
    }
  }

  function fillDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <VideoIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mediatama Vault</h1>
          <p className="text-xs text-muted-foreground">
            {t(
              "Sistem Kontrol Akses Video Berbatas Waktu",
              "Time-Bound Video Access Control System"
            )}
          </p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {t("Masuk ke Sistem", "Sign in")}
          </CardTitle>
          <CardDescription>
            {t(
              "Masukkan kredensial akun Anda untuk mengakses portal. Akun Customer dibuat secara eksklusif oleh Administrator.",
              "Enter your account credentials to access the portal. Customers are provisioned exclusively by an Administrator."
            )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {t("Alamat Email", "Email Address")}
              </Label>
              <div className="relative">
                <MailIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@mediatama.test"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("Kata Sandi", "Password")}</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                leftIcon={<LockIcon className="size-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  {t("Sedang masuk...", "Signing in...")}
                </>
              ) : (
                t("Masuk", "Sign In")
              )}
            </Button>

            <div className="w-full rounded-lg border bg-muted/40 p-3 text-xs">
              <p className="mb-2 font-medium text-muted-foreground">
                {t("Akun Demo Cepat:", "Quick Demo Credentials:")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => fillDemo("admin@mediatama.test", "admin123")}
                >
                  {t("Akun Admin", "Admin Account")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    fillDemo("customer1@mediatama.test", "customer123")
                  }
                >
                  Customer 1
                </Button>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
