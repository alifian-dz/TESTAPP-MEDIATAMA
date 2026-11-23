"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  leftIcon?: React.ReactNode;
}

export function PasswordInput({
  className,
  leftIcon,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const { t } = useLanguage();

  return (
    <div className="relative">
      {leftIcon && (
        <div className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground">
          {leftIcon}
        </div>
      )}
      <Input
        {...props}
        type={showPassword ? "text" : "password"}
        className={cn(leftIcon ? "pl-9" : "", "pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          showPassword
            ? t("Sembunyikan kata sandi", "Hide password")
            : t("Tampilkan kata sandi", "Show password")
        }
        title={
          showPassword
            ? t("Sembunyikan kata sandi", "Hide password")
            : t("Tampilkan kata sandi", "Show password")
        }
      >
        {showPassword ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
}
