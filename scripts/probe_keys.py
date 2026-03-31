#!/usr/bin/env python3
"""Probe all session-key derivation combinations against a real chip."""
import struct, secrets, sys
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.cmac import CMAC
from cryptography.hazmat.backends import default_backend
from smartcard.System import readers
from smartcard.Exceptions import NoCardException

# ── Crypto helpers ──────────────────────────────────────────────────

def aes_enc(key, iv, data):
    c = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    return c.encryptor().update(data) + c.encryptor().finalize()

def aes_dec(key, iv, data):
    c = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    d = c.decryptor()
    return d.update(data) + d.finalize()

def aes_cmac(key, msg):
    c = CMAC(algorithms.AES(key), backend=default_backend())
    c.update(msg)
    return c.finalize()

def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

def rotate_left(b):
    return b[1:] + b[:1]

def truncate_mac(full_mac):
    return bytes(full_mac[i] for i in range(1, 16, 2))

def calc_cmd_mac(mac_key, cmd, ctr, ti, header, data):
    msg = bytes([cmd]) + struct.pack('<H', ctr) + ti + header + data
    return truncate_mac(aes_cmac(mac_key, msg))

# ── APDU helper ─────────────────────────────────────────────────────

def tx(conn, apdu, label=""):
    data, sw1, sw2 = conn.transmit(apdu)
    sw = (sw1 << 8) | sw2
    resp = bytes(data)
    pad = " " * max(0, 50 - len(label))
    print(f"  {label}{pad}SW={sw:04X}")
    return resp, sw

# ── Session key derivation combos ──────────────────────────────────

def make_sv(prefix, ra, rb, msb_first):
    if msb_first:
        return (prefix
                + ra[0:2]
                + xor_bytes(ra[2:8], rb[0:6])
                + rb[6:16]
                + ra[8:16])
    else:
        return (prefix
                + ra[14:16]
                + xor_bytes(ra[8:14], rb[10:16])
                + rb[0:10]
                + ra[0:8])

# ── Main probe ──────────────────────────────────────────────────────

def do_auth(conn, root_key):
    """Perform full auth, return (ti, rnda, chip_rnda, rndb, enc_rndb) or None."""
    # Select app
    NTAG424_AID = [0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01]
    _, sw = tx(conn, [0x00, 0xA4, 0x04, 0x00, 0x07] + NTAG424_AID + [0x00], "SELECT")
    if sw != 0x9000:
        return None

    # Auth P1
    resp, sw = tx(conn, [0x90, 0x71, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00], "Auth P1")
    if sw != 0x91AF:
        return None

    enc_rndb = resp[:16]
    rndb = aes_dec(root_key, bytes(16), enc_rndb)
    rnda = secrets.token_bytes(16)

    # Auth P2
    enc_p2 = aes_enc(root_key, enc_rndb, rnda + rotate_left(rndb))
    apdu = [0x90, 0xAF, 0x00, 0x00, len(enc_p2)] + list(enc_p2) + [0x00]
    resp2, sw2 = tx(conn, apdu, "Auth P2")
    if sw2 != 0x9100:
        return None

    # Decrypt response with IV=0
    decrypted = aes_dec(root_key, bytes(16), resp2[:32])
    ti = decrypted[0:4]
    rotl = decrypted[4:20]
    chip_rnda = rotl[-1:] + rotl[:-1]

    return ti, rnda, chip_rnda, rndb, enc_rndb

def main():
    root_key = bytes(16)
    rdrs = readers()
    if not rdrs:
        print("No readers found!")
        return 1
    conn = rdrs[0].createConnection()
    conn.connect()

    combos = [
        # (label, use_chip_rnda, msb_first, sv1_is_mac)
        ("chip MSB sv1=MAC", True, True, True),
        ("chip MSB sv1=ENC", True, True, False),
        ("chip LSB sv1=MAC", True, False, True),
        ("chip LSB sv1=ENC", True, False, False),
        ("orig MSB sv1=MAC", False, True, True),
        ("orig MSB sv1=ENC", False, True, False),
        ("orig LSB sv1=MAC", False, False, True),
        ("orig LSB sv1=ENC", False, False, False),
    ]

    print("=" * 60)
    print("  Session Key Derivation Probe")
    print("=" * 60)

    for label, use_chip, msb, sv1_mac in combos:
        print(f"\n--- {label} ---")
        result = do_auth(conn, root_key)
        if result is None:
            print("  Auth failed!")
            continue

        ti, rnda, chip_rnda, rndb, enc_rndb = result
        ra = chip_rnda if use_chip else rnda

        sv1 = make_sv(b'\xA5\x5A\x00\x01\x00\x80', ra, rndb, msb)
        sv2 = make_sv(b'\x5A\xA5\x00\x01\x00\x80', ra, rndb, msb)

        if sv1_mac:
            mac_key = aes_cmac(root_key, sv1)
            enc_key = aes_cmac(root_key, sv2)
        else:
            enc_key = aes_cmac(root_key, sv1)
            mac_key = aes_cmac(root_key, sv2)

        print(f"  TI={ti.hex().upper()}")
        print(f"  ra={ra.hex().upper()}")
        print(f"  enc={enc_key.hex().upper()}")
        print(f"  mac={mac_key.hex().upper()}")

        # Test: GetFileSettings for file 02 with MAC
        file_no = bytes([0x02])
        mac_val = calc_cmd_mac(mac_key, 0xF5, 0, ti, file_no, b'')
        payload = file_no + mac_val
        data, sw = tx(conn, [0x90, 0xF5, 0x00, 0x00, len(payload)] + list(payload) + [0x00], "GFS with MAC")

        if sw == 0x9100:
            print(f"  *** SUCCESS! Combo: {label} ***")
            print(f"  Response: {data.hex().upper()}")
            return 0
        else:
            print(f"  Failed: SW={sw:04X}")

    print("\n--- No combination worked ---")
    return 1

sys.exit(main())
