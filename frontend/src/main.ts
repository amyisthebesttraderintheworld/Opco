import './style.css';
import { Address, beginCell, toNano } from '@ton/core';

const DEFAULT_ROUND_ADDRESS = 'EQBXKvC_gYJLNGpp4i5X0D__QMHhIa-9183D8HjJoWXKKs-U';
let rpcEndpoint = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const COMMIT_OPCODE = 0x6f70656e;
const REVEAL_OPCODE = 0x7265766c;
const RESOLVE_OPCODE = 0x7265736f;
const CLAIM_OPCODE = 0x636c616d;

type Snapshot = {
  config: {
    roundId: bigint;
    duration: number;
    revealDuration: number;
    stakeType: number;
    stakeAmount: bigint;
    startsAt: bigint;
    phase: number;
  };
  stats: {
    participants: number;
    cooperators: number;
    defectors: number;
    phase: number;
    settlement: number;
  };
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App root missing');
}

let snapshot: Snapshot | null = null;
let loading = false;
let roundAddress = DEFAULT_ROUND_ADDRESS;
let walletUi: { sendTransaction(transaction: { validUntil: number; messages: { address: string; amount: string; payload?: string }[] }): Promise<unknown>; account?: { address: string } } | null = null;
let selectedAction = true;

function phaseDeadline(config: Snapshot['config'] | undefined): number | null {
  if (!config || config.phase > 1) return null;
  const startsAt = Number(config.startsAt);
  return config.phase === 0 ? startsAt + config.duration : startsAt + config.duration + config.revealDuration;
}

function countdown(config: Snapshot['config'] | undefined): string {
  const deadline = phaseDeadline(config);
  if (deadline == null) return config?.phase === 2 ? 'SETTLED' : '—';
  const remaining = Math.max(0, deadline - Math.floor(Date.now() / 1000));
  const hours = Math.floor(remaining / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function phaseLabel(phase: number | undefined) {
  const labels = ['QUEUED', 'COMMITTING', 'REVEALING', 'RESOLVED', 'CLAIMED'];
  return labels[phase ?? 0] ?? 'QUEUED';
}

function formatCoins(value: bigint | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value) / 1e9} TON`;
}

function shortAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function explorerUrl() {
  return `https://testnet.tonscan.org/address/${roundAddress}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toPayload(cell: ReturnType<typeof beginCell>) {
  return bytesToBase64(cell.endCell().toBoc());
}

function randomSalt(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
}

function getSalt(): bigint {
  const key = `opco:salt:${roundAddress}`;
  const saved = localStorage.getItem(key);
  if (saved) return BigInt(saved);
  const salt = randomSalt();
  localStorage.setItem(key, salt.toString());
  return salt;
}

function actionCommitment(action: boolean, salt: bigint): bigint {
  const hash = beginCell().storeBit(action).storeUint(salt, 256).endCell().hash();
  return BigInt(`0x${bytesToHex(hash)}`);
}

async function sendRoundMessage(opcode: number, body: ReturnType<typeof beginCell>, label: string) {
  if (!walletUi?.account) {
    setStatus('Connect a wallet first.');
    return;
  }
  setStatus(`Approve ${label} in your wallet…`);
  await walletUi.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [{ address: roundAddress, amount: toNano('0.02').toString(), payload: toPayload(body.storeUint(opcode, 32).storeUint(0, 64)) }],
  });
  setStatus(`${label} sent. Refreshing chain state…`);
  window.setTimeout(() => void loadState(), 2500);
}

function setStatus(message: string) {
  const target = document.querySelector<HTMLParagraphElement>('#action-status');
  if (target) target.textContent = message;
}

