"""
SUN (Secure Unique NFC) MAC verification for NTAG 424 DNA chips.

NTAG 424 DNA uses AES-CMAC with a session-derived MAC key to generate
an 8-byte truncated MAC that's mirrored into the NDEF URL.

The chip URL looks like:
    https://api.n3xo.com/pay?uid=04AABBCCDDEE&c=000015&m=8A9BCD...

Verification follows AN12196 §9.6:
  1. Derive SesSDMFileReadMAC key from the stored auth_key (SDMFileReadKey)
  2. Compute CMAC over the MAC input data
  3. Truncate using odd-byte selection (bytes at indices 1,3,5,...,15)

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


def _truncate_mac(full_mac: bytes) -> bytes:
    """NTAG 424 DNA MAC truncation — take bytes at odd indices (1,3,5,...,15)."""
    return bytes(full_mac[i] for i in range(1, 16, 2))


def _derive_sdm_file_read_mac_key(
    sdm_file_read_key: bytes, uid_bytes: bytes, counter_bytes: bytes
) -> bytes:
    """
    Derive SesSDMFileReadMAC key per AN12196.

    The session MAC key is: CMAC(SDMFileReadKey, derivation_input)
    where derivation_input = label(2) || counter(2) || len(2) || UID(7) || SDMReadCtr(3)
        label   = 0x3CC3  (MAC derivation)
        counter = 0x0001  (fixed)
        len     = 0x0080  (128 bits)
    """
    # SDMReadCtr in the URL is big-endian hex but on the chip it's 3-byte LE
    # The counter_bytes here are already the raw bytes from hex parsing
    # We need them as 3-byte little-endian for the derivation
    ctr_int = int.from_bytes(counter_bytes, byteorder='big')
    ctr_le = ctr_int.to_bytes(3, byteorder='little')

    sv = (b'\x3C\xC3'          # Label for MAC key derivation
          + b'\x00\x01'        # Counter (fixed)
          + b'\x00\x80'        # Key length (128 bits)
          + uid_bytes          # UID (7 bytes)
          + ctr_le)            # SDMReadCtr (3 bytes LE)

    # SV is exactly 16 bytes — no padding needed
    # 2(label) + 2(counter) + 2(length) + 7(UID) + 3(SDMReadCtr) = 16

    return _compute_aes_cmac(sdm_file_read_key, sv)


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
        return False

    if len(key_bytes) != 16:
        return False

    # Step 1: Derive the session MAC key (SesSDMFileReadMAC)
    session_mac_key = _derive_sdm_file_read_mac_key(key_bytes, uid_bytes, counter_bytes)

    # Step 2: Compute CMAC over the SDM MAC input data
    # The chip computes the MAC over file data from SDMMACInputOffset to SDMMACOffset.
    # In our NDEF layout this is: counter_ascii + "&m=" separator
    # The counter_hex from the URL is the exact ASCII at that position.
    sdm_mac_input = (counter_hex + "&m=").encode('ascii')
    computed_cmac = _compute_aes_cmac(session_mac_key, sdm_mac_input)

    # Step 3: Truncate using odd-byte selection
    truncated = _truncate_mac(computed_cmac)

    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(truncated, cmac_bytes)


def counter_hex_to_int(counter_hex: str) -> int:
    """
    Convert the counter hex string from the chip URL to an integer.

    The counter in the URL is big-endian hex (e.g. "000015" == 21).
    """
    return int(counter_hex, 16)

