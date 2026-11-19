"""
Unit Test Suite for OpticSentry OS
Verifies deterministic sub-millisecond execution, BLE GATT framing,
MicroLED pixel power limits, and token-optimization invariants.

Author: Usman Bamidele (100L Pure Mathematics, FUNAAB)
"""

import unittest
import time
from opticsentry_engine import (
    EvenG2PacketEncoder,
    MicroLEDPixelBudget,
    System1DeterministicSentinel,
    System2SemanticCoPilot,
    TelegramHUDBridge,
    G2_DISPLAY_WIDTH,
    G2_DISPLAY_HEIGHT
)


class TestOpticSentryEngine(unittest.TestCase):

    def setUp(self):
        self.sentinel = System1DeterministicSentinel(
            max_spread_bps=35.0,
            max_volatility_pct=1.5,
            max_slippage_pct=0.5
        )

    # 1. CRC16 Integrity
    def test_crc16_integrity(self):
        data = b"Even_Realities_G2_OpticSentry"
        crc1 = EvenG2PacketEncoder.calculate_crc16(data)
        crc2 = EvenG2PacketEncoder.calculate_crc16(data)
        self.assertEqual(crc1, crc2)
        # Verify tampering changes CRC
        tampered = b"Even_Realities_G2_OpticSentrz"
        self.assertNotEqual(crc1, EvenG2PacketEncoder.calculate_crc16(tampered))

    # 2. BLE Frame Encoding and Decoding
    def test_ble_frame_encoding_and_decoding(self):
        payload = "BTC $91,420 ▲1.8% | S:12bps"
        frame = EvenG2PacketEncoder.encode_frame('TELEMETRY_TICKER', payload, seq_num=7)
        self.assertGreater(len(frame), len(payload))

        valid, decoded_payload, err = EvenG2PacketEncoder.verify_frame(frame)
        self.assertTrue(valid)
        self.assertEqual(decoded_payload, payload)
        self.assertIsNone(err)

    # 3. BLE MTU Fragmentation
    def test_ble_mtu_fragmentation(self):
        long_payload = "ALERT: Flash liquidity drop detected on ETH/USDC orderbook. Auto-breaker engaged."
        frame = EvenG2PacketEncoder.encode_frame('CIRCUIT_ALERT', long_payload)
        chunks = EvenG2PacketEncoder.fragment_for_ble_mtu(frame, mtu=20)

        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            # Each chunk must strictly respect the 20-byte legacy BLE limit
            self.assertLessEqual(len(chunk), 20)
            # First byte must be fragmentation marker 0xAB
            self.assertEqual(chunk[0], 0xAB)

    # 4. System 1 Zero Token Consumption
    def test_system1_zero_token_consumption(self):
        result = self.sentinel.ingest_market_tick("ETH", 3120.0, 3120.5)
        self.assertEqual(result['tokens_consumed'], 0)

    # 5. System 1 Sub-millisecond Latency
    def test_system1_submillisecond_latency(self):
        latencies = []
        for _ in range(50):
            res = self.sentinel.ingest_market_tick("SOL", 185.0, 185.2)
            latencies.append(res['latency_us'])
        avg_latency_us = sum(latencies) / len(latencies)
        # Average latency must be well under 1,000 microseconds (1 millisecond)
        self.assertLess(avg_latency_us, 1000.0)

    # 6. Spread Blowout Circuit Breaker
    def test_spread_blowout_circuit_breaker(self):
        # Normal spread: 3120.0 to 3121.0 = ~3.2 bps (< 35 bps limit)
        res1 = self.sentinel.ingest_market_tick("ETH", 3120.0, 3121.0)
        self.assertFalse(res1['circuit_tripped'])

        # Blowout spread: 3120.0 to 3140.0 = ~63.9 bps (> 35 bps limit)
        res2 = self.sentinel.ingest_market_tick("ETH", 3120.0, 3140.0)
        self.assertTrue(res2['circuit_tripped'])
        self.assertIn("SPREAD_BLOWOUT", res2['trip_reason'])

    # 7. Volatility Shock Circuit Breaker
    def test_volatility_shock_circuit_breaker(self):
        self.sentinel.ingest_market_tick("BTC", 90000.0, 90005.0)
        # Inject 3.3% instant spike (exceeds 1.5% max limit)
        res = self.sentinel.ingest_market_tick("BTC", 93000.0, 93005.0)
        self.assertTrue(res['circuit_tripped'])
        self.assertIn("VOLATILITY_SHOCK", res['trip_reason'])

    # 8. Temple Single-Tap Order Execution
    def test_temple_single_tap_order_execution(self):
        self.sentinel.ingest_market_tick("SOL", 180.0, 180.1)
        res = self.sentinel.handle_temple_gesture("SINGLE_TAP")
        self.assertEqual(res['action_taken'], "ORDER_CONFIRMED_AND_ROUTED")
        self.assertEqual(self.sentinel.execution_count, 1)

    # 9. Temple Double-Tap Breaker Reset
    def test_temple_double_tap_breaker_reset(self):
        # Trip breaker
        self.sentinel.ingest_market_tick("ETH", 3000.0, 3050.0)
        self.assertTrue(self.sentinel.circuit_tripped)

        # Double tap to dismiss alert and reset
        res = self.sentinel.handle_temple_gesture("DOUBLE_TAP")
        self.assertFalse(self.sentinel.circuit_tripped)
        self.assertEqual(res['action_taken'], "CIRCUIT_BREAKER_RESET")

    # 10. Temple Long-Press Stealth Mode
    def test_temple_long_press_stealth_mode(self):
        self.assertFalse(self.sentinel.stealth_mode)
        res1 = self.sentinel.handle_temple_gesture("LONG_PRESS")
        self.assertTrue(self.sentinel.stealth_mode)
        self.assertEqual(res1['action_taken'], "STEALTH_BLACKOUT_ACTIVATED")

        # In stealth mode, HUD string is blanked out
        tick = self.sentinel.ingest_market_tick("BTC", 90000.0, 90005.0)
        self.assertEqual(tick['hud_display'], "")

    # 11. MicroLED Pixel Budget Calculation
    def test_microled_pixel_budget_calculation(self):
        sample_text = "ETH $3,140 ▲2.4%"
        active_pixels = MicroLEDPixelBudget.estimate_active_pixels(sample_text)
        power_stats = MicroLEDPixelBudget.calculate_power(active_pixels)

        self.assertGreater(power_stats['active_pixels'], 0)
        self.assertLess(power_stats['active_pixels'], G2_DISPLAY_WIDTH * G2_DISPLAY_HEIGHT)
        self.assertGreater(power_stats['battery_lifetime_hours'], 15.0)

    # 12. MicroLED All-Day Battery Advantage
    def test_microled_all_day_battery_advantage(self):
        # OpticSentry Micro-Telegraphic HUD (low active pixel ratio: ~1.2%)
        opticsentry_power = MicroLEDPixelBudget.calculate_power(1500)
        # Conventional full-screen GUI (high active pixel ratio: ~30%)
        heavy_gui_power = MicroLEDPixelBudget.calculate_power(38000)

        # OpticSentry battery lifetime must be over 3x longer than heavy GUI
        ratio = opticsentry_power['battery_lifetime_hours'] / heavy_gui_power['battery_lifetime_hours']
        self.assertGreater(ratio, 3.0)

    # 13. System 2 Token Reduction Audit
    def test_system2_token_reduction_audit(self):
        audit = System2SemanticCoPilot.generate_micro_telegraphic_explanation(
            symbol="ETH",
            price=3120.0,
            spread_bps=48.0,
            shock_type="SPREAD_BLOWOUT",
            news_headline="SEC Exchange Ruling"
        )
        # Must achieve at least 95% token savings compared to continuous cloud LLM
        self.assertGreaterEqual(audit['token_reduction_pct'], 95.0)

    # 14. System 2 Micro-Telegraphic Word Limit
    def test_system2_micro_telegraphic_word_limit(self):
        explanation = System2SemanticCoPilot.generate_micro_telegraphic_explanation(
            symbol="BTC",
            price=91500.0,
            spread_bps=12.0,
            shock_type="VOLATILITY_SHOCK",
            news_headline="Whale Inflow to Binance Derivatives"
        )
        words = explanation['micro_telegraphic_hud'].split()
        # Strictly enforce <= 14 words so user peripheral vision is never obstructed
        self.assertLessEqual(len(words), 14)

    # 15. Telegram Bridge HMAC Signature
    def test_telegram_bridge_hmac_signature(self):
        alert = TelegramHUDBridge.create_telegram_alert(
            symbol="SOL",
            event_type="CIRCUIT_BREAKER_TRIP",
            details="Spread blowout: 42bps",
            active_battery_pct=94.5
        )
        self.assertIn('signature', alert)
        self.assertEqual(len(alert['signature']), 64)  # SHA256 hex is 64 chars
        self.assertIn("Even G2 OpticSentry Alert", alert['telegram_formatted_msg'])


if __name__ == '__main__':
    unittest.main()
