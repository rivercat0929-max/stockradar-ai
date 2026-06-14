"use client";

import { useLanguage } from "@/components/language-provider";

export function Disclaimer({ compact = false, emphasized = false }: { compact?: boolean; emphasized?: boolean }) {
  const { t } = useLanguage();

  return (
    <div className={`${emphasized ? "border-loss bg-red-50" : "border-line bg-white"} rounded-lg border p-4 ${compact ? "text-xs" : "text-sm"} text-muted`}>
      {t("disclaimer")}
    </div>
  );
}
