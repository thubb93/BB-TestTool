"use client";

import { useState, useEffect } from "react";
import { getSettings } from "@/lib/storage";
import { ApiKey } from "@/types";
import { X, KeyRound, Eye, EyeOff, CheckCircle2, Trash2, ShieldCheck, ShieldOff } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  /** Current token value */
  token: string;
  onClose: () => void;
  /** Called when user clicks Save */
  onSave: (token: string) => void;
}

export default function AuthModal({ open, token, onClose, onSave }: AuthModalProps) {
  const [draft, setDraft] = useState(token);
  const [showToken, setShowToken] = useState(false);
  const [savedKeys, setSavedKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);

  // Load settings API keys + sync draft when opened
  useEffect(() => {
    if (open) {
      setDraft(token);
      setShowToken(false);
      setSelectedKeyId(null);
      const settings = getSettings();
      setSavedKeys(settings.apiKeys);
    }
  }, [open, token]);

  if (!open) return null;

  function handleUseKey(key: ApiKey) {
    setDraft(key.key);
    setSelectedKeyId(key.id);
    setShowToken(false);
  }

  function handleSave() {
    onSave(draft.trim());
    onClose();
  }

  function handleClear() {
    setDraft("");
    setSelectedKeyId(null);
  }

  const hasToken = draft.trim().length > 0;

  function maskToken(t: string) {
    if (!t) return "";
    if (t.length <= 12) return "•".repeat(t.length);
    return t.slice(0, 6) + " •••••••••••• " + t.slice(-4);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl shadow-gray-900/20 animate-scale-in overflow-hidden">
        {/* Accent stripe */}
        <div className={`h-[3px] ${hasToken ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-amber-400 to-orange-400"}`} />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasToken ? "bg-emerald-50" : "bg-amber-50"}`}>
            {hasToken
              ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
              : <ShieldOff className="w-4 h-4 text-amber-500" />
            }
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold text-gray-900 leading-tight">Authentication</h2>
            <p className="text-[11px] text-gray-400">
              {hasToken ? "Token is configured" : "No token set"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Token input */}
          <div>
            <label className="label">Bearer Token</label>
            <div className="relative">
              <input
                className="input pr-10 font-mono text-[12px] tracking-wider"
                type={showToken ? "text" : "password"}
                placeholder="Paste your access token here..."
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setSelectedKeyId(null); }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {/* Preview of masked token when hidden */}
            {!showToken && draft && (
              <p className="mt-1.5 text-[11px] text-gray-400 font-mono">
                {maskToken(draft)}
              </p>
            )}
          </div>

          {/* Saved API Keys */}
          {savedKeys.length > 0 && (
            <div>
              <label className="label">From Saved API Keys</label>
              <ul className="space-y-1.5">
                {savedKeys.map((k) => {
                  const selected = selectedKeyId === k.id;
                  return (
                    <li
                      key={k.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        selected
                          ? "border-blue-200 bg-blue-50 ring-2 ring-blue-500/15"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => handleUseKey(k)}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? "bg-blue-100" : "bg-gray-100"}`}>
                        <KeyRound className={`w-3.5 h-3.5 ${selected ? "text-blue-600" : "text-gray-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-medium truncate ${selected ? "text-blue-900" : "text-gray-700"}`}>
                          {k.name}
                        </p>
                        {k.description && (
                          <p className="text-[10px] text-gray-400 truncate">{k.description}</p>
                        )}
                      </div>
                      {selected
                        ? <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        : <span className="text-[11px] text-blue-500 font-medium flex-shrink-0 opacity-0 group-hover:opacity-100">Use</span>
                      }
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {savedKeys.length === 0 && (
            <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5">
              No API keys saved yet. Go to <strong className="text-gray-600">Settings → API Keys</strong> to add some.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={handleClear}
            disabled={!draft}
            className="btn-ghost px-3 py-2 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="btn-primary">
              <CheckCircle2 className="w-4 h-4" />
              Save Token
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
