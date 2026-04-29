import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const credDir = path.join(os.homedir(), ".insighta");
const credFile = path.join(credDir, "credentials.json");

export const API_URL =
  process.env.INSIGHTA_API_URL ||
  "https://insighta-labs-api-adeneey-dev178-dlpfhyah.leapcell.dev/api";

export const BASE_URL =
  process.env.INSIGHTA_BASE_URL ||
  "https://insighta-labs-api-adeneey-dev178-dlpfhyah.leapcell.dev";

export function saveCredentials(data: object) {
  if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true });
  fs.writeFileSync(credFile, JSON.stringify(data, null, 2));
}

export function loadCredentials(): any {
  if (!fs.existsSync(credFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(credFile, "utf-8"));
  } catch {
    return null;
  }
}

export function clearCredentials() {
  if (fs.existsSync(credFile)) fs.unlinkSync(credFile);
}
