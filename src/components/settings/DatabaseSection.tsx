"use client";

import { useState } from "react";
import { DatabaseConnection, DBDriver } from "@/types";
import {
  Plus, Trash2, Database, Eye, EyeOff, X,
  Pencil, Loader2, CheckCircle2, AlertCircle, Zap,
} from "lucide-react";

const DB_DRIVERS: { value: DBDriver; label: string; color: string }[] = [
  { value: "postgresql", label: "PostgreSQL", color: "text-blue-600 bg-blue-50" },
  { value: "mysql", label: "MySQL", color: "text-orange-600 bg-orange-50" },
  { value: "mssql", label: "SQL Server", color: "text-sky-600 bg-sky-50" },
  { value: "sqlite", label: "SQLite", color: "text-teal-600 bg-teal-50" },
  { value: "mongodb", label: "MongoDB", color: "text-green-600 bg-green-50" },
];

const DEFAULT_PORTS: Record<DBDriver, number> = {
  postgresql: 5432,
  mysql: 3306,
  mssql: 1433,
  sqlite: 0,
  mongodb: 27017,
};

type FormData = Omit<DatabaseConnection, "id" | "createdAt">;

const emptyForm = (): FormData => ({
  name: "",
  driver: "postgresql",
  host: "localhost",
  port: 5432,
  database: "",
  username: "",
  password: "",
});

interface TestStatus {
  loading: boolean;
  ok?: boolean;
  message?: string;
  latency?: number;
}

interface Props {
  databases: DatabaseConnection[];
  onChange: (databases: DatabaseConnection[]) => void;
}