function bindActions() {
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.choice').forEach((choice) => choice.classList.remove('active'));
      button.classList.add('active');
        selectedAction = button.dataset.action === 'true';
    });
  });

  document.querySelector('#refresh')?.addEventListener('click', () => {
    void loadState();
  });

  document.querySelector('#commit')?.addEventListener('click', () => {
    const salt = getSalt();
    void sendRoundMessage(COMMIT_OPCODE, beginCell().storeUint(actionCommitment(selectedAction, salt), 256), 'commit');
  });

  document.querySelector('#reveal')?.addEventListener('click', () => {
    const salt = getSalt();
    void sendRoundMessage(REVEAL_OPCODE, beginCell().storeBit(selectedAction).storeUint(salt, 256), 'reveal');
  });

  document.querySelector('#resolve')?.addEventListener('click', () => {
    void sendRoundMessage(RESOLVE_OPCODE, beginCell(), 'resolve');
  });

  document.querySelector('#claim')?.addEventListener('click', () => {
    void sendRoundMessage(CLAIM_OPCODE, beginCell(), 'claim');
  });
}

function render() {
  const config = snapshot?.config;
  const stats = snapshot?.stats;
  const phase = phaseLabel(config?.phase ?? stats?.phase);

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <a class="wordmark" href="/">OPEN <span>COOPERATION</span></a>
        <div class="top-actions">
          <span class="network"><i></i> TON TESTNET</span>
          <div id="wallet-button" class="wallet-button">Wallet Connect</div>
        </div>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span class="live-dot"></span> ROUND ${config?.roundId?.toString() ?? '1'} / LIVE PROTOTYPE</p>
          <h1>Choose.<br /><em>Commit.</em><br />Reveal.</h1>
          <p class="intro">A repeated cooperation experiment where your decision stays hidden until the round closes.</p>
          <a class="text-link" href="${explorerUrl()}" target="_blank" rel="noreferrer">View contract on Tonscan <span>↗</span></a>
        </div>
        <div class="round-orbit" aria-hidden="true">
          <div class="orbit-line orbit-one"></div>
          <div class="orbit-line orbit-two"></div>
          <div class="orbit-core"><span>ROUND</span><strong>${config?.roundId?.toString() ?? '01'}</strong></div>
          <div class="orbit-node node-a">C</div>
          <div class="orbit-node node-b">D</div>
        </div>
      </section>

      <section class="board">
        <div class="section-heading">
          <div>
            <p class="eyebrow">ON-CHAIN STATE</p>
            <h2>Round dashboard</h2>
          </div>
          <button class="refresh" id="refresh">${loading ? 'SYNCING...' : '↻ REFRESH'}</button>
        </div>
        <div class="metrics">
          <article class="metric"><span>PHASE</span><strong>${phase}</strong><small>${config ? `${config.duration}s commit · ${config.revealDuration}s reveal` : 'Loading contract state'}</small></article>
          <article class="metric"><span>PARTICIPANTS</span><strong>${stats?.participants ?? '—'}</strong><small>anonymous commitments</small></article>
          <article class="metric"><span>COOPERATION</span><strong>${stats ? `${stats.cooperators} / ${stats.participants}` : '—'}</strong><small>${stats ? `${stats.defectors} defection${stats.defectors === 1 ? '' : 's'}` : 'reveals pending'}</small></article>
          <article class="metric accent"><span>STAKE</span><strong>${formatCoins(config?.stakeAmount)}</strong><small>native TON boundary</small></article>
          <article class="metric timer"><span>PHASE CLOSES IN</span><strong>${countdown(config)}</strong><small>chain deadline · UTC</small></article>
        </div>
      </section>

      <section class="playground">
        <div class="panel protocol-panel">
          <div class="panel-label">01 / PRIVATE DECISION</div>
          <h2>What do you choose?</h2>
          <p>Your action is hashed in your browser. The contract receives only the commitment until reveal.</p>
          <div class="choice-grid">
            <button class="choice active" data-action="true"><b>COOPERATE</b><span>Build the common pool</span></button>
            <button class="choice" data-action="false"><b>DEFECT</b><span>Keep your edge hidden</span></button>
          </div>
          <label class="field-label" for="salt">Private salt</label>
          <input id="salt" class="text-input" placeholder="A memorable secret, never shared" autocomplete="off" />
          <button id="commit" class="primary-action">Commit decision <span>→</span></button>
          <p id="action-status" class="status" role="status">Connect a wallet to participate.</p>
        </div>

        <div class="panel timeline-panel">
          <div class="panel-label">02 / ROUND PROTOCOL</div>
          <h2>One honest move at a time.</h2>
          <div class="timeline">
            <div class="step current"><span>01</span><div><b>Commit</b><small>Hide your action with a hash</small></div></div>
            <div class="step"><span>02</span><div><b>Reveal</b><small>Prove what you committed</small></div></div>
            <div class="step"><span>03</span><div><b>Resolve</b><small>Close the collective result</small></div></div>
            <div class="step"><span>04</span><div><b>Claim</b><small>Settle your outcome</small></div></div>
          </div>
          <div class="secondary-actions">
            <button id="reveal">Reveal action</button>
            <button id="resolve">Resolve round</button>
            <button id="claim">Claim result</button>
          </div>
        </div>
      </section>

      <footer>
        <span>OPEN COOPERATION EXPERIMENT</span>
        <span>CONTRACT <a href="${explorerUrl()}" target="_blank" rel="noreferrer">${shortAddress(roundAddress)}</a></span>
      </footer>
    </main>
  `;

  bindActions();
}

async function rpc(method: string) {
  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'runGetMethod',
      params: { address: roundAddress, method, stack: [] },
    }),
  });

  const payload = await response.json();
  if (!payload?.result?.stack) {
    throw new Error(payload?.error?.message ?? 'Unable to load contract state');
  }

  return payload.result.stack;
}

async function loadRuntimeConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) return;
    const config = await response.json() as {
      contractAddress?: string;
      rpc?: string;
      opcoJettonAddress?: string;
      mockUsdtAddress?: string;
    };

    if (config.contractAddress) {
      roundAddress = config.contractAddress;
    }
    if (config.rpc) {
      rpcEndpoint = config.rpc;
    }
    const explorer = `https://testnet.tonscan.org/address/${roundAddress}`;
    const contractLink = document.querySelector<HTMLAnchorElement>('#contract-link');
    if (contractLink) {
      contractLink.href = explorer;
      contractLink.textContent = shortAddress(roundAddress);
    }
  } catch (error) {
    console.warn('Unable to load runtime config', error);
  }
}

