import axios from "axios";
import * as http from "http";
import * as open from "open";
import * as crypto from "crypto";
import {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  API_URL,
} from "./config";

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function login() {
  const state = base64url(crypto.randomBytes(16));
  const code_verifier = base64url(crypto.randomBytes(32));
  const code_challenge = base64url(
    crypto.createHash("sha256").update(code_verifier).digest(),
  );

  const loginUrl = `${API_URL.replace("/api", "")}/auth/github?state=${state}&code_challenge=${code_challenge}&code_challenge_method=S256`;

  console.log("Opening GitHub login in your browser...");
  await (open as any)(loginUrl);

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, "http://localhost:9876");
      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const tokens = url.searchParams.get("tokens");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Login successful! You can close this tab.</h1>");
      server.close();

      if (tokens) {
        const parsed = JSON.parse(decodeURIComponent(tokens));
        saveCredentials(parsed);
        console.log(`\nLogged in as @${parsed.user.username}`);
        resolve();
      } else {
        reject(new Error("Login failed"));
      }
    });

    server.listen(9876, () => {
      console.log("Waiting for GitHub callback...");
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out"));
    }, 120000);
  });
}

export function logout() {
  clearCredentials();
  console.log("Logged out successfully");
}

export function whoami() {
  const creds = loadCredentials();
  if (!creds) {
    console.log("Not logged in");
    return;
  }
  console.log(`Logged in as @${creds.user.username} (${creds.user.role})`);
}

export async function getValidToken(): Promise<string> {
  const creds = loadCredentials();
  if (!creds) throw new Error("Not logged in. Run: insighta login");

  try {
    const res = await axios.post(
      `${API_URL.replace("/api", "")}/auth/refresh`,
      {
        refresh_token: creds.refresh_token,
      },
    );
    const updated = { ...creds, ...res.data };
    saveCredentials(updated);
    return updated.access_token;
  } catch {
    clearCredentials();
    throw new Error("Session expired. Run: insighta login");
  }
}
