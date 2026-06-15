import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface EnvVars {
  [key: string]: string;
}

function parseEnvFile(filePath: string): EnvVars {
  const vars: EnvVars = {};
  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
      }
    }
  } catch {
    // file doesn't exist or can't be read
  }
  return vars;
}

export function getEnvVars(cwd?: string): EnvVars {
  const dir = cwd ?? process.cwd();
  const envFile = join(dir, ".env");
  const envLocalFile = join(dir, ".env.local");

  const env = parseEnvFile(envFile);
  const envLocal = parseEnvFile(envLocalFile);

  const merged: EnvVars = { ...env };
  for (const [key, value] of Object.entries(envLocal)) {
    merged[key] = value;
  }

  return merged;
}
