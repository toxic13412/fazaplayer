/**
 * VioletTunes Discord Bridge v1.0.0
 * Connects VioletTunes backend to Discord Rich Presence via local IPC.
 *
 * Usage:
 *   node index.js --token=<SESSION_TOKEN> [--backend=<WS_URL>]
 *
 * Arguments:
 *   --token=<TOKEN>    Session token from VioletTunes settings (required)
 *   --backend=<URL>    Backend WebSocket URL (default: wss://violettunes-backend.onrender.com)
 */

// --- Imports ---
const DiscordRPC = require('discord-rpc');
const WebSocket = require('ws');

// --- Argument parsing ---
const args = process.argv.slice(2);

function getArg(name) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const token = getArg('token');
const backendUrl = getArg('backend') || 'wss://violettunes-backend.onrender.com';

// --- Validate required args ---
if (!token) {
  console.log('VioletTunes Discord Bridge v1.0.0');
  console.log('');
  console.log('Usage:');
  console.log('  node index.js --token=<SESSION_TOKEN> [--backend=<WS_URL>]');
  console.log('');
  console.log('  --token    Your Session Token from VioletTunes settings (required)');
  console.log('  --backend  Backend WebSocket URL (optional)');
  console.log('             Default: wss://violettunes-backend.onrender.com');
  console.log('');
  console.log('Example:');
  console.log('  node index.js --token=abc12345');
  process.exit(1);
}

// --- Startup banner ---
const maskedToken = token.slice(0, 4) + '****';
console.log('VioletTunes Discord Bridge v1.0.0');
console.log(`Token: ${maskedToken}`);
console.log(`Backend: ${backendUrl}`);

// --- State variables ---
let rpcClient = null;
let wsClient = null;
let reconnectAttempt = 0;

// --- Task 2.2: getReconnectDelay ---

/**
 * Returns exponential backoff delay for reconnect attempts.
 * @param {number} attempt - Attempt number (1-based)
 * @returns {number} Delay in milliseconds (2000–60000)
 */
function getReconnectDelay(attempt) {
  return Math.min(2000 * Math.pow(2, attempt - 1), 60000);
}

// --- Task 2.5: setActivity (pure function) ---

/**
 * Builds a Discord Activity object from a Track_Event.
 * @param {object} trackEvent
 * @returns {object} Discord Activity payload
 */
function setActivity(trackEvent) {
  const activity = {
    details: trackEvent.name.slice(0, 128),
    state: ('by ' + trackEvent.artist).slice(0, 128),
    largeImageKey:
      typeof trackEvent.coverUrl === 'string' && trackEvent.coverUrl.startsWith('https://')
        ? trackEvent.coverUrl
        : 'violettunes_logo',
    largeImageText: 'VioletTunes',
    smallImageKey: trackEvent.playing ? 'play' : 'pause',
    smallImageText: trackEvent.playing ? 'Играет' : 'Пауза',
    instance: false,
  };

  if (trackEvent.playing === true) {
    activity.timestamps = {
      start: Date.now() - trackEvent.positionSec * 1000,
    };
  }

  return activity;
}

// --- Task 2.7: clearActivity ---

/**
 * Clears Discord Rich Presence activity if connected.
 */
async function clearActivity() {
  if (rpcClient) {
    try {
      await rpcClient.clearActivity();
    } catch (err) {
      console.error('[Discord] clearActivity error:', err.message);
    }
  }
}

// --- Task 2.4: connectToDiscord ---

/**
 * Connects to the local Discord desktop app via IPC (discord-rpc).
 * Retries every 15 seconds if Discord is not running.
 */
async function connectToDiscord() {
  // NOTE: Replace with your real Discord App ID from https://discord.com/developers/applications
  const CLIENT_ID = '1234567890123456789';

  const client = new DiscordRPC.Client({ transport: 'ipc' });

  client.on('ready', () => {
    console.log('[Discord] Ready');
  });

  try {
    await client.login({ clientId: CLIENT_ID });
    rpcClient = client;
    console.log('[Discord] Connected');
  } catch (err) {
    console.log('[Discord] Not running, retry in 15s');
    setTimeout(connectToDiscord, 15000);
  }
}

// --- Task 2.1: connectToBackend ---

/**
 * Connects to the VioletTunes backend via WebSocket.
 * Sends register message on open, handles track/clear/ping messages,
 * and reconnects with exponential backoff on disconnect.
 * @param {string} token - Session token for routing
 * @param {string} backendUrl - WebSocket URL of the backend
 */
function connectToBackend(token, backendUrl) {
  const ws = new WebSocket(backendUrl);
  wsClient = ws;

  ws.on('open', () => {
    reconnectAttempt = 0;
    ws.send(JSON.stringify({ type: 'register', token }));
    console.log('[Backend] Connected');
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.error('[Backend] Invalid JSON:', err.message);
      return;
    }

    if (msg.type === 'track') {
      const activity = setActivity(msg);
      if (rpcClient) {
        try {
          await rpcClient.setActivity(activity);
        } catch (err) {
          console.error('[Discord] setActivity error:', err.message);
        }
      }
    } else if (msg.type === 'clear') {
      await clearActivity();
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    reconnectAttempt++;
    const delay = getReconnectDelay(reconnectAttempt);
    const delaySec = Math.round(delay / 1000);
    console.log(`[Backend] Disconnected, retry in ${delaySec}s`);
    setTimeout(() => connectToBackend(token, backendUrl), delay);
  });

  ws.on('error', (err) => {
    console.error('[Backend] Error:', err.message);
  });
}

// --- Entry point ---
connectToBackend(token, backendUrl);
connectToDiscord();
