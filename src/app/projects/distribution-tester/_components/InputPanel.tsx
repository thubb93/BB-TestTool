"use client";

import { useState } from "react";
import { Play, Loader2, Trash2 } from "lucide-react";
import type { DatabaseConnection } from "@/types";

export interface VerifyRequest {
  postId: string;
  simulatedNow?: string;
  connection: DatabaseConnection;
}

interface Props {
  connections: DatabaseConnection[];
  loading: boolean;
  clearing: boolean;
  onVerify: (req: VerifyRequest) => void;
  onClear: (req: VerifyRequest) => void;
}

export default function InputPanel({ connections, loading, clearing, onVerify, onClear }: Props) {
  const [postId, setPostId] = useState("");
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [simulatedNow, setSimulatedNow] = useState("");

  function buildRequest(): VerifyRequest | null {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn || !postId.trim()) return null;
    return { postId: postId.trim(), simulatedNow: simulatedNow || undefined, connection: conn };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const req = buildRequest();
    if (req) onVerify(req);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h2 className="text-[13px] font-semibold text-gray-700">Verification Input</h2>

      <div>
        <label className="label">Post ID</label>
        <input
          className="input"
          placeholder="e.g. 96"
          value={postId}
          onChange={e => setPostId(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label">DB Connection</label>
        <select
          className="input"
          value={connectionId}
          onChange={e => setConnectionId(e.target.value)}
          required
        >
          {connections.length === 0 && <option value="">No connections configured</option>}
          {connections.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.driver})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">
          Simulated Now <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
        </label>
        <input
          type="datetime-local"
          className="input"
          value={simulatedNow}
          onChange={e => setSimulatedNow(e.target.value)}
        />
        <p className="text-[11px] text-gray-400 mt-1">Override current time for time-window checks</p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || clearing || !postId.trim() || !connectionId}
          className="btn-primary flex-1 justify-center"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? "Verifying..." : "Run Verification"}
        </button>

        <button
          type="button"
          disabled={loading || clearing || !postId.trim() || !connectionId}
          onClick={() => { const req = buildRequest(); if (req) onClear(req); }}
          className="btn border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
          title="Delete all user_influencer_post rows for this post"
        >
          {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
}
