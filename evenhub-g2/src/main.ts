import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

// =====================================================================
// OPTICSENTRY OS — EVEN REALITIES G2 SMART GLASSES BRIDGE
// Synchronizes the Titanium Cockpit with the G2 MicroLED Waveguide Display
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

function formatCleanHUD(data?: any): string {
  if (!data) {
    return [
      'OPTICSENTRY OS · G2 SENTINEL',
      '────────────────────────',
      'ETH / USD   $3,138.43  ▲ +2.4%',
      'SPREAD: 4.2 bps  BAT: 18.0h',
      '@OpticSentryBot [SYNCED]',
      '────────────────────────',
      '[1-TAP: ACK] [SWIPE: ASSET]'
    ].join('\n')
  }

  if (data.stealthMode) {
    return [
      'OPTICSENTRY · STEALTH BLACKOUT',
      '────────────────────────',
      'DISPLAY POWER: 0.00 mW',
      'OPTICAL PIXELS DORMANT',
      '────────────────────────',
      '[1-TAP OR SWIPE TO RESTORE]'
    ].join('\n')
  }

  if (data.circuitTripped) {
    return [
      '⚠ OPTICSENTRY RISK BREAKER ⚠',
      '════════════════════════',
      `${data.sym || 'ETH'} / USD   $${(data.price || 3088).toLocaleString('en-US', {minimumFractionDigits: 2})}  ▼ SHOCK`,
      `SPREAD: ${data.spread || 48.6} bps (>35 bps)`,
      'ALERT SENT ➔ @OpticSentryBot',
      '════════════════════════',
      '[1-TAP: ACK]  [2-TAP: RESET]'
    ].join('\n')
  }

  const sign = (data.change ?? 2.48) >= 0 ? '+' : ''
  const arrow = (data.change ?? 2.48) >= 0 ? '▲' : '▼'
  const priceFormatted = `$${(data.price || 3138.43).toLocaleString('en-US', {minimumFractionDigits: 2})}`

  return [
    'OPTICSENTRY OS · G2 SENTINEL',
    '────────────────────────',
    `${(data.sym || 'ETH') + ' / USD'}   ${priceFormatted}  ${arrow}${sign}${Math.abs(data.change ?? 2.48).toFixed(1)}%`,
    `SPREAD: ${(data.spread ?? 4.2)} bps  BAT: 18.0h`,
    '@OpticSentryBot [SYNCED]',
    '────────────────────────',
    '[1-TAP: ACK] [SWIPE: ASSET]'
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
