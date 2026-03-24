"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Minus, Plus, Settings, X, CheckCircle, AlertCircle } from "lucide-react";

const PRODUCT = {
  name: "AI Avatar License - Basic",
  price: 49,
  currency: "USD",
  productId: "1",
  image: "/images/product.webp",
};

const API_URL = "https://test.buzzencer.com/api/transactions";
const API_KEY = "SIHq6003F80ER4HnfhKdIkPQZkmd8UuulabL5rTqJrXmrrd8YnAZOear7HWPtnGb";

type ApiStatus = "idle" | "loading" | "success" | "error";

interface TxConfig {
  id_origin: string;
  member_id: string;
  aff_id: string;
  api_key: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

/** Auto-dismiss toast after 4s */
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, addToast, removeToast };
}

export default function CheckoutSimulatorPage() {
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<ApiStatus>("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<TxConfig>({
    id_origin: "EXT-ORD-001",
    member_id: "MEM-USER-001",
    aff_id: "AFF-001",
    api_key: API_KEY,
  });
  const [draft, setDraft] = useState<TxConfig>(config);
  const { toasts, addToast, removeToast } = useToast();

  const openSettings = () => {
    setDraft(config);
    setShowSettings(true);
  };

  const saveSettings = () => {
    setConfig(draft);
    setShowSettings(false);
  };

  const handleBuy = async () => {
    setStatus("loading");
    try {
      const body = {
        id_origin: config.id_origin,
        member_id: config.member_id,
        aff_id: config.aff_id,
        products: [
          {
            product_id: PRODUCT.productId,
            qty,
            price: PRODUCT.price,
            currency: PRODUCT.currency,
          },
        ],
        transaction_date: new Date().toISOString(),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "X-API-KEY": config.api_key,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": "",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const msg = data?.message ?? (res.ok ? "Transaction created successfully" : "Request failed");
      addToast(res.ok ? "success" : "error", msg);
      setStatus(res.ok ? "success" : "error");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border animate-in fade-in slide-in-from-top-2 duration-300 ${
              t.type === "success"
                ? "bg-white border-green-200 text-green-800"
                : "bg-white border-red-200 text-red-700"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle size={16} className="text-green-500 shrink-0" />
              : <AlertCircle size={16} className="text-red-500 shrink-0" />
            }
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-2 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Settings button — top-right */}
      <button
        onClick={openSettings}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        title="Transaction Settings"
      >
        <Settings size={16} className="text-gray-600" />
      </button>

      {/* Settings panel overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowSettings(false)} />
          <div className="relative mt-14 mr-4 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Transaction Config</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {(["id_origin", "member_id", "aff_id", "api_key"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field}</label>
                  <input
                    type="text"
                    value={draft[field]}
                    onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={saveSettings}
              className="mt-4 w-full bg-black text-white text-sm py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="px-8 py-4 text-sm text-gray-500 flex items-center gap-1">
        <Link href="/" className="hover:underline">Home</Link>
        <ChevronRight size={14} />
        <span className="hover:underline cursor-pointer">Cat</span>
        <ChevronRight size={14} />
        <span className="truncate max-w-[300px]">{PRODUCT.name}</span>
      </div>

      {/* Main layout */}
      <div className="max-w-6xl mx-auto px-8 pb-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {/* Product Image */}
        <div className="relative aspect-[4/5] w-full rounded overflow-hidden bg-gray-100">
          <Image src={PRODUCT.image} alt={PRODUCT.name} fill className="object-cover" unoptimized />
        </div>

        {/* Product Info */}
        <div className="pt-4">
          <h1 className="text-2xl font-bold leading-snug mb-4">{PRODUCT.name}</h1>

          <p className="text-2xl font-semibold mb-1">${PRODUCT.price}</p>
          <p className="text-sm text-gray-500 mb-6">
            <span className="underline cursor-pointer">Shipping</span> calculated at checkout.
          </p>

          <hr className="border-gray-200 mb-6" />

          {/* Quantity + Buy */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center border border-gray-300 rounded-full px-3 py-2 gap-4">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-gray-600 hover:text-black">
                <Minus size={16} />
              </button>
              <span className="text-sm font-medium w-4 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="text-gray-600 hover:text-black">
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={handleBuy}
              disabled={status === "loading"}
              className="flex-1 bg-black text-white py-3 px-6 rounded font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {status === "loading" ? "Processing..." : "Buy"}
            </button>
          </div>

          {/* Share */}
          <div className="flex items-center gap-4 text-gray-500">
            <span className="text-sm font-medium text-gray-700">Share:</span>
            <button className="hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </button>
            <button className="hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </button>
            <button className="hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
            </button>
            <button className="hover:text-black transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.064-.022.134-.033.199-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .625.285.625.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
