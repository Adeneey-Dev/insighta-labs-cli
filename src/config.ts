import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const credDir = path.join(os.homedir(), ".insighta");
const credFile = path.join(credDir, "credentials.json");

export const API_URL =
  process.env.INSIGHTA_API_URL || "https://your-backend-url.leapcell.dev/api";

export function saveCredentials(data: object) {
  if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true });
  fs.writeFileSync(credFile, JSON.stringify(data, null, 2));
}

export function loadCredentials(): any {
  if (!fs.existsSync(credFile)) return null;
  return JSON.parse(fs.readFileSync(credFile, "utf-8"));
}

export function clearCredentials() {
  if (fs.existsSync(credFile)) fs.unlinkSync(credFile);
}
