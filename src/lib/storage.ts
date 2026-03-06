import { Project, AppSettings } from "@/types";

const PROJECTS_KEY = "bb_testtool_projects";
const SETTINGS_KEY = "bb_testtool_settings";

// ─── Projects ────────────────────────────────────────────────────────────────

export function getProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function addProject(project: Omit<Project, "id" | "createdAt" | "updatedAt">): Project {
  const projects = getProjects();
  const now = new Date().toISOString();
  const newProject: Project = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  saveProjects([...projects, newProject]);
  return newProject;
}

export function updateProject(id: string, data: Partial<Omit<Project, "id" | "createdAt">>): void {
  const projects = getProjects();
  const updated = projects.map((p) =>
    p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
  );
  saveProjects(updated);
}

export function deleteProject(id: string): void {
  const projects = getProjects();
  saveProjects(projects.filter((p) => p.id !== id));
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return { databases: [], apiKeys: [] };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { databases: [], apiKeys: [] };
  } catch {
    return { databases: [], apiKeys: [] };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
