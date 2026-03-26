"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Upload, Plus } from "lucide-react";
import QeTestViewer from "./_components/qe-test-viewer";

interface QeFile { name: string; mtime: string; size: number; }

export default function TestcasePage() {
  const [files, setFiles] = useState<QeFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = () =>
    fetch("/api/qe-files")
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setFiles(data) : setFiles([]))
      .catch(() => setFiles([]));

  useEffect(() => { fetchFiles(); }, []);

  const loadFile = async (name: string) => {
    setSelected(name);
    setLoading(true);
    try {
      const text = await fetch(`/api/qe-file?name=${encodeURIComponent(name)}`).then(r => r.text());
      setContent(text);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter(f => f.name.endsWith(".md"));
    if (!picked.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      picked.forEach(f => form.append("files", f));
      const res = await fetch("/api/qe-upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.saved?.length) {
        await fetchFiles();
        // Auto-open first uploaded file
        loadFile(data.saved[0]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5]">
      {/* File list panel */}
      <aside className="w-60 flex-shrink-0 bg-[#1e2139] text-[#c9d1f0] flex flex-col overflow-hidden">
        <div className="px-4 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-sm font-bold text-[#a5b0ff]">🧪 QE Viewer</h2>
            {/* Import button */}
            <button onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Import .md file"
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-violet-600/80 hover:bg-violet-600 text-white transition-colors disabled:opacity-50">
              {uploading ? "…" : <><Plus size={10}/> Import</>}
            </button>
          </div>
          <p className="text-[10px] text-gray-500">Test Case Management</p>
          {/* Hidden file input — multiple .md files */}
          <input ref={fileInputRef} type="file" accept=".md" multiple className="hidden" onChange={handleUpload}/>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {files.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-gray-500 text-center">
              <Upload size={20} className="mx-auto mb-2 opacity-40"/>
              <p className="mb-1">No files yet.</p>
              <p>Click <span className="text-violet-400 font-medium">Import</span> to upload .md test case files.</p>
            </div>
          ) : (
            files.map(f => (
              <button key={f.name} onClick={() => loadFile(f.name)}
                className={`w-full text-left px-3 py-2 rounded-md mb-1 border-l-[3px] transition-colors ${
                  selected === f.name
                    ? "bg-white/10 border-l-violet-400"
                    : "border-l-transparent hover:bg-white/5"
                }`}>
                <div className="text-[12px] font-medium leading-snug break-words">{f.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{new Date(f.mtime).toLocaleDateString()}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : selected && content !== null ? (
          <QeTestViewer filename={selected} content={content} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <FileText size={52} strokeWidth={1.2}/>
            <p className="text-lg font-semibold text-gray-500">Select a test case file</p>
            <p className="text-sm">Choose a file from the sidebar to view test cases</p>
          </div>
        )}
      </div>
    </div>
  );
}
