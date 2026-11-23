"use client";

import { GlobeIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border bg-muted/60 p-0.5",
        className
      )}
      role="group"
      aria-label="Language switcher"
    >
      <GlobeIcon className="mx-1.5 size-3.5 text-muted-foreground" />
      <Button
        type="button"
        variant={lang === "id" ? "default" : "ghost"}
        size="xs"
        className="h-6 px-2 text-[11px] font-semibold"
        onClick={() => setLang("id")}
      >
        ID
      </Button>
      <Button
        type="button"
        variant={lang === "en" ? "default" : "ghost"}
        size="xs"
        className="h-6 px-2 text-[11px] font-semibold"
        onClick={() => setLang("en")}
      >
        EN
      </Button>
    </div>
  );
}
