"""
Diagnostic: find the correct IV and plaintext layout for PICC Part 2 response.
Uses the exact bytes captured from the chip run.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

KEY      = bytes(16)
RNDA     = bytes.fromhex("CCB5C34E8E6E81E8E37CCD559472D50C")
ENC_RNDB = bytes.fromhex("B641037062F251DBFC07036AE15BAE47")
ENC_P2   = bytes.fromhex(
    "8E16B233D70645C80A6FC9B472AD6D4F"
    "6619B10931B0A0AA957A2BE992708D5A"
)
RESP2    = bytes.fromhex(
    "9B7819E7616B0D2607F58B479ABA2536"
    "AA47EEA02FB14F05FC442E39F57B0876"
)
EXPECTED = RNDA[1:] + RNDA[:1]   # rotL(RndA)

def dec_cbc(key, iv, data):
    c = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    d = c.decryptor()
    return d.update(data) + d.finalize()

def dec_ecb(key, data):
    c = Cipher(algorithms.AES(key), modes.ECB(), backend=default_backend())
    d = c.decryptor()
    return d.update(data) + d.finalize()

print(f"Expected rotL(RndA) = {EXPECTED.hex().upper()}\n")

# ── 1. Decrypt with enc_part2[-16:] as IV (current code) ──
dec_current = dec_cbc(KEY, ENC_P2[-16:], RESP2)
print(f"Current decode (iv=enc_p2 last): {dec_current.hex().upper()}")
print(f"  Searching for rotL(RndA) at every offset 0-16:")
for off in range(17):
    if dec_current[off:off+16] == EXPECTED:
        print(f"  ✅ FOUND at offset {off}!")
    else:
        print(f"   [{off:2d}]: {dec_current[off:off+16].hex().upper()}")

# ── 2. Also try decrypting just block 1 with ECB (no IV) ──
print(f"\nECB decrypt of resp2 block0: {dec_ecb(KEY, RESP2[:16]).hex().upper()}")
print(f"ECB decrypt of resp2 block1: {dec_ecb(KEY, RESP2[16:]).hex().upper()}")

# ── 3. Check: what if PICC response is only 16 bytes of meaningful data? ──
# Maybe only first 16 bytes (before the 16-byte filler) are real
print(f"\nresp2 block 0 raw: {RESP2[:16].hex().upper()}")
print(f"resp2 block 1 raw: {RESP2[16:].hex().upper()}")

# ── 4. Show what correct_IV must be ──
# correct_IV = AES_ECB_decrypt(cipher[0]) XOR expected_plain[0]
# where expected_plain[0] = TI(D00B7009) + rotL(RndA)[0:12]
expected_block0 = bytes.fromhex("D00B7009") + EXPECTED[:12]
aes_dec_block0 = dec_ecb(KEY, RESP2[:16])
correct_iv = bytes(a ^ b for a, b in zip(aes_dec_block0, expected_block0))
print(f"\nAnalytically derived correct IV = {correct_iv.hex().upper()}")
print(f"enc_part2[-16:]               = {ENC_P2[-16:].hex().upper()}")
print(f"enc_part2[ :16]               = {ENC_P2[:16].hex().upper()}")
print(f"enc_rndb                       = {ENC_RNDB.hex().upper()}")

