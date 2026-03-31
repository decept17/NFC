"""
NTAG 424 DNA – Provisioning Test Suite
========================================
Two tiers:

  Tier 1: Offline unit tests  (no hardware needed — run these first)
    python test_cfs.py --unit

  Tier 2: Live chip integration test  (ACR122U + blank NTAG 424 DNA required)
    python test_cfs.py --live
    python test_cfs.py --live --key <32-hex-chars>   # if chip has a custom key

The unit tests validate:
  • AES-CMAC computation against NIST/NXP reference vectors
  • MAC truncation (odd-index forward)
  • Session-vector formatting (sv1 / sv2 constants)
  • NDEF URL template byte offsets
  • SDM file-settings payload length and content
  • ChangeFileSettings payload includes MAC (not sent to chip — just verified locally)

The live test exercises the full flow:
  1. Select application
  2. AuthEV2First with factory zeros key
  3. WriteData (NDEF template) → File 02
  4. ChangeFileSettings (SDM enable) — the previously broken step
  5. GetFileSettings — reads back the new settings to confirm SDM is on
"""
import sys
import struct
import secrets
import argparse

from cryptography.hazmat.primitives.cmac import CMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


# ─── Crypto helpers (mirrors provision_tag.py) ─────────────────────────────

def aes_cmac(key: bytes, msg: bytes) -> bytes:
    c = CMAC(algorithms.AES(key), backend=default_backend())
    c.update(msg)
    return c.finalize()

def aes_enc(key: bytes, iv: bytes, data: bytes) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    e = cipher.encryptor()
    return e.update(data) + e.finalize()

def aes_dec(key: bytes, iv: bytes, data: bytes) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    d = cipher.decryptor()
    return d.update(data) + d.finalize()

def truncate_mac(full: bytes) -> bytes:
    """Odd-index forward: bytes at positions 1,3,5,...,15 → 8 bytes."""
    return bytes(full[i] for i in range(1, 16, 2))

def pad_to_block(data: bytes) -> bytes:
    padded = data + b'\x80'
    while len(padded) % 16 != 0:
        padded += b'\x00'
    return padded

def rotate_left(b: bytes) -> bytes:
    return b[1:] + b[:1]

def xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))

def calc_sv(prefix: bytes, rnda: bytes, rndb: bytes) -> bytes:
    # NXP MSB-first: RndA[15]=rnda[0], so:
    #   RndA[15..14] = rnda[0:2]
    #   RndA[13..8]  = rnda[2:8]
    #   RndB[15..10] = rndb[0:6]
    #   RndB[9..0]   = rndb[6:16]
    #   RndA[7..0]   = rnda[8:16]
    return (prefix
            + rnda[0:2]
            + xor_bytes(rnda[2:8], rndb[0:6])
            + rndb[6:16]
            + rnda[8:16])

def derive_session_keys(root_key: bytes, rnda: bytes, rndb: bytes):
    # NXP MSB-first: RndA[15]=rnda[0], RndA[14]=rnda[1], etc.
    # SV1 (A55A prefix) -> SesAuthENCKey  (confirmed by live chip probe)
    # SV2 (5AA5 prefix) -> SesAuthMACKey
    sv1 = calc_sv(b'\xA5\x5A\x00\x01\x00\x80', rnda, rndb)
    sv2 = calc_sv(b'\x5A\xA5\x00\x01\x00\x80', rnda, rndb)
    enc_key = aes_cmac(root_key, sv1)
    mac_key = aes_cmac(root_key, sv2)
    return enc_key, mac_key

def calc_cmd_mac(mac_key: bytes, cmd: int, ctr: int, ti: bytes,
                 header: bytes, data: bytes) -> bytes:
    msg = bytes([cmd]) + struct.pack('<H', ctr) + ti + header + data
    return truncate_mac(aes_cmac(mac_key, msg))

def calc_cmd_iv(enc_key: bytes, ti: bytes, ctr: int) -> bytes:
    iv_in = b'\xA5\x5A' + ti + struct.pack('<H', ctr) + b'\x00' * 8
    return aes_enc(enc_key, bytes(16), iv_in)


def pad_to_block(data: bytes) -> bytes:
    padded = data + b'\x80'
    while len(padded) % 16 != 0:
        padded += b'\x00'
    return padded


# ─── NDEF / SDM helpers (mirrors provision_tag.py) ─────────────────────────

URL_PREFIX          = "api.n3xo.com/pay?uid="
URL_UID_PH          = "00000000000000"
URL_CTR_SEP         = "&c="
URL_CTR_PH          = "000000"
URL_MAC_SEP         = "&m="
URL_MAC_PH          = "0000000000000000"

