import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

// =====================================================================
// OPTICSENTRY OS — EVEN REALITIES G2 SMART GLASSES BRIDGE
// Track 01: Messaging & News (Telegram Channel & Bot Sentinel)
// Synchronizes Telegram Digest Stream with the G2 MicroLED Waveguide Display
// =====================================================================

declare global {
  interface Window {
    syncEvenGlasses?: (data: any) => void
    triggerGesture?: (type: string) => void
    cycleAsset?: () => void
  }
}

let bridgeInstance: any = null
let currentHUDContent = ''

interface TelegramChannelItem {
  channel: string
  headline: string
  digest: string
  subtext: string
  priority: string
}

const telegramChannels: TelegramChannelItem[] = [
  {
    channel: '@DeFiAlphaDigest',
    headline: 'ETH BREAKOUT $3,142.50',
    digest: 'DIGEST: 12.4k ETH Inflow',
    subtext: 'SENTIMENT: Bullish (+2.4%)',
    priority: 'NORMAL'
  },
  {
    channel: '@WhaleAlertDesk',
    headline: 'BTC WHALE $91,480.00',
    digest: 'ALERT: 5,200 BTC to Vault',
    subtext: 'PRIORITY: HIGH (Track 01)',
    priority: 'HIGH'
  },
  {
    channel: '@TONEcosystemNews',
    headline: 'TON NEWS $5.82 (+4.1%)',
    digest: 'UPDATE: Mini App Gateway',
    subtext: 'COMMUNITY: 94k Active Users',
    priority: 'NORMAL'
  }
]

let channelIndex = 0

function formatCleanHUD(data?: any): string {
  if (data && data.stealthMode) {
    return [
      'OPTICSENTRY · TELEGRAM MUTE',
      '────────────────────────',
      'HUD STREAM: MUTED (0.00 mW)',
      'NOTIFICATIONS SUSPENDED',
      '────────────────────────',
      '[1-TAP OR SWIPE TO RESUME]'
    ].join('\n')
  }

  if (data && data.circuitTripped) {
    return [
      '⚠ TELEGRAM PRIORITY ALERT ⚠',
      '════════════════════════',
      'FROM: @OpticSentryBot',
      'MALICIOUS PHISHING DETECTED',
      'IN TRADING ALPHA VIP GROUP!',
      '════════════════════════',
      '[1-TAP: APPROVE AI MUTE]'
    ].join('\n')
  }

  // Derive current channel item
  const idx = (data && typeof data.channelIdx === 'number') ? data.channelIdx : channelIndex
  const current = telegramChannels[idx % telegramChannels.length]

  return [
    `TG: ${current.channel}`,
    '────────────────────────',
    current.headline,
    current.digest,
    current.subtext,
    '────────────────────────',
    '[1-TAP: APPROVE] [SWIPE]'
  ].join('\n')
}

async function upgradeG2Display(content: string) {
  if (content === currentHUDContent) return
  currentHUDContent = content

  if (!bridgeInstance) return

  try {
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

// Expose sync hook for the Titanium Cockpit
window.syncEvenGlasses = (data: any) => {
  if (data && typeof data.channelIdx === 'number') {
    channelIndex = data.channelIdx
  }
  const content = formatCleanHUD(data)
  upgradeG2Display(content)
}

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

async function initEvenG2Bridge() {
  console.log('[OpticSentry G2] Connecting to Even Realities App Bridge...')

  try {
    const bridgePromise = waitForEvenAppBridge()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Standalone browser mode (timeout)')), 2500),
    )

    bridgeInstance = await Promise.race([bridgePromise, timeoutPromise])
    console.log('[OpticSentry G2] Connected to Even Realities G2 Simulator / Hardware!')

    const initialContent = formatCleanHUD()
    currentHUDContent = initialContent

    const mainText = new TextContainerProperty({
      xPosition: 10,
      yPosition: 15,
      width: 556,
      height: 258,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 4,
      containerID: 1,
      containerName: 'opticsentry_hud',
      content: initialContent,
      isEventCapture: 1,
    })

    await bridgeInstance.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [mainText],
      }),
    )

    console.log('[OpticSentry G2] Startup Page Container successfully created.')

    // Listen to physical temple events from glasses simulator
    bridgeInstance.onEvenHubEvent((event: any) => {
      const sysType = eventTypeOf(event.sysEvent)
      const textType = eventTypeOf(event.textEvent)

      if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        if (window.triggerGesture) window.triggerGesture('DOUBLE_TAP')
        return
      }

      if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
        if (window.triggerGesture) window.triggerGesture('SINGLE_TAP')
        return
      }

      if (
        sysType === OsEventTypeList.SCROLL_TOP_EVENT ||
        textType === OsEventTypeList.SCROLL_TOP_EVENT ||
        sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
        textType === OsEventTypeList.SCROLL_BOTTOM_EVENT
      ) {
        if (window.cycleAsset) window.cycleAsset()
        return
      }
    })
  } catch (e) {
    console.log('[OpticSentry G2] Running in standalone web cockpit mode.')
  }
}

initEvenG2Bridge()
