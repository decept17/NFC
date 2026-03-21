"""
SUN (Secure Unique NFC) MAC verification for NTAG 424 DNA chips.

NTAG 424 DNA uses AES-CMAC (RFC 4493) to generate a 8-byte truncated MAC
over the SUN message: UID bytes + counter bytes (little-endian).

The chip URL look like:
    https://api.n3xo.com/pay?uid=04AABBCCDDEE&c=000015&m=8A9BCD...

Where:
    - uid  = chip UID as uppercase hex (7 bytes → 14 hex chars)
    - c    = tap counter as 3-byte big-endian hex (e.g. "000015" == tap 21)
    - m    = truncated AES-CMAC of (UID || counter) as 8-byte hex (16 chars)

Security guarantee: without knowing the AES-128 auth_key, an attacker cannot
forge a valid MAC. Counter monotonically prevents replay attacks.
"""

import hmac
from cryptography.hazmat.primitives.cmac import CMAC
from cryptography.hazmat.primitives.ciphers import algorithms
from cryptography.hazmat.backends import default_backend


def _compute_aes_cmac(key_bytes: bytes, message_bytes: bytes) -> bytes:
    """Compute a full 16-byte AES-CMAC over message_bytes using key_bytes."""
    c = CMAC(algorithms.AES(key_bytes), backend=default_backend())
    c.update(message_bytes)
    return c.finalize()


def verify_sun_mac(uid_hex: str, counter_hex: str, cmac_hex: str, auth_key_hex: str) -> bool:
    """
    Verify the SUN MAC produced by an NTAG 424 DNA chip.

    Args:
        uid_hex:      Chip UID as a hex string (e.g. "04AABBCCDDEE80")
        counter_hex:  Tap counter as a hex string (e.g. "000015")
        cmac_hex:     MAC from the chip URL as a hex string (8 bytes = 16 hex chars)
        auth_key_hex: Secret AES-128 key stored for this tag (32 hex chars)

    Returns:
        True if the MAC is genuine, False otherwise.
    """
    try:
        key_bytes     = bytes.fromhex(auth_key_hex)
        uid_bytes     = bytes.fromhex(uid_hex)
        counter_bytes = bytes.fromhex(counter_hex)
        cmac_bytes    = bytes.fromhex(cmac_hex)
    except ValueError:
        # Malformed hex input — treat as invalid
        return False

    if len(key_bytes) not in (16, 24, 32):
        return False  # Must be a valid AES key size

    # SUN message = UID || counter (both in the byte order sent by the chip)
    message = uid_bytes + counter_bytes

    computed_cmac = _compute_aes_cmac(key_bytes, message)

    # NTAG 424 DNA sends 8 bytes (truncated from 16-byte full CMAC)
    truncated = computed_cmac[:8]

    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(truncated, cmac_bytes)


def counter_hex_to_int(counter_hex: str) -> int:
    """
    Convert the counter hex string from the chip URL to an integer.

    The counter in the URL is big-endian hex (e.g. "000015" == 21).
    """
    return int(counter_hex, 16)
