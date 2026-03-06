export type ProjectStatus = "active" | "inactive" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type DBDriver = "postgresql" | "mysql" | "sqlite" | "mongodb" | "mssql";

export interface DatabaseConnection {
  id: string;
  name: string;
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
}

export interface AppSettings {
  databases: DatabaseConnection[];
  apiKeys: ApiKey[];
}