async function loadState() {
  loading = true;
  render();

  try {
    const [configData, statsData] = await Promise.all([rpc('roundConfig'), rpc('roundStats')]);

    snapshot = {
      config: {
        roundId: BigInt(configData?.[0]?.[1] ?? '1'),
        duration: Number(configData?.[1]?.[1] ?? '0'),
        revealDuration: Number(configData?.[2]?.[1] ?? '0'),
        stakeType: Number(configData?.[3]?.[1] ?? '0'),
        stakeAmount: BigInt(configData?.[4]?.[1] ?? '0'),
        startsAt: BigInt(configData?.[5]?.[1] ?? '0'),
        phase: Number(configData?.[6]?.[1] ?? '0'),
      },
      stats: {
        participants: Number(statsData?.[0]?.[1] ?? '0'),
        cooperators: Number(statsData?.[1]?.[1] ?? '0'),
        defectors: Number(statsData?.[2]?.[1] ?? '0'),
        phase: Number(statsData?.[3]?.[1] ?? '0'),
        settlement: Number(statsData?.[4]?.[1] ?? '0'),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load contract state';
    setStatus(message);
  } finally {
    loading = false;
    render();
  }
}

render();
await loadRuntimeConfig();

render();
try {
  const { TonConnectUI } = await import('@tonconnect/ui');
  walletUi = new TonConnectUI({
    manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
    buttonRootId: 'wallet-button',
  });
  walletUi.onStatusChange?.((wallet: { account?: { address: string } } | null) => {
    walletUi!.account = wallet?.account;
    setStatus(wallet?.account ? `Connected ${shortAddress(wallet.account.address)}` : 'Connect a wallet to participate.');
  });
} catch (error) {
  console.warn('TonConnect unavailable:', error);
}
void loadState();
window.setInterval(() => {
  const timer = document.querySelector<HTMLElement>('.timer strong');
  if (timer) timer.textContent = countdown(snapshot?.config);
}, 1000);