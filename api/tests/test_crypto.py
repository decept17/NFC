"""
Unit tests for the AES-CMAC SUN MAC verification utility.

Uses a synthetic test vector to verify correctness:
- AES-128 key:   00000000000000000000000000000000  (16 zero bytes)
- UID:           04AABBCCDDEEFF                   (7 bytes)
- Counter:       000001                            (tap 1, 3 bytes)
- Expected CMAC: Full 16-byte CMAC truncated to first 8 bytes

The test validates:
1. A correctly computed MAC is accepted
2. A wrong MAC is rejected
3. A replayed counter produces the right value (counter logic is in the API)
4. Malformed hex inputs return False safely
"""
import sys
import os

# Ensure we can import from the api/ root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.crypto import verify_sun_mac, counter_hex_to_int
from cryptography.hazmat.primitives.cmac import CMAC
from cryptography.hazmat.primitives.ciphers import algorithms
from cryptography.hazmat.backends import default_backend


def _make_test_cmac(uid_hex: str, counter_hex: str, key_hex: str) -> str:
    """Helper: compute the expected 8-byte truncated CMAC for a test case."""
    key     = bytes.fromhex(key_hex)
    message = bytes.fromhex(uid_hex) + bytes.fromhex(counter_hex)
    c = CMAC(algorithms.AES(key), backend=default_backend())
    c.update(message)
    full_cmac = c.finalize()
    return full_cmac[:8].hex()


class TestVerifySunMac:
    KEY     = "00000000000000000000000000000000"  # AES-128 zero key (32 hex chars)
    UID     = "04AABBCCDDEEFF"
    COUNTER = "000001"

    def test_valid_mac_accepted(self):
        """A correctly generated MAC should be accepted."""
        valid_cmac = _make_test_cmac(self.UID, self.COUNTER, self.KEY)
        assert verify_sun_mac(self.UID, self.COUNTER, valid_cmac, self.KEY) is True

    def test_wrong_mac_rejected(self):
        """A tampered MAC should be rejected."""
        assert verify_sun_mac(self.UID, self.COUNTER, "0000000000000000", self.KEY) is False

    def test_wrong_key_rejected(self):
        """A valid MAC computed with a different key should be rejected."""
        other_key  = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
        valid_cmac = _make_test_cmac(self.UID, self.COUNTER, self.KEY)
        assert verify_sun_mac(self.UID, self.COUNTER, valid_cmac, other_key) is False

    def test_wrong_uid_rejected(self):
        """A MAC for a different UID should be rejected."""
        valid_cmac = _make_test_cmac(self.UID, self.COUNTER, self.KEY)
        assert verify_sun_mac("FFFFFFFFFFFFFF", self.COUNTER, valid_cmac, self.KEY) is False

    def test_wrong_counter_rejected(self):
        """A MAC for a different counter value should be rejected."""
        valid_cmac = _make_test_cmac(self.UID, self.COUNTER, self.KEY)
        assert verify_sun_mac(self.UID, "000002", valid_cmac, self.KEY) is False

    def test_malformed_uid_hex_returns_false(self):
        """Malformed hex in uid should return False, not raise."""
        assert verify_sun_mac("ZZZZZZ", self.COUNTER, "0000000000000000", self.KEY) is False

    def test_malformed_cmac_hex_returns_false(self):
        """Malformed hex in cmac should return False, not raise."""
        assert verify_sun_mac(self.UID, self.COUNTER, "ZZZZZZZZZZZZZZZZ", self.KEY) is False

    def test_invalid_key_length_returns_false(self):
        """A key that isn't a valid AES size should return False."""
        assert verify_sun_mac(self.UID, self.COUNTER, "0000000000000000", "AABB") is False


class TestCounterHexToInt:
    def test_zero_counter(self):
        assert counter_hex_to_int("000000") == 0

    def test_first_tap(self):
        assert counter_hex_to_int("000001") == 1

    def test_tap_21(self):
        assert counter_hex_to_int("000015") == 21

    def test_large_counter(self):
        assert counter_hex_to_int("FFFFFF") == 16777215
