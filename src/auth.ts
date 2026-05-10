import axios from 'axios';
import * as http from 'http';
import open from 'open';
import * as crypto from 'crypto';
import { saveCredentials, loadCredentials, clearCredentials, BASE_URL } from './config';

function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(32));
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64url(hash);
}

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv23liNrHooTdKD6rJl9';
const LOCAL_PORT = 9876;
const LOCAL_REDIRECT_URI = `http://localhost:${LOCAL_PORT}/callback`;

export async function login() {
  const state = base64url(crypto.randomBytes(16));
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.append('redirect_uri', LOCAL_REDIRECT_URI);
  githubAuthUrl.searchParams.append('response_type', 'code');
  githubAuthUrl.searchParams.append('scope', 'read:user');
  githubAuthUrl.searchParams.append('state', state);
  githubAuthUrl.searchParams.append('code_challenge', codeChallenge);
  githubAuthUrl.searchParams.append('code_challenge_method', 'S256');

  console.log('\n🔐 Opening GitHub login in your browser...');
  console.log('If browser does not open, visit:\n' + githubAuthUrl.toString() + '\n');

  try {
    await open(githubAuthUrl.toString());
  } catch {
    console.log('Could not open browser. Please visit the URL above manually.');
  }

  return new Promise<void>((resolve, reject) => {
    let resolved = false;

    const server = http.createServer(async (req, res) => {
      if (!req.url || req.url === '/favicon.ico') {
        res.end();
        return;
      }

      const url = new URL(req.url, LOCAL_REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.end();
        return;
      }

      const receivedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (error) {
        res.end(`<h1>❌ Login Failed</h1><p>${error}</p>`);
        reject(new Error(`GitHub OAuth error: ${error}`));
        server.close();
        return;
      }

      if (!code || receivedState !== state) {
        res.end('<h1>❌ Invalid state or missing code</h1>');
        reject(new Error('OAuth validation failed'));
        server.close();
        return;
      }

      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Insighta Labs+ CLI</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f1a;color:white;">
            <h1 style="color:#00d4aa">✅ Login Successful!</h1>
            <p>You can close this tab and return to the terminal.</p>
          </body>
        </html>
      `);

      try {
        const response = await axios.post(`${BASE_URL}/api/auth/cli/exchange`, {
          code,
          code_verifier: codeVerifier,
        });

        const data = response.data;
        if (data.status === 'success') {
          saveCredentials({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + 3 * 60 * 1000,
            user: data.user,
          });
          console.log(`\n✅ Logged in as @${data.user.username} (${data.user.role})\n`);
          resolve();
        } else {
          throw new Error(data.message || 'Exchange failed');
        }
      } catch (err: any) {
        console.error('\n❌ Authentication failed:', err.response?.data?.message || err.message);
        reject(err);
      } finally {
        server.close();
        resolved = true;
      }
    });

    server.listen(LOCAL_PORT, '127.0.0.1', () => {
      console.log(`⏳ Waiting for GitHub authorization... (callback on http://localhost:${LOCAL_PORT})`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${LOCAL_PORT} is busy. Close other terminals and try again.`));
      } else {
        reject(new Error(`Server error: ${err.message}`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        server.close();
        reject(new Error('\n⏰ Login timed out after 5 minutes. Please try again.'));
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
        headers: { Authorization: `Bearer ${creds.access_token}` },
      }
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

  if (creds.expires_at && Date.now() < creds.expires_at) {
    return creds.access_token;
  }

  try {
    const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refresh_token: creds.refresh_token,
    });
    const updated = {
      ...creds,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_at: Date.now() + 3 * 60 * 1000,
    };
    saveCredentials(updated);
    return updated.access_token;
  } catch {
    clearCredentials();
    throw new Error('\n⏰ Session expired. Run: insighta login\n');
  }
}