"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, ShieldCheck, ShieldOff, Terminal, X, Gift, Package, Box } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import AddRequestModal, { NewRequestData } from "./_components/AddRequestModal";
import RequestPanel, { SavedRequest, TabResultState } from "./_components/RequestPanel";
import MysteryBoxTool from "./_components/MysteryBoxTool";
import CardOpenTool from "./_components/CardOpenTool";

const AUTH_STORAGE_KEY = "bb_auth_collection-card";
const REQUESTS_STORAGE_KEY = "bb_requests_collection-card";
const DEFAULT_TOKEN = "B679446EAE4CD95E93855226ADF89A56E91F62FF73F91EE98A47A172D355F226";
const MYSTERY_BOX_TAB = "__mystery-box__";
const CARD_PACK_TAB = "__card-pack__";
const CARD_BOX_TAB = "__card-box__";

const DEFAULT_REQUESTS: SavedRequest[] = [
  {
    id: "builtin-list-cards",
    name: "List Cards",
    parsed: {
      method: "GET",
      baseUrl: "http://uat-api-wallet.aiavatar.fun/collection-card/v1/list",
      params: {
        name: "SHENLONG",
        ratity: "",
        isNFT: "0",
        sortBy: "created_time",
        sortOrder: "desc",
        page: "1",
        pageSize: "10",
      },
      headers: {},
      body: "",
    },
  },
];

const FIXED_TABS = [
  { id: MYSTERY_BOX_TAB, label: "Mystery Box",   icon: Gift,    activeColor: "border-violet-500 text-violet-700", hoverColor: "hover:text-violet-600 hover:bg-violet-50" },
  { id: CARD_PACK_TAB,   label: "Card Pack ×5",  icon: Package, activeColor: "border-blue-500 text-blue-700",   hoverColor: "hover:text-blue-600 hover:bg-blue-50"   },
  { id: CARD_BOX_TAB,    label: "Card Box ×50",  icon: Box,     activeColor: "border-rose-500 text-rose-700",   hoverColor: "hover:text-rose-600 hover:bg-rose-50"   },
] as const;

export default function CollectionCardPage() {
  const [requests, setRequests] = useState<SavedRequest[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [tabResults, setTabResults] = useState<Record<string, TabResultState>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedRequests = localStorage.getItem(REQUESTS_STORAGE_KEY);
    const savedToken = localStorage.getItem(AUTH_STORAGE_KEY);

    let reqs: SavedRequest[];
    if (savedRequests) {
      reqs = JSON.parse(savedRequests);
    } else {
      reqs = DEFAULT_REQUESTS;
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(reqs));
    }

    setRequests(reqs);
    setActiveId(reqs[0]?.id ?? null);
    setAuthToken(savedToken ?? DEFAULT_TOKEN);
    setMounted(true);
  }, []);

  function saveRequests(reqs: SavedRequest[]) {
    setRequests(reqs);
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(reqs));
  }

  function handleSaveToken(token: string) {
    setAuthToken(token);
    localStorage.setItem(AUTH_STORAGE_KEY, token);
  }

  function handleAddRequest(data: NewRequestData) {
    const newRequest: SavedRequest = {
      id: `req-${Date.now()}`,
      name: data.name,
      parsed: data.parsed,
    };
    const updated = [...requests, newRequest];
    saveRequests(updated);
    setActiveId(newRequest.id);
    if (data.detectedToken && !authToken.trim()) {
      handleSaveToken(data.detectedToken);
    }
  }

  function handleDeleteRequest(id: string) {
    const updated = requests.filter((r) => r.id !== id);
    saveRequests(updated);
    if (activeId === id) {
      setActiveId(updated[updated.length - 1]?.id ?? null);
    }
  }

  const activeRequest = requests.find((r) => r.id === activeId) ?? null;
  const fixedActiveTab = FIXED_TABS.find((t) => t.id === activeId) ?? null;
  const hasToken = authToken.trim().length > 0;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="page-topbar">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Projects
            </Link>
            <span className="text-gray-200">/</span>
            <div className="min-w-0">
              <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">Collection Card</h1>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">
                NFT Wallet API · {requests.length} request{requests.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuthModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all duration-150 ${
                hasToken
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              }`}
            >
              {hasToken ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
              {hasToken ? "Authenticated" : "Add Auth"}
            </button>

            <div className="w-px h-5 bg-gray-200" />

            <button onClick={() => setAddModalOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Request
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-8 flex items-end gap-0 overflow-x-auto">
        {/* Dynamic request tabs */}
        {requests.map((req) => (
          <div
            key={req.id}
            className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer border-b-2 transition-colors flex-shrink-0 ${
              req.id === activeId
                ? "border-blue-500 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setActiveId(req.id)}
          >
            <Terminal className="w-3 h-3 flex-shrink-0 opacity-60" />
            <span className="text-[12px] font-medium max-w-[140px] truncate">{req.name}</span>
            {requests.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }}
                className="w-4 h-4 rounded flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {/* Fixed tool tabs */}
        {FIXED_TABS.map(({ id, label, icon: Icon, activeColor, hoverColor }) => (
          <div
            key={id}
            className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer border-b-2 transition-colors flex-shrink-0 ${
              activeId === id
                ? activeColor
                : `border-transparent text-gray-500 ${hoverColor}`
            }`}
            onClick={() => setActiveId(id)}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="text-[12px] font-medium">{label}</span>
          </div>
        ))}

        {/* Add new request */}
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[12px]">New</span>
        </button>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {/* Fixed tools — always mounted to preserve running state across tab switches */}
        <div className={activeId === MYSTERY_BOX_TAB ? "" : "hidden"}>
          <MysteryBoxTool authToken={authToken} />
        </div>
        <div className={activeId === CARD_PACK_TAB ? "" : "hidden"}>
          <CardOpenTool mode="pack" authToken={authToken} />
        </div>
        <div className={activeId === CARD_BOX_TAB ? "" : "hidden"}>
          <CardOpenTool mode="box" authToken={authToken} />
        </div>

        {/* Request panels — only shown when not on a fixed tab */}
        {!fixedActiveTab && (
          requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <div className="w-16 h-16 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-center mb-5">
                <Terminal className="w-7 h-7 text-gray-300" />
              </div>
              <h3 className="text-[15px] font-semibold text-gray-900 mb-2">No requests yet</h3>
              <p className="text-[13px] text-gray-400 max-w-xs leading-relaxed mb-6">
                Import a cURL command to start testing your API endpoints.
              </p>
              <button onClick={() => setAddModalOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add Request
              </button>
            </div>
          ) : activeRequest ? (
            <RequestPanel
              key={activeRequest.id}
              request={activeRequest}
              authToken={authToken}
              savedResult={tabResults[activeRequest.id]}
              onResultChange={(state) =>
                setTabResults((prev) => ({ ...prev, [activeRequest.id]: state }))
              }
            />
          ) : null
        )}
      </div>

      <AuthModal
        open={authModalOpen}
        token={authToken}
        onClose={() => setAuthModalOpen(false)}
        onSave={handleSaveToken}
      />

      <AddRequestModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddRequest}
      />
    </div>
  );
}
