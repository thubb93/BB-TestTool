"use client";

import { useState, useEffect } from "react";
import { AppSettings, DatabaseConnection } from "@/types";
import { getSettings, saveSettings } from "@/lib/storage";
import DatabaseSection from "@/components/settings/DatabaseSection";
import ApiKeySection from "@/components/settings/ApiKeySection";
import { Shield } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({ databases: [], apiKeys: [] });

  useEffect(() => {
    const current = getSettings();

    // Seed default DB from env if no databases configured yet
    if (current.databases.length === 0) {
      fetch("/api/default-db")
        .then((r) => r.json())
        .then((data) => {
          if (!data.configured) {
            setSettings(current);
            return;
          }
          const defaultDb: DatabaseConnection = {
            id: "env-default",
            name: data.name,
            driver: data.driver,
            host: data.host,
            port: data.port,
            database: data.database,
            username: data.username,
            password: data.password,
            createdAt: new Date().toISOString(),
          };
          const seeded = { ...current, databases: [defaultDb] };
          setSettings(seeded);
          saveSettings(seeded);
        })
        .catch(() => setSettings(current));
    } else {
      setSettings(current);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky top bar */}
      <div className="page-topbar">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">Settings</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">
              Connections, credentials, and configuration
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-5">
        {/* Security notice */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200/80 rounded-xl">
          <Shield className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 leading-relaxed">
            Settings are stored in your browser&apos;s <strong>localStorage</strong> and are not
            encrypted. Avoid saving production secrets on shared or public machines.
          </p>
        </div>

        {/* Sections */}
        <DatabaseSection
          databases={settings.databases}
          onChange={(databases) => {
            const updated = { ...settings, databases };
            setSettings(updated);
            saveSettings(updated);
          }}
        />
        <ApiKeySection
          apiKeys={settings.apiKeys}
          onChange={(apiKeys) => {
            const updated = { ...settings, apiKeys };
            setSettings(updated);
            saveSettings(updated);
          }}
        />
      </div>
    </div>
  );
}