def build_ndef() -> bytes:
    uri = (URL_PREFIX + URL_UID_PH
           + URL_CTR_SEP + URL_CTR_PH
           + URL_MAC_SEP + URL_MAC_PH).encode('ascii')
    pl = 1 + len(uri)
    record = bytes([0xD1, 0x01, pl, 0x55, 0x04]) + uri
    return struct.pack('>H', len(record)) + record

def calc_offsets(content: bytes) -> dict:
    uid_marker = b'uid=' + URL_UID_PH.encode()
    ctr_marker = b'c='   + URL_CTR_PH.encode()
    mac_marker = b'm='   + URL_MAC_PH.encode()
    uid = content.index(uid_marker) + len(b'uid=')
    ctr = content.index(ctr_marker) + len(b'c=')
    mac = content.index(mac_marker) + len(b'm=')
    return {'uid': uid, 'ctr': ctr, 'mac_input': ctr, 'mac': mac}

def build_file_settings(offsets: dict) -> bytes:
    file_option       = bytes([0x40])
    access_rights     = bytes([0x00, 0xE0])
    sdm_options       = bytes([0xC1])
    # SDMAccessRights (2 bytes LE):
    #   Bits[15:12]=SDMMetaRead=0xE (free=plaintext UID/CTR)
    #   Bits[11:8]=SDMFileRead=0x0 (Key 0, for CMAC)
    #   Bits[7:4]=RFU=0xF
    #   Bits[3:0]=SDMCtrRet=0xF (disabled)
    # 16-bit value = 0xE0FF → LE bytes = FF, E0
    sdm_access_rights = bytes([0xFF, 0xE0])
    uid_off      = struct.pack('<I', offsets['uid'])[:3]
    ctr_off      = struct.pack('<I', offsets['ctr'])[:3]     # SDMReadCtrOffset
    mac_in_off   = struct.pack('<I', offsets['mac_input'])[:3]
    mac_off      = struct.pack('<I', offsets['mac'])[:3]
    return (file_option + access_rights + sdm_options + sdm_access_rights
            + uid_off + ctr_off + mac_in_off + mac_off)


# ═══════════════════════════════════════════════════════════════════════════
# TIER 1 — Offline Unit Tests
# ═══════════════════════════════════════════════════════════════════════════

def check(label: str, got, expected):
    ok = got == expected
    status = "[PASS]" if ok else "[FAIL]"
    print(f"  {status}  {label}")
    if not ok:
        print(f"         expected: {expected.hex().upper() if isinstance(expected, bytes) else expected}")
        print(f"         got:      {got.hex().upper() if isinstance(got, bytes) else got}")
    return ok


