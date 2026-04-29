import axios from "axios";
import * as http from "http";
import open from "open";
import * as crypto from "crypto";
import {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  API_URL,
  BASE_URL,
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

  // CLI callback will be on localhost:9876
  const loginUrl = `${BASE_URL}/api/auth/github?state=${state}&code_challenge=${code_challenge}&code_challenge_method=S256&cli=true`;

  console.log("Opening GitHub login in your browser...");
  console.log("If browser does not open, visit:", loginUrl);

  await open(loginUrl);

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url || req.url === "/favicon.ico") return;

      const url = new URL(req.url, "http://localhost:9876");
      const tokens = url.searchParams.get("tokens");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>${error ? "Login Failed" : "Login Successful!"}</h1>
            <p>${error || "You can close this tab and return to the terminal."}</p>
          </body>
        </html>
      `);

      server.close();

      if (error) {
        reject(new Error(`Login failed: ${error}`));
        return;
      }

      if (tokens) {
        try {
          const parsed = JSON.parse(decodeURIComponent(tokens));
          saveCredentials(parsed);
          console.log(
            `\n Logged in as @${parsed.user.username} (${parsed.user.role})`,
          );
          resolve();
        } catch {
          reject(new Error("Failed to parse login response"));
        }
      } else {
        reject(new Error("No tokens received"));
      }
    });

    server.listen(9876, "127.0.0.1", () => {
      console.log("Waiting for GitHub callback on port 9876...");
    });

    server.on("error", (err) => {
      reject(new Error(`Server error: ${err.message}`));
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out after 2 minutes"));
    }, 120000);
  });
}

export function logout() {
  const creds = loadCredentials();
  if (!creds) {
    console.log("Already logged out");
    return;
  }

  // Try to invalidate server-side
  axios
    .post(
      `${BASE_URL}/api/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${creds.access_token}` } },
    )
    .catch(() => {});

  clearCredentials();
  console.log(" Logged out successfully");
}

export function whoami() {
  const creds = loadCredentials();
  if (!creds) {
    console.log("❌ Not logged in. Run: insighta login");
    return;
  }
  console.log(` Logged in as @${creds.user.username} (${creds.user.role})`);
  console.log(`   Email: ${creds.user.email || "not set"}`);
}

export async function getValidToken(): Promise<string> {
  const creds = loadCredentials();
  if (!creds) throw new Error("Not logged in. Run: insighta login");

  // Try to refresh the token
  try {
    const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refresh_token: creds.refresh_token,
    });
    const updated = {
      ...creds,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
    };
    saveCredentials(updated);
    return updated.access_token;
  } catch {
    clearCredentials();
    throw new Error("Session expired. Run: insighta login");
  }
}
