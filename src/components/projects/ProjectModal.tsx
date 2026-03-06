"use client";

import { useState, useEffect } from "react";
import { Project, ProjectStatus } from "@/types";
import { X, Plus, FolderPlus, Pencil } from "lucide-react";

interface ProjectModalProps {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSave: (data: Omit<Project, "id" | "createdAt" | "updatedAt">) => void;
}

const defaultForm = {
  name: "",
  description: "",
  status: "active" as ProjectStatus,
  tags: [] as string[],
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string; dot: string }[] = [
  { value: "active", label: "Active", dot: "bg-emerald-400" },
  { value: "inactive", label: "Inactive", dot: "bg-gray-300" },
  { value: "archived", label: "Archived", dot: "bg-amber-400" },
];

export default function ProjectModal({ open, project, onClose, onSave }: ProjectModalProps) {
  const [form, setForm] = useState(defaultForm);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description,
        status: project.status,
        tags: [...project.tags],
      });
    } else {
      setForm(defaultForm);
    }
    setTagInput("");
  }, [project, open]);

  if (!open) return null;

  function handleAddTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  }

  const isEdit = !!project;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl shadow-gray-900/20 animate-slide-up overflow-hidden">
        {/* Accent stripe */}
        <div className="h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isEdit ? "bg-blue-50" : "bg-blue-50"}`}>
            {isEdit ? (
              <Pencil className="w-4 h-4 text-blue-600" />
            ) : (
              <FolderPlus className="w-4 h-4 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold text-gray-900 leading-tight">
              {isEdit ? "Edit Project" : "New Project"}
            </h2>
            <p className="text-[11px] text-gray-400">
              {isEdit ? "Update project details" : "Fill in the details below"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="label">
              Project Name <span className="text-red-400 normal-case text-xs ml-1">required</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Payment API Testing"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none leading-relaxed"
              rows={3}
              placeholder="Brief description of the project..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Status — segmented control */}
          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium border transition-all duration-100 ${
                    form.status === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Add tag and press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddTag(); }
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="btn-secondary px-3 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {form.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200/70 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition-colors"
                  >
                    {tag}
                    <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              {isEdit ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