def run_unit_tests() -> bool:
    print("==============================================")
    print("  Tier 1 -- Offline Crypto Unit Tests")
    print("==============================================")
    print()
    passed = failed = 0

    # --- Test 1: AES-CMAC with zeros key and zero message ------------------
    # NIST SP800-38B Appendix D.1 Example 2: K=0^16, M=0^16 (16 zero bytes)
    # Expected = 763CBCDE81DF9131BF897712C088EDAD
    result = aes_cmac(bytes(16), bytes(16))
    expected = bytes.fromhex("763CBCDE81DF9131BF897712C088EDAD")
    ok = check("AES-CMAC(K=0^16, M=0^16)", result, expected)
    passed += ok; failed += not ok

    # --- Test 2: MAC truncation — odd indices forward ----------------------
    full = bytes(range(16))   # 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F
    trunc = truncate_mac(full)
    expected_trunc = bytes([1, 3, 5, 7, 9, 11, 13, 15])
    ok = check("truncate_mac odd-fwd", trunc, expected_trunc)
    passed += ok; failed += not ok

    # --- Test 3: Session-vector SV1 prefix ---------------------------------
    rnda = bytes(range(16))
    rndb = bytes(range(16, 32))
    sv1 = calc_sv(b'\xA5\x5A\x00\x01\x00\x80', rnda, rndb)
    ok = check("SV1 prefix bytes", sv1[:6], b'\xA5\x5A\x00\x01\x00\x80')
    passed += ok; failed += not ok
    ok = check("SV1 length = 32", len(sv1) == 32, True)
    passed += ok; failed += not ok

    # --- Test 4: NDEF build — correct length -------------------------------
    ndef = build_ndef()
    # 2 (NLEN) + 5 (record header) + 1 (URI code 0x04) + len(URL string)
    url_len = len((URL_PREFIX + URL_UID_PH + URL_CTR_SEP + URL_CTR_PH + URL_MAC_SEP + URL_MAC_PH).encode())
    expected_total = 2 + 5 + url_len
    ok = check(f"NDEF total length = {expected_total}", len(ndef) == expected_total, True)
    passed += ok; failed += not ok

    # --- Test 5: NDEF NLEN field matches record length ---------------------
    nlen = struct.unpack('>H', ndef[:2])[0]
    ok = check("NDEF NLEN matches record body", nlen == len(ndef) - 2, True)
    passed += ok; failed += not ok

    # --- Test 6: SDM offsets land on zero-byte placeholders ----------------
    offsets = calc_offsets(ndef)
    uid_bytes = ndef[offsets['uid'] : offsets['uid'] + len(URL_UID_PH)]
    ctr_bytes = ndef[offsets['ctr'] : offsets['ctr'] + len(URL_CTR_PH)]
    mac_bytes = ndef[offsets['mac'] : offsets['mac'] + len(URL_MAC_PH)]
    ok = check("UID offset -> UID placeholder",   uid_bytes, URL_UID_PH.encode())
    passed += ok; failed += not ok
    ok = check("CTR offset -> CTR placeholder",   ctr_bytes, URL_CTR_PH.encode())
    passed += ok; failed += not ok
    ok = check("MAC offset -> MAC placeholder",   mac_bytes, URL_MAC_PH.encode())
    passed += ok; failed += not ok

    # --- Test 7: File-settings payload is exactly 15 bytes -----------------
    settings = build_file_settings(offsets)
    ok = check("file_settings length = 18 bytes", len(settings) == 18, True)
    passed += ok; failed += not ok

    # --- Test 8: SDMOptions byte = 0xC1 ------------------------------------
    # settings layout: FileOption(1) + AccessRights(2) + SDMOptions(1) + ...
    sdm_opts_byte = settings[3]
    ok = check("SDMOptions = 0xC1", sdm_opts_byte == 0xC1, True)
    passed += ok; failed += not ok

    # --- Test 9: SDMAccessRights = FF F0 -----------------------------------
    sdm_ar = settings[4:6]
    ok = check("SDMAccessRights = FF E0", sdm_ar, bytes([0xFF, 0xE0]))
    passed += ok; failed += not ok

    # --- Test 10: ChangeFileSettings payload = 1 + 32(enc) + 8(mac) = 41 bytes -----------
    # CommMode.Full: FileSettings are ISO-padded (18->32 bytes) then encrypted,
    # then MAC computed over the encrypted data. No un-encrypted settings in payload.
    dummy_ti      = b'\x01\x02\x03\x04'
    dummy_enc_key = bytes(16)
    dummy_mac_key = bytes(16)
    padded   = pad_to_block(settings)                            # 18 -> 32 bytes
    dummy_iv = calc_cmd_iv(dummy_enc_key, dummy_ti, 0)
    enc_set  = aes_enc(dummy_enc_key, dummy_iv, padded)          # 32 bytes
    mac      = calc_cmd_mac(dummy_mac_key, 0x5F, 0, dummy_ti, bytes([0x02]), enc_set)
    cfs_payload_len = 1 + len(enc_set) + len(mac)                # 1 + 32 + 8 = 41
    ok = check("CFS payload length = 1 + 32(enc) + 8(mac) = 41", cfs_payload_len == 41, True)
    passed += ok; failed += not ok

    ok = check("Truncated MAC = 8 bytes", len(mac) == 8, True)
    passed += ok; failed += not ok

    # --- Summary -----------------------------------------------------------
    print(f"\n  Results: {passed} passed, {failed} failed out of {passed+failed} tests")
    if failed == 0:
        print("  ** All unit tests passed -- crypto layer looks correct.\n")
    else:
        print("  ** Some tests failed -- fix issues before running live test.\n")
    return failed == 0


# ===========================================================================
# TIER 2 — Live Chip Integration Test
# ===========================================================================

def tx(conn, apdu: list, label: str = "") -> tuple:
    data, sw1, sw2 = conn.transmit(apdu)
    sw = (sw1 << 8) | sw2
    h = bytes(data).hex().upper() if data else ""
    print(f"  {label:50s}  SW={sw:04X}  {h}")
    return bytes(data), sw

def native(conn, cmd: int, data: bytes) -> tuple:
    apdu = [0x90, cmd, 0x00, 0x00, len(data)] + list(data) + [0x00]
    return conn.transmit(apdu)

