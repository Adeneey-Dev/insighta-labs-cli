import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const credDir = path.join(os.homedir(), '.insighta');
const credFile = path.join(credDir, 'credentials.json');
console.log('Credential file path:', credFile); // for debugging

export const BASE_URL =
  process.env.INSIGHTA_API_URL ||
  'https://insighta-labs-api-adeneey-dev178-dlpfhyah.leapcell.dev';

export const API_URL = `${BASE_URL}/api`;

export function saveCredentials(data: object): void {
  try {
    if (!fs.existsSync(credDir)) {
      fs.mkdirSync(credDir, { recursive: true });
      console.log('Created directory:', credDir);
    }
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(credFile, content);
    console.log('✅ Credentials saved to:', credFile);
  } catch (err) {
    console.error('❌ Failed to save credentials:', err);
  }
}

export function loadCredentials(): any {
  if (!fs.existsSync(credFile)) {
    console.log('DEBUG: credFile not found:', credFile);
    return null;
  }
  try {
    const content = fs.readFileSync(credFile, 'utf-8');
    console.log('DEBUG: loaded credentials:', content);
    return JSON.parse(content);
  } catch (err) {
    console.error('DEBUG: parse error', err);
    return null;
  }
}

export function clearCredentials(): void {
  if (fs.existsSync(credFile)) {
    fs.unlinkSync(credFile);
  }
}