export default function DatabaseSection({ databases, onChange }: Props) {
  const [form, setForm] = useState<FormData>(emptyForm());
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [rowTestStatus, setRowTestStatus] = useState<Record<string, TestStatus>>({});
  const [formTestStatus, setFormTestStatus] = useState<TestStatus | null>(null);

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setFormTestStatus(null);
    setFormOpen(true);
  }

  function openEdit(db: DatabaseConnection) {
    setForm({ name: db.name, driver: db.driver, host: db.host, port: db.port, database: db.database, username: db.username, password: db.password });
    setEditId(db.id);
    setFormTestStatus(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setFormTestStatus(null);
  }

  function handleDriverChange(driver: DBDriver) {
    setForm((f) => ({ ...f, driver, port: DEFAULT_PORTS[driver] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      onChange(databases.map((d) => d.id === editId ? { ...d, ...form } : d));
    } else {
      const newDb: DatabaseConnection = {
        ...form,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      onChange([...databases, newDb]);
    }
    closeForm();
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this database connection?")) return;
    onChange(databases.filter((d) => d.id !== id));
  }

  async function testConnection(payload: FormData, targetId?: string) {
    const setStatus = targetId
      ? (s: TestStatus) => setRowTestStatus((p) => ({ ...p, [targetId]: s }))
      : (s: TestStatus) => setFormTestStatus(s);

    setStatus({ loading: true });
    try {
      const res = await fetch("/api/db-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver: payload.driver,
          host: payload.host,
          port: payload.port,
          database: payload.database,
          username: payload.username,
          password: payload.password,
        }),
      });
      const json = await res.json();
      setStatus({ loading: false, ok: json.success, message: json.message, latency: json.latency });
    } catch (err) {
      setStatus({ loading: false, ok: false, message: err instanceof Error ? err.message : "Network error" });
    }
  }

  const driverInfo = (d: DBDriver) => DB_DRIVERS.find((x) => x.value === d)!;

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 ring-1 ring-blue-100 rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900">Database Connections</h2>
            <p className="text-[11px] text-gray-400">
              {databases.length} connection{databases.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        {formOpen ? (
          <button onClick={closeForm} className="btn-secondary text-xs h-8 px-3">
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        ) : (
          <button onClick={openAdd} className="btn-secondary text-xs h-8 px-3">
            <Plus className="w-3.5 h-3.5" />
            Add Connection
          </button>
        )}
      </div>

      {/* Form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-100 px-6 py-5 bg-slate-50/70 space-y-4 animate-slide-up"
        >
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            {editId ? "Edit Connection" : "New Connection"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Connection Name</label>
              <input
                className="input"
                placeholder="e.g. Production PostgreSQL"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Driver</label>
              <select
                className="input"
                value={form.driver}
                onChange={(e) => handleDriverChange(e.target.value as DBDriver)}
              >
                {DB_DRIVERS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {form.driver !== "sqlite" ? (
              <>
                <div>
                  <label className="label">Port</label>
                  <input
                    className="input"
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: +e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Host</label>
                  <input
                    className="input"
                    placeholder="localhost"
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Database</label>
                  <input
                    className="input"
                    placeholder="database_name"
                    value={form.database}
                    onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Username</label>
                  <input
                    className="input"
                    placeholder="username"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={showPasswords["__form__"] ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((p) => ({ ...p, __form__: !p.__form__ }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords["__form__"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="label">File Path</label>
                <input
                  className="input"
                  placeholder="./data.db"
                  value={form.database}
                  onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Test result in form */}
          {formTestStatus && !formTestStatus.loading && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${
              formTestStatus.ok
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {formTestStatus.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              <span>
                {formTestStatus.ok
                  ? `Connected successfully · ${formTestStatus.latency}ms`
                  : formTestStatus.message}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => testConnection(form)}
              disabled={formTestStatus?.loading}
              className="btn-secondary text-xs h-8 px-3"
            >
              {formTestStatus?.loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Zap className="w-3.5 h-3.5" />}
              Test Connection
            </button>
            <div className="flex-1" />
            <button type="button" onClick={closeForm} className="btn-secondary text-xs h-8 px-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs h-8 px-4">
              {editId ? "Update Connection" : "Save Connection"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {databases.length === 0 ? (
        <div className="border-t border-gray-50 px-6 py-10 text-center">
          <p className="text-[12px] text-gray-400">
            No connections yet. Click <strong className="text-gray-600">Add Connection</strong> to get started.
          </p>
        </div>
      ) : (
        <ul className="border-t border-gray-50 divide-y divide-gray-50">
          {databases.map((db) => {
            const info = driverInfo(db.driver);
            const test = rowTestStatus[db.id];
            return (
              <li key={db.id} className="px-6 py-4 hover:bg-slate-50/60 group transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${info.color}`}>
                      <Database className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-900">{db.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono truncate">
                        <span className="text-gray-500 font-sans font-medium">{info.label}</span>
                        {db.driver !== "sqlite" && ` · ${db.host}:${db.port}/${db.database}`}
                        {db.driver === "sqlite" && ` · ${db.database}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Test button */}
                    <button
                      onClick={() => testConnection(db, db.id)}
                      disabled={test?.loading}
                      title="Test connection"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {test?.loading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Zap className="w-3.5 h-3.5" />}
                      Test
                    </button>
                    {/* Eye toggle */}
                    <button
                      onClick={() => setShowPasswords((p) => ({ ...p, [db.id]: !p[db.id] }))}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Toggle password visibility"
                    >
                      {showPasswords[db.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(db)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Edit connection"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(db.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Test result badge */}
                {test && !test.loading && (
                  <div className={`mt-2 ml-11 flex items-center gap-1.5 text-[11px] ${
                    test.ok ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {test.ok
                      ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                      : <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                    <span>
                      {test.ok
                        ? `Connected · ${test.latency}ms`
                        : test.message}
                    </span>
                  </div>
                )}

                {/* Expanded password */}
                {showPasswords[db.id] && db.password && (
                  <p className="mt-1.5 ml-11 text-[11px] font-mono text-gray-400 truncate">
                    Password: {db.password}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
