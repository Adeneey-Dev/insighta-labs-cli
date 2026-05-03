import axios from 'axios';
import * as http from 'http';
import open from 'open';
import * as crypto from 'crypto';
import {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  BASE_URL,
} from './config';

function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function login() {
  const randomPart = base64url(crypto.randomBytes(16));
  const state = `cli_${randomPart}`;
  const code_verifier = base64url(crypto.randomBytes(32));
  const code_challenge = base64url(
    crypto.createHash('sha256').update(code_verifier).digest(),
  );

  // This URL goes to backend which redirects to GitHub
  // GitHub callback comes back to backend which redirects to localhost:9876
  const loginUrl =
    `${BASE_URL}/api/auth/github` +
    `?state=${state}` +
    `&code_challenge=${code_challenge}` +
    `&code_challenge_method=S256`;

  console.log('\n🔐 Opening GitHub login in your browser...');
  console.log(
    'If browser does not open, visit:\n' + loginUrl + '\n',
  );

  try {
    await open(loginUrl);
  } catch {
    console.log(
      'Could not open browser. Please visit the URL above manually.',
    );
  }

  // Start local server to catch the redirect from backend
  return new Promise<void>((resolve, reject) => {
    let resolved = false;

    const server = http.createServer(async (req, res) => {
      if (!req.url || req.url === '/favicon.ico') {
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://localhost:9876');
      const tokens = url.searchParams.get('tokens');
      const error = url.searchParams.get('error');

      // Send success page to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Insighta Labs+ CLI</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f1a;color:white;">
            <h1 style="color:${error ? '#ff4444' : '#00d4aa'}">
              ${error ? '❌ Login Failed' : '✅ Login Successful!'}
            </h1>
            <p>${error || 'You can close this tab and return to the terminal.'}</p>
          </body>
        </html>
      `);

      if (resolved) return;
      resolved = true;
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
            `\n✅ Logged in as @${parsed.user.username} (${parsed.user.role})\n`,
          );
          resolve();
        } catch {
          reject(new Error('Failed to parse login response'));
        }
      } else {
        reject(new Error('No tokens received'));
      }
    });

    server.listen(9876, '127.0.0.1', () => {
      console.log('⏳ Waiting for GitHub authorization...\n');
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            'Port 9876 is busy. Close other terminal instances and try again.',
          ),
        );
      } else {
        reject(new Error(`Server error: ${err.message}`));
      }
    });

    // 5 minute timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        reject(
          new Error(
            '\n⏰ Login timed out after 5 minutes. Please try again.',
          ),
        );
      }
    }, 5 * 60 * 1000);
  });
}

export async function logout() {
  const creds = loadCredentials();
  if (!creds) {
    console.log('Already logged out');
    return;
  }

  try {
    await axios.post(
      `${BASE_URL}/api/auth/logout`,
      {},
      {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
        },
      },
    );
  } catch {
    // ignore server errors on logout
  }

  clearCredentials();
  console.log('\n✅ Logged out successfully\n');
}

export async function whoami() {
  const creds = loadCredentials();
  if (!creds) {
    console.log('\n❌ Not logged in. Run: insighta login\n');
    return;
  }

  try {
    const token = await getValidToken();
    const res = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = res.data.data;
    console.log(`\n✅ Logged in as @${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email: ${user.email || 'not provided'}\n`);
  } catch {
    console.log('\n❌ Not logged in. Run: insighta login\n');
  }
}

export async function getValidToken(): Promise<string> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run: insighta login');
  }

  // Try to use existing access token first
  // If it fails, refresh it
  try {
    const res = await axios.post(
      `${BASE_URL}/api/auth/refresh`,
      { refresh_token: creds.refresh_token },
    );
    const updated = {
      ...creds,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
    };
    saveCredentials(updated);
    return updated.access_token;
  } catch {
    clearCredentials();
    throw new Error(
      '\n⏰ Session expired. Run: insighta login\n',
    );
  }
}