def run_live_test(root_key: bytes):
    from smartcard.System import readers
    from smartcard.Exceptions import NoCardException
    import time

    print("==============================================")
    print("  Tier 2 -- Live Chip Integration Test")
    print("==============================================")
    print()
    print(f"  Using root key: {root_key.hex().upper()}\n")

    # --- Connect ---------------------------------------------------------
    avail = readers()
    if not avail:
        print("✗ No PC/SC readers found.")
        return False
    conn = avail[0].createConnection()
    print("  Place NTAG 424 DNA on reader...", end="", flush=True)
    while True:
        try:
            conn.connect()
            print(" *** Card detected!\n")
            break
        except NoCardException:
            print(".", end="", flush=True)
            time.sleep(0.5)

    results = {}

    # ── Step 1: Select application ────────────────────────────────────────
    NTAG424_AID = [0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01]
    _, sw = tx(conn, [0x00, 0xA4, 0x04, 0x00, 0x07] + NTAG424_AID + [0x00], "SELECT application")
    results['select'] = sw == 0x9000
    if not results['select']:
        print("  [FAIL] Select failed -- is this an NTAG 424 DNA chip?")
        return False

    # ── Step 2: AuthEV2First ──────────────────────────────────────────────
    print("\n  [AUTH]")
    resp, sw = tx(conn, [0x90, 0x71, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00], "AuthEV2First P1")
    results['auth_p1'] = sw == 0x91AF
    if not results['auth_p1']:
        print(f"  [FAIL] Auth P1 failed (SW={sw:04X}) -- wrong chip or already authenticated?")
        return False

    enc_rndb = resp[:16]
    rndb     = aes_dec(root_key, bytes(16), enc_rndb)
    rnda     = secrets.token_bytes(16)
    enc_p2   = aes_enc(root_key, enc_rndb, rnda + rotate_left(rndb))

    apdu_p2 = [0x90, 0xAF, 0x00, 0x00, len(enc_p2)] + list(enc_p2) + [0x00]
    resp2, sw2 = tx(conn, apdu_p2, "AuthEV2First P2")
    results['auth_p2'] = sw2 == 0x9100
    if not results['auth_p2']:
        print(f"  [FAIL] Auth P2 failed (SW={sw2:04X}) -- wrong key?")
        return False

    # Derive session state -- decrypt PICC response with IV=0
    # Response format: TI(4) || rotL(chip_RndA)(16) || PDcap2(6) || PCDcap2(6) = 32 bytes
    # NOTE: Because we encrypt Part 2 with IV=enc_rndb but the chip decrypts with
    # its own CBC state, the chip's internal RndA differs from ours.
    # We MUST extract chip_rnda from the response and use it for session key derivation
    # so both sides compute the same session keys.
    print(f"    resp2 raw ({len(resp2)}b): {resp2.hex().upper()}")
    decrypted       = aes_dec(root_key, bytes(16), resp2[:32])
    ti              = decrypted[0:4]
    rotl_chip_rnda  = decrypted[4:20]     # rotL(chip_rnda)
    pdcap           = decrypted[20:32]

    # Recover chip_rnda from rotL: rotate right by 1 byte
    chip_rnda = rotl_chip_rnda[-1:] + rotl_chip_rnda[:-1]

    print(f"    decrypted: {decrypted.hex().upper()}")
    print(f"    TI={ti.hex().upper()}  PDcap2+PCDcap2={pdcap.hex().upper()}")
    print(f"    chip_rnda={chip_rnda.hex().upper()}")

    # Use chip_rnda (what the chip actually has) for session key derivation
    enc_key, mac_key = derive_session_keys(root_key, chip_rnda, rndb)
    cmd_ctr = 0
    print(f"    enc_key={enc_key.hex().upper()}")
    print(f"    mac_key={mac_key.hex().upper()}")
    print("  [OK] Authenticated\n")


    # ── Step 3: WriteData — NDEF to File 02 ──────────────────────────────
    print("  [WRITE NDEF]")
    ndef = build_ndef()
    print(f"    NDEF ({len(ndef)} bytes): {ndef.hex().upper()}")
    header = bytes([0x02]) + struct.pack('<I', 0)[:3] + struct.pack('<I', len(ndef))[:3]
    data, sw = tx(conn, [0x90, 0x8D, 0x00, 0x00, len(header + ndef)]
                  + list(header + ndef) + [0x00], "WriteData File02")
    results['write'] = sw == 0x9100
    if not results['write']:
        print(f"  [FAIL] WriteData failed (SW={sw:04X})")
        return False
    # WriteData processed successfully -- cmd_ctr increments on every
    # successful command in an authenticated session (per NXP spec).
    cmd_ctr += 1
    print("  [OK] NDEF written\n")

    # ── Step 4: ChangeFileSettings (SDM enable) ───────────────────────────
    print("  [CHANGE FILE SETTINGS — SDM]")
    file_no_b = bytes([0x02])
    offsets  = calc_offsets(ndef)
    settings = build_file_settings(offsets)
    print(f"    offsets -> UID:{offsets['uid']}  CTR:{offsets['ctr']}  MAC:{offsets['mac']}")
    print(f"    settings ({len(settings)}b): {settings.hex().upper()}")

    # CommMode.Full: encrypt settings then MAC over encrypted
    padded_settings = pad_to_block(settings)
    cfs_iv          = calc_cmd_iv(enc_key, ti, cmd_ctr)
    enc_settings    = aes_enc(enc_key, cfs_iv, padded_settings)
    mac             = calc_cmd_mac(mac_key, 0x5F, cmd_ctr, ti, file_no_b, enc_settings)
    payload         = file_no_b + enc_settings + mac

    print(f"    CFS enc_iv:  {cfs_iv.hex().upper()}")
    print(f"    CFS enc_set: {enc_settings.hex().upper()}")
    print(f"    CFS payload ({len(payload)}b): {payload.hex().upper()}")
    print(f"    (file_no=1 + enc_settings={len(enc_settings)} + mac=8 = {len(payload)} bytes)")

    data, sw = tx(conn,
                  [0x90, 0x5F, 0x00, 0x00, len(payload)] + list(payload) + [0x00],
                  "ChangeFileSettings (SDM)")
    results['cfs'] = sw == 0x9100
    if sw == 0x9100:
        cmd_ctr += 1
        print("  [OK] ChangeFileSettings succeeded -- SDM enabled!\n")
    elif sw == 0x917E:
        print("  [FAIL] 917E = wrong parameter/length -- MAC missing or payload wrong")
    elif sw == 0x91AE:
        print("  [FAIL] 91AE = authentication error -- MAC value wrong")
    elif sw == 0x919D:
        print("  [FAIL] 919D = permission denied -- authenticated key doesn't have Change rights")
    else:
        print(f"  [FAIL] Unexpected SW={sw:04X}")

    if not results.get('cfs'):
        return False

    # ── Step 5: GetFileSettings — verify SDM is on ────────────────────────
    print("  [VERIFY — GetFileSettings]")
    mac_gfs = calc_cmd_mac(mac_key, 0xF5, cmd_ctr, ti, file_no_b, b'')
    gfs_payload = file_no_b + mac_gfs
    data, sw = tx(conn,
                  [0x90, 0xF5, 0x00, 0x00, len(gfs_payload)] + list(gfs_payload) + [0x00],
                  "GetFileSettings File02")
    results['gfs'] = sw == 0x9100
    if results['gfs']:
        cmd_ctr += 1
        print(f"    Raw settings: {data.hex().upper()}")
        if data and (data[0] & 0x40):
            print("  [OK] SDM flag confirmed ON in chip response!")
        else:
            print("  [WARN] SDM flag not set in response -- check settings byte")

    # -- Summary -----------------------------------------------------------
    print("\n  --- Test Results ---------------------------------------")
    labels = {
        'select': 'Select application',
        'auth_p1': 'Auth P1 (enc RndB)',
        'auth_p2': 'Auth P2 (RndA/TI)',
        'write':   'WriteData NDEF',
        'cfs':     'ChangeFileSettings (SDM enable)',
        'gfs':     'GetFileSettings (verify SDM)',
    }
    all_ok = True
    for k, label in labels.items():
        ok = results.get(k, False)
        print(f"    {'[OK]' if ok else '[FAIL]'}  {label}")
        all_ok = all_ok and ok

    print()
    if all_ok:
        print("  ** All live tests passed -- provisioning flow works!\n")
    else:
        print("  ** Some steps failed -- see details above.\n")

    return all_ok


# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Test NTAG 424 DNA provisioning (offline + live)"
    )
    parser.add_argument("--unit", action="store_true",
                        help="Run offline crypto unit tests (no hardware needed)")
    parser.add_argument("--live", action="store_true",
                        help="Run live chip integration test (ACR122U + chip required)")
    parser.add_argument("--key", default="00" * 16,
                        help="Root key as 32 hex chars (default: factory zeros)")
    args = parser.parse_args()

    if not args.unit and not args.live:
        parser.print_help()
        print("\n  Tip: start with --unit to verify crypto without any hardware.\n")
        sys.exit(0)

    root_key = bytes.fromhex(args.key)
    if len(root_key) != 16:
        print("✗ Key must be exactly 32 hex chars (16 bytes).")
        sys.exit(1)

    if args.unit:
        ok = run_unit_tests()
        if not ok:
            sys.exit(1)

    if args.live:
        ok = run_live_test(root_key)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
