"use client";

import { useState } from "react";
import { ApiKey } from "@/types";
import { Plus, Trash2, KeyRound, Eye, EyeOff, Copy, Check, X } from "lucide-react";

const emptyForm = (): Omit<ApiKey, "id" | "createdAt"> => ({
  name: "",
  key: "",
  description: "",
});

interface Props {
  apiKeys: ApiKey[];
  onChange: (keys: ApiKey[]) => void;
}

export default function ApiKeySection({ apiKeys, onChange }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const newKey: ApiKey = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    onChange([...apiKeys, newKey]);
    setForm(emptyForm());
    setAddOpen(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this API key?")) return;
    onChange(apiKeys.filter((k) => k.id !== id));
  }

  function handleCopy(id: string, key: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function maskKey(key: string) {
    if (key.length <= 8) return "••••••••••••";
    return key.slice(0, 6) + " •••••••• " + key.slice(-4);
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 ring-1 ring-amber-100 rounded-lg flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900">API Keys</h2>
            <p className="text-[11px] text-gray-400">
              {apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""} stored
            </p>
          </div>
        </div>
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="btn-secondary text-xs h-8 px-3"
        >
          {addOpen ? (
            <>
              <X className="w-3.5 h-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Add Key
            </>
          )}
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <form
          onSubmit={handleAdd}
          className="border-t border-gray-100 px-6 py-5 bg-slate-50/70 space-y-3 animate-slide-up"
        >
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New API Key</p>

          <div>
            <label className="label">Key Name</label>
            <input
              className="input"
              placeholder="e.g. OpenAI Production"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">API Key Value</label>
            <input
              className="input font-mono text-[12px] tracking-wider"
              placeholder="sk-..."
              required
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Description <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <input
              className="input"
              placeholder="What is this key used for?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary text-xs h-8 px-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs h-8 px-4">
              Save Key
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {apiKeys.length === 0 ? (
        <div className="border-t border-gray-50 px-6 py-10 text-center">
          <p className="text-[12px] text-gray-400">
            No API keys stored. Click <strong className="text-gray-600">Add Key</strong> to add one.
          </p>
        </div>
      ) : (
        <ul className="border-t border-gray-50 divide-y divide-gray-50">
          {apiKeys.map((k) => (
            <li key={k.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 group transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-gray-50 ring-1 ring-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{k.name}</p>
                  <p className="text-[11px] font-mono text-gray-400 truncate">
                    {visibleKeys[k.id] ? k.key : maskKey(k.key)}
                  </p>
                  {k.description && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{k.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setVisibleKeys((v) => ({ ...v, [k.id]: !v[k.id] }))}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title={visibleKeys[k.id] ? "Hide key" : "Show key"}
                >
                  {visibleKeys[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleCopy(k.id, k.key)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === k.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(k.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
