import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

// =====================================================================
// OPTICSENTRY OS — EVEN REALITIES G2 HEADS-UP APPLICATION
// Track 01: Messaging & News (Telegram Bot + G2 MicroLED Waveguide)
// Monochromatic Emerald Green (525nm) • 576 x 288 Display Matrix
// =====================================================================

interface AssetState {
  symbol: string
  name: string
  price: number
  change24h: number
  spreadBps: number
}

const WATCHLIST: AssetState[] = [
  { symbol: 'ETH', name: 'Ethereum', price: 3142.50, change24h: 2.48, spreadBps: 4.2 },
  { symbol: 'TON', name: 'The Open Network', price: 5.82, change24h: 4.15, spreadBps: 3.8 },
  { symbol: 'BTC', name: 'Bitcoin', price: 92450.00, change24h: 1.82, spreadBps: 2.1 },
  { symbol: 'SOL', name: 'Solana', price: 218.40, change24h: -0.65, spreadBps: 5.1 },
]

let assetIndex = 0
let shieldState: 'NOMINAL' | 'CIRCUIT_TRIPPED' | 'ACKNOWLEDGED' | 'BLACKOUT' = 'NOMINAL'
let breakerReason = ''
let lastHmacSignature = '8f4c2e1b...9a0d3f7e'
let dispatchesCount = 14
let bridgeInstance: any = null

function formatG2DisplayContent(): string {
  if (shieldState === 'BLACKOUT') {
    return [
      '┌── OPTICSENTRY OS ──────── [BLACKOUT] ──┐',
      '│                                        │',
      '│       [STEALTH SHIELD ENGAGED]         │',
      '│      DISPLAY POWER DRAW: 0.00 mW       │',
      '│                                        │',
      '└── [1-TAP OR SWIPE TO RESTORE HUD] ────┘'
    ].join('\n')
  }

  const asset = WATCHLIST[assetIndex]
  const arrow = asset.change24h >= 0 ? '▲' : '▼'
  const sign = asset.change24h >= 0 ? '+' : ''
  const priceStr = `$${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (shieldState === 'CIRCUIT_TRIPPED') {
    return [
      '╔══ ⚠ CIRCUIT BREAKER TRIPPED ══════════╗',
      `║  ${(asset.symbol + ' / USD').padEnd(14)} ${priceStr.padStart(11)} ${arrow}  ║`,
      `║  ${(breakerReason || 'SPREAD BLOWOUT (>15.0 bps)').padEnd(36)}  ║`,
      '║  CRITICAL ALERT ➔ TELEGRAM BOT        ║',
      '╚══ [1-TAP: ACK] ════ [2-TAP: RESET] ═══╝'
    ].join('\n')
  }

  if (shieldState === 'ACKNOWLEDGED') {
    return [
      '┌── OPTICSENTRY OS ──────── [VERIFIED] ──┐',
      `│  ${(asset.symbol + ' / USD').padEnd(14)} ${priceStr.padStart(11)} ${arrow}  │`,
      `│  SLIPPAGE SHIELD LOCKED: ${asset.spreadBps.toFixed(1)} bps         │`,
      `│  HMAC SIG: ${lastHmacSignature.slice(0, 16)}... │`,
      '└── [1-TAP: RE-ARM] ── [SWIPE: NEXT] ───┘'
    ].join('\n')
  }

  // NOMINAL LUXURY HUD
  return [
    '┌── OPTICSENTRY OS ──────── [NOMINAL] ──┐',
    `│  ${(asset.symbol + ' / USD').padEnd(14)} ${priceStr.padStart(11)} ${arrow} ${sign}${asset.change24h}% │`,
    `│  SPREAD: ${asset.spreadBps.toFixed(1)} bps   │  BATTERY: 18.0h  │`,
    '│  TELEGRAM: @OpticSentryBot [SYNCED]   │',
    '└── [1-TAP: ACK] ───── [SWIPE: ASSET] ──┘'
  ].join('\n')
}

function updateLocalCompanionUI() {
  const g2TextEl = document.getElementById('g2-hud-text')
  const statusEl = document.getElementById('status-badge')
  const tickerEl = document.getElementById('current-ticker')
  const spreadEl = document.getElementById('current-spread')
  const hmacEl = document.getElementById('last-hmac')

  const content = formatG2DisplayContent()
  if (g2TextEl) g2TextEl.innerText = content
  if (statusEl) {
    statusEl.innerText = shieldState
    statusEl.className = `status-pill ${shieldState.toLowerCase()}`
  }
  const asset = WATCHLIST[assetIndex]
  if (tickerEl) tickerEl.innerText = `${asset.symbol} $${asset.price.toLocaleString()}`
  if (spreadEl) spreadEl.innerText = `${asset.spreadBps} bps`
  if (hmacEl) hmacEl.innerText = `${lastHmacSignature} (#${dispatchesCount})`
}

async function syncG2HUD() {
  updateLocalCompanionUI()
  if (!bridgeInstance) return

  try {
    const content = formatG2DisplayContent()
    await bridgeInstance.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'opticsentry_hud',
        content,
      }),
    )
  } catch (err) {
    console.warn('[OpticSentry G2] Upgrade error:', err)
  }
}

