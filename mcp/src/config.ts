export interface Config {
  apiUrl: string;
  token: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiUrl = env.SPRINT_API_URL?.replace(/\/+$/, "");
  const token = env.SPRINT_API_TOKEN;
  if (!apiUrl) throw new Error("SPRINT_API_URL is required");
  if (!token) throw new Error("SPRINT_API_TOKEN is required");
  return { apiUrl, token };
}