// Event routing per Even Realities SDK specifications
function handleG2Tap() {
  console.log('[OpticSentry G2] Single Tap detected')
  if (shieldState === 'BLACKOUT') {
    shieldState = 'NOMINAL'
  } else if (shieldState === 'CIRCUIT_TRIPPED') {
    shieldState = 'ACKNOWLEDGED'
    lastHmacSignature = 'hmac_' + Math.random().toString(16).substring(2, 10) + '99b2'
    dispatchesCount++
  } else if (shieldState === 'ACKNOWLEDGED') {
    shieldState = 'NOMINAL'
  } else {
    // Nominal tap simulates fast testnet risk check
    lastHmacSignature = 'hmac_' + Math.random().toString(16).substring(2, 10) + 'ef01'
    dispatchesCount++
  }
  syncG2HUD()
}

function handleG2DoubleTap() {
  console.log('[OpticSentry G2] Double Tap detected (Emergency Reset / Stand Down)')
  if (shieldState === 'CIRCUIT_TRIPPED') {
    shieldState = 'NOMINAL'
    breakerReason = ''
  } else if (shieldState === 'BLACKOUT') {
    shieldState = 'NOMINAL'
  } else {
    shieldState = 'BLACKOUT'
  }
  syncG2HUD()
}

function handleG2SwipeForward() {
  console.log('[OpticSentry G2] Swipe forward -> Next Asset')
  assetIndex = (assetIndex + 1) % WATCHLIST.length
  syncG2HUD()
}

function handleG2SwipeBackward() {
  console.log('[OpticSentry G2] Swipe backward -> Prev Asset')
  assetIndex = (assetIndex - 1 + WATCHLIST.length) % WATCHLIST.length
  syncG2HUD()
}

function triggerSimulatedBlowout() {
  shieldState = 'CIRCUIT_TRIPPED'
  breakerReason = 'SPREAD_BLOWOUT (48.6 bps > 15.0 bps)'
  const asset = WATCHLIST[assetIndex]
  asset.spreadBps = 48.6
  lastHmacSignature = 'hmac_crit_' + Math.random().toString(16).substring(2, 10) + 'fe99'
  dispatchesCount++
  syncG2HUD()
}

// Attach UI Simulator Controls for browser/companion testing
function setupCompanionControls() {
  const tapBtn = document.getElementById('btn-tap')
  const doubleTapBtn = document.getElementById('btn-double-tap')
  const swipeFwdBtn = document.getElementById('btn-swipe-fwd')
  const swipeBackBtn = document.getElementById('btn-swipe-back')
  const shockBtn = document.getElementById('btn-shock')

  if (tapBtn) tapBtn.onclick = () => handleG2Tap()
  if (doubleTapBtn) doubleTapBtn.onclick = () => handleG2DoubleTap()
  if (swipeFwdBtn) swipeFwdBtn.onclick = () => handleG2SwipeForward()
  if (swipeBackBtn) swipeBackBtn.onclick = () => handleG2SwipeBackward()
  if (shockBtn) shockBtn.onclick = () => triggerSimulatedBlowout()
}

// Helper per official template
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

// Initialize Even Realities App Bridge
async function initApp() {
  setupCompanionControls()
  updateLocalCompanionUI()

  // Real-time micro price tick simulation
  setInterval(() => {
    if (shieldState !== 'CIRCUIT_TRIPPED') {
      const asset = WATCHLIST[assetIndex]
      const delta = (Math.random() - 0.49) * (asset.price * 0.0008)
      asset.price = Math.round((asset.price + delta) * 100) / 100
      syncG2HUD()
    }
  }, 2500)

  console.log('[OpticSentry OS] Connecting to Even Realities App Bridge...')

  try {
    // Attempt connection with fallback timeout so companion runs anywhere
    const bridgePromise = waitForEvenAppBridge()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Simulator bridge timeout (standalone mode)')), 2000),
    )

    bridgeInstance = await Promise.race([bridgePromise, timeoutPromise])
    console.log('[OpticSentry OS] Even App Bridge connected successfully!')

    // Create primary 576 x 288 monochrome HUD container
    const mainText = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 4,
      containerID: 1,
      containerName: 'opticsentry_hud',
      content: formatG2DisplayContent(),
      isEventCapture: 1,
    })

    const result = await bridgeInstance.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [mainText],
      }),
    )

    console.log('[OpticSentry OS] G2 Startup Page Container:', result === 0 ? 'Success' : result)

    // Listen to physical temple tap & gesture events
    bridgeInstance.onEvenHubEvent((event: any) => {
      const sysType = eventTypeOf(event.sysEvent)
      const textType = eventTypeOf(event.textEvent)

      if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        handleG2DoubleTap()
        return
      }

      if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
        handleG2Tap()
        return
      }

      if (sysType === OsEventTypeList.SCROLL_TOP_EVENT || textType === OsEventTypeList.SCROLL_TOP_EVENT) {
        handleG2SwipeForward()
        return
      }

      if (sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT || textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        handleG2SwipeBackward()
        return
      }
    })
  } catch (e) {
    console.warn('[OpticSentry OS] Standalone companion mode active (ready for evenhub-simulator connection).')
  }
}

initApp()
