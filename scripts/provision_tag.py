#!/usr/bin/env python3
"""
NTAG 424 DNA — Desktop Chip Provisioning Script (ACR122U)
=========================================================
Provisions blank NTAG 424 DNA chips for the N3XO payment system.

What this script does:
  1. Connects to an ACR122U USB reader via PC/SC
  2. Selects the NTAG 424 DNA application
  3. Authenticates with Key 0 (factory zeros for new chips)
  4. Writes a SUN NDEF URL template to File 02
  5. Enables SDM (UID + Counter + MAC mirroring) via ChangeFileSettings
  6. Changes Key 0 to a unique random AES-128 auth key
  7. Registers the chip + auth key with the N3XO backend

Prerequisites:
  pip install pyscard cryptography requests

Usage:
  python provision_tag.py --api-url http://localhost:8000 --admin-key your-key

Reference: NXP AN12196 — NTAG 424 DNA and NTAG 424 DNA TagTamper
"""

import os
import sys
import struct
import secrets
import argparse
import requests

from smartcard.System import readers
from smartcard.util import toHexString
from cryptography.hazmat.primitives.cmac import CMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


# ─── Constants ───────────────────────────────────────────────────────────────

NTAG424_AID = [0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01]
DEFAULT_KEY  = bytes(16)  # Factory default: 16 zero bytes

# SUN URL template — the chip replaces the 0-placeholders with real values on tap
# Adjust the domain to match your deployment
URL_TEMPLATE_PREFIX = "api.n3xo.com/pay?uid="
URL_UID_PLACEHOLDER    = "00000000000000"      # 7-byte UID → 14 hex chars
URL_CTR_SEP            = "&c="
URL_CTR_PLACEHOLDER    = "000000"              # 3-byte counter → 6 hex chars
URL_MAC_SEP            = "&m="
URL_MAC_PLACEHOLDER    = "0000000000000000"    # 8-byte MAC → 16 hex chars


# ─── Low-level Crypto Helpers ────────────────────────────────────────────────

def aes_cmac(key: bytes, message: bytes) -> bytes:
    """Compute full 16-byte AES-CMAC."""
    c = CMAC(algorithms.AES(key), backend=default_backend())
    c.update(message)
    return c.finalize()


def aes_encrypt_cbc(key: bytes, iv: bytes, data: bytes) -> bytes:
    """AES-CBC encrypt (no padding — data must be multiple of 16)."""
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    enc = cipher.encryptor()
    return enc.update(data) + enc.finalize()


def aes_decrypt_cbc(key: bytes, iv: bytes, data: bytes) -> bytes:
    """AES-CBC decrypt (no padding)."""
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    dec = cipher.decryptor()
    return dec.update(data) + dec.finalize()


def truncate_mac(full_mac: bytes) -> bytes:
    """NTAG 424 DNA MAC truncation — take bytes at odd indices (1,3,5,...,15)."""
    return bytes(full_mac[i] for i in range(1, 16, 2))


def rotate_left(data: bytes) -> bytes:
    """Rotate byte array left by 1 byte."""
    return data[1:] + data[:1]


def xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def pad_to_block(data: bytes, block_size: int = 16) -> bytes:
    """Pad with 0x80 then zeros to next block boundary."""
    padded = data + b'\x80'
    while len(padded) % block_size != 0:
        padded += b'\x00'
    return padded


# ─── NTAG 424 DNA Interface ─────────────────────────────────────────────────

class NTAG424DNA:
    """NTAG 424 DNA communication via PC/SC reader."""

    def __init__(self, connection):
        self.conn = connection
        # Session state (populated after successful auth)
        self.session_enc_key = None
        self.session_mac_key = None
        self.ti = None
        self.cmd_counter = 0

    # ── APDU helpers ──

    def _transmit(self, apdu: list) -> tuple[bytes, int]:
        """Send APDU, return (response_data, status_word)."""
        data, sw1, sw2 = self.conn.transmit(apdu)
        sw = (sw1 << 8) | sw2
        return bytes(data), sw

    def _native_cmd(self, cmd: int, data: bytes = b'') -> tuple[bytes, int]:
        """Send a native NTAG 424 DNA command in ISO 7816-4 wrapping."""
        apdu = [0x90, cmd, 0x00, 0x00, len(data)] + list(data) + [0x00]
        return self._transmit(apdu)

    def _additional_frame(self, data: bytes = b'') -> tuple[bytes, int]:
        """Send an Additional Frame (0xAF) to continue a multi-part exchange."""
        apdu = [0x90, 0xAF, 0x00, 0x00, len(data)] + list(data) + [0x00]
        return self._transmit(apdu)

    # ── High-level commands ──

    def select_application(self):
        """Select the NTAG 424 DNA application by AID."""
        apdu = [0x00, 0xA4, 0x04, 0x00, 0x07] + NTAG424_AID + [0x00]
        data, sw = self._transmit(apdu)
        if sw != 0x9000:
            raise RuntimeError(f"ISOSelect failed — SW {sw:04X}")
        print("  ✓ Application selected")
        return data

    def authenticate_ev2_first(self, key_no: int, key: bytes):
        """
        EV2 First Authentication (cmd 0x71).
        Establishes session keys TI, session_enc_key, session_mac_key.
        Reference: NTAG 424 DNA datasheet §9.2
        """
        # ── Part 1: get enc(RndB) from chip ──────────────────────────────────
        resp, sw = self._native_cmd(0x71, bytes([key_no, 0x00]))
        print(f"    [P1] SW={sw:04X} data={resp.hex().upper()}")
        if sw != 0x91AF:
            raise RuntimeError(f"AuthEV2First part 1 failed — SW {sw:04X}")

        enc_rndb = resp[:16]
        rndb     = aes_decrypt_cbc(key, bytes(16), enc_rndb)   # IV=0
        rnda     = secrets.token_bytes(16)
        print(f"    RndB={rndb.hex().upper()}  RndA={rnda.hex().upper()}")

        # ── Part 2: send enc(RndA || rotL(RndB)), IV = enc_rndb ──────────────
        plaintext = rnda + rotate_left(rndb)
        enc_part2 = aes_encrypt_cbc(key, enc_rndb, plaintext)
        print(f"    [P2 send] {enc_part2.hex().upper()}")

        resp2, sw2 = self._additional_frame(enc_part2)
        print(f"    [P2 recv] SW={sw2:04X} data({len(resp2)}b)={resp2.hex().upper()}")
        if sw2 != 0x9100:
            raise RuntimeError(f"AuthEV2First part 2 failed — SW {sw2:04X}")

        # ── Decrypt PICC response (AN12196 §9.3.1) ───────────────────────────
        # The PICC response = Enc(TI[4]||rotL(RndA')[16]||PDcap2[6]||PCDcap2[6])
        # Decrypt with IV=0 (confirmed empirically: PDcap2+PCDcap2 = 0x00*12).
        # NOTE: The chip's internal RndA (RndA') differs from our rnda due to the
        # CBC IV chaining during the Part 2 exchange. We MUST extract RndA' from
        # the response and use it for session key derivation.
        decrypted = aes_decrypt_cbc(key, bytes(16), resp2[:32])
        print(f"    dec={decrypted.hex().upper()}")

        self.ti         = decrypted[0:4]
        rotl_chip_rnda  = decrypted[4:20]     # rotL of chip's RndA
        # Recover chip_rnda: rotate right by 1 byte
        chip_rnda       = rotl_chip_rnda[-1:] + rotl_chip_rnda[:-1]

        print(f"    TI ={self.ti.hex().upper()}")
        print(f"    chip_rnda={chip_rnda.hex().upper()}")

        # ── Derive session keys (AN12196 §6.5) ───────────────────────────────
        # NXP byte numbering is MSB-first: RndA[15] = python index [0].
        # SV1 (prefix A55A) → SesAuthENCKey  (confirmed by live chip probe)
        # SV2 (prefix 5AA5) → SesAuthMACKey
        # Use chip_rnda (what the chip actually has) so both sides agree.
        sv1 = (b'\xA5\x5A\x00\x01\x00\x80'
               + chip_rnda[0:2]
               + xor_bytes(chip_rnda[2:8], rndb[0:6])
               + rndb[6:16]
               + chip_rnda[8:16])

        sv2 = (b'\x5A\xA5\x00\x01\x00\x80'
               + chip_rnda[0:2]
               + xor_bytes(chip_rnda[2:8], rndb[0:6])
               + rndb[6:16]
               + chip_rnda[8:16])

        self.session_enc_key = aes_cmac(key, sv1)   # SV1 → ENC key
        self.session_mac_key = aes_cmac(key, sv2)   # SV2 → MAC key
        self.cmd_counter     = 0

        print(f"  ✓ Authenticated (Key {key_no})")

    def _calc_cmd_mac(self, cmd_byte: int, cmd_header: bytes, cmd_data: bytes) -> bytes:
        """Calculate the truncated command MAC for an authenticated command."""
        mac_input = (bytes([cmd_byte])
                     + struct.pack('<H', self.cmd_counter)
                     + self.ti
                     + cmd_header
                     + cmd_data)
        full_mac = aes_cmac(self.session_mac_key, mac_input)
        return truncate_mac(full_mac)

    def _calc_cmd_iv(self) -> bytes:
        """Calculate the IV for command data encryption."""
        iv_input = (b'\xA5\x5A'
                    + self.ti
                    + struct.pack('<H', self.cmd_counter)
                    + b'\x00' * 8)
        return aes_encrypt_cbc(self.session_enc_key, bytes(16), iv_input)

    def write_data(self, file_no: int, offset: int, data: bytes):
        """
        Write data to a file (CommMode.Plain — no MAC needed on command).

        For File 02 which defaults to CommMode.Plain, data is sent unprotected.
        Authentication state just provides write authorisation.
        """
        header = (bytes([file_no])
                  + struct.pack('<I', offset)[:3]    # 3-byte LE offset
                  + struct.pack('<I', len(data))[:3]) # 3-byte LE length
        payload = header + data
        resp, sw = self._native_cmd(0x8D, payload)
        if sw != 0x9100:
            raise RuntimeError(f"WriteData failed — SW {sw:04X}")
        # cmd_counter increments on every successful command in an authenticated session
        self.cmd_counter += 1
        print(f"  ✓ Wrote {len(data)} bytes to File {file_no:02X}")

    def change_file_settings(self, file_no: int, file_settings: bytes):
        """
        ChangeFileSettings (cmd 0x5F) — ALWAYS CommMode.Full (AN12196 §9.3.4.3).

        The new FileSettings are ISO-padded and encrypted with the session ENC key,
        then a truncated MAC is computed over the encrypted payload.

        Payload sent to chip: FileNo(1) || Enc(FileSettings)(16) || MACt(8) = 25 bytes
        """
        cmd_header = bytes([file_no])

        # 1. Pad FileSettings (15 bytes → 16 bytes with ISO 9797-1 padding)
        padded = pad_to_block(file_settings)

        # 2. Encrypt using session ENC key with command-specific IV
        cmd_iv    = self._calc_cmd_iv()
        encrypted = aes_encrypt_cbc(self.session_enc_key, cmd_iv, padded)

        # 3. Compute truncated MAC over: CmdByte || CmdCtr || TI || FileNo || Enc(Settings)
        mac = self._calc_cmd_mac(0x5F, cmd_header, encrypted)

        payload = cmd_header + encrypted + mac
        print(f"    [CFS] enc_iv={cmd_iv.hex().upper()}")
        print(f"    [CFS] enc_settings({len(encrypted)}b)={encrypted.hex().upper()}")
        print(f"    [CFS] payload({len(payload)}b)={payload.hex().upper()}")
        resp, sw = self._native_cmd(0x5F, payload)
        if sw != 0x9100:
            raise RuntimeError(f"ChangeFileSettings failed — SW {sw:04X}")
        self.cmd_counter += 1
        print(f"  ✓ File {file_no:02X} settings updated (SDM enabled)")

    def change_key(self, key_no: int, new_key: bytes, old_key: bytes):
        """
        ChangeKey (cmd 0xC4) — always CommMode.Full (encrypted + MAC'd).

        When changing the currently authenticated key (key_no = auth key):
          CryptoData = NewKey (16 bytes) + KeyVersion (1 byte)
          Padded to 32 bytes, then encrypted.

        When changing a DIFFERENT key:
          CryptoData = XOR(NewKey, OldKey) (16 bytes) + CRC32(NewKey) + KeyVersion
          Padded to 32 bytes, then encrypted.
        """
        key_version = b'\x00'

        # For simplicity we assume we're changing the auth key (Key 0 = auth key)
        # Format: NewKey(16) || KeyVer(1) → pad to 32 → encrypt
        plaintext = new_key + key_version
        padded = pad_to_block(plaintext, 16)  # 17 bytes → padded to 32

        # Calculate encryption IV
        cmd_iv = self._calc_cmd_iv()

        # Encrypt the key data
        encrypted = aes_encrypt_cbc(self.session_enc_key, cmd_iv, padded)

        # Command header
        cmd_header = bytes([key_no])

        # Calculate MAC over the command
        mac = self._calc_cmd_mac(0xC4, cmd_header, encrypted)

        payload = cmd_header + encrypted + mac
        resp, sw = self._native_cmd(0xC4, payload)
        if sw != 0x9100:
            raise RuntimeError(f"ChangeKey failed — SW {sw:04X}")
        self.cmd_counter += 1
        print(f"  ✓ Key {key_no} changed successfully")


# ─── NDEF Message Builder ────────────────────────────────────────────────────

def build_ndef_url_record() -> bytes:
    """
    Build the NDEF file content for File 02 with SUN placeholder URL.

    Structure:
      Bytes 0-1:  NLEN (NDEF message length, big-endian)
      Bytes 2+:   NDEF message (URI record)

    The chip auto-replaces the 0-placeholders with real UID/counter/MAC on each tap.
    """
    # URI payload (without "https://" — URI code 0x04 adds that)
    uri_payload = (URL_TEMPLATE_PREFIX
                   + URL_UID_PLACEHOLDER
                   + URL_CTR_SEP + URL_CTR_PLACEHOLDER
                   + URL_MAC_SEP + URL_MAC_PLACEHOLDER)

    uri_bytes = uri_payload.encode('ascii')

    # NDEF URI record:  header(1) + type_len(1) + payload_len(1) + type(1) + uri_code(1) + uri
    payload_len = 1 + len(uri_bytes)  # URI code byte + URI string
    ndef_record = bytes([
        0xD1,              # NDEF header: MB=1, ME=1, SR=1, TNF=0x01 (Well-Known)
        0x01,              # Type length = 1
        payload_len,       # Payload length
        0x55,              # Type = "U" (URI record)
        0x04,              # URI identifier code: "https://"
    ]) + uri_bytes

    # File 02 content: 2-byte NLEN + NDEF message
    nlen = struct.pack('>H', len(ndef_record))
    return nlen + ndef_record


def calc_sdm_offsets(file_content: bytes) -> dict:
    """
    Calculate byte offsets for SDM mirroring within the NDEF file content.

    These offsets tell the chip WHERE in the file to inject the real UID, counter, and MAC.
    Searches raw bytes (not decoded string) to avoid corruption from non-ASCII NDEF header
    bytes (e.g. 0xD1, 0x55, 0x04) that would shift index calculations if decoded.
    """
    # Search raw bytes — unique prefix prevents false matches
    uid_marker = b'uid=' + URL_UID_PLACEHOLDER.encode('ascii')
    ctr_marker = b'c='   + URL_CTR_PLACEHOLDER.encode('ascii')
    mac_marker = b'm='   + URL_MAC_PLACEHOLDER.encode('ascii')

    uid_offset       = file_content.index(uid_marker) + len(b'uid=')
    ctr_offset       = file_content.index(ctr_marker) + len(b'c=')
    mac_offset       = file_content.index(mac_marker) + len(b'm=')
    # MAC input starts at counter offset (must be >= SDMReadCtrOffset)
    mac_input_offset = ctr_offset

    return {
        'uid': uid_offset,
        'ctr': ctr_offset,
        'mac_input': mac_input_offset,
        'mac': mac_offset,
    }


def build_file_settings(offsets: dict) -> bytes:
    """
    Build the ChangeFileSettings data payload for enabling SDM on File 02.

    Layout (with UID + Counter mirroring):
      FileOption(1) + AccessRights(2) + SDMOptions(1) + SDMAccessRights(2)
      + UIDOffset(3) + SDMReadCtrOffset(3) + SDMMACInputOffset(3) + SDMMACOffset(3)

    Total: 1+2+1+2+3+3+3+3 = 18 bytes of settings
    """
    # FileOption: SDM enabled (bit 6) + CommMode.Plain (bits 1:0 = 00)
    file_option = 0x40

    # AccessRights (2 bytes LE):
    #   Read=0xE (free), Write=0x0 (Key0), R/W=0x0 (Key0), Change=0x0 (Key0)
    access_rights = bytes([0x00, 0xE0])

    # SDMOptions: 0xC1 = SDMEnabled(bit0) + ReadCtr mirror(bit6) + UID mirror(bit7)
    sdm_options = 0xC1

    # SDMAccessRights (2 bytes LE, 16-bit value = 0xE0FF):
    #   Bits[15:12] = SDMMetaRead = 0xE (free = plaintext UID/CTR)
    #   Bits[11:8]  = SDMFileRead = 0x0 (Key 0 = for CMAC calculation)
    #   Bits[7:4]   = RFU = 0xF
    #   Bits[3:0]   = SDMCtrRet = 0xF (disabled)
    sdm_access_rights = bytes([0xFF, 0xE0])

    # Offsets as 3-byte little-endian
    uid_off       = struct.pack('<I', offsets['uid'])[:3]
    ctr_off       = struct.pack('<I', offsets['ctr'])[:3]
    mac_input_off = struct.pack('<I', offsets['mac_input'])[:3]
    mac_off       = struct.pack('<I', offsets['mac'])[:3]

    settings = (bytes([file_option]) + access_rights + bytes([sdm_options])
                + sdm_access_rights
                + uid_off + ctr_off + mac_input_off + mac_off)
    print(f"    [SDM] settings({len(settings)}b)={settings.hex().upper()}")
    return settings


# ─── Backend Registration ────────────────────────────────────────────────────

def register_with_backend(api_url: str, admin_key: str, uid_hex: str, auth_key_hex: str):
    """POST the provisioned tag to the backend so it's stored in the DB."""
    url = f"{api_url.rstrip('/')}/api/admin/provision-tag"
    resp = requests.post(
        url,
        json={"nfc_uid": uid_hex, "auth_key": auth_key_hex},
        headers={"X-Admin-Key": admin_key, "Content-Type": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"Backend rejected tag: {data}")
    print(f"  ✓ Registered with backend ({data.get('message', '')})")


# ─── Main Provisioning Flow ─────────────────────────────────────────────────

def get_reader_connection():
    """Find and connect to the ACR122U reader, polling until a tag is detected."""
    import time
    from smartcard.Exceptions import NoCardException

    available = readers()
    if not available:
        print("✗ No PC/SC readers found. Is the ACR122U plugged in?")
        sys.exit(1)

    print(f"Found readers: {[str(r) for r in available]}")
    reader = available[0]
    print(f"Using: {reader}")
    print("Place an NTAG 424 DNA chip on the reader... ", end="", flush=True)

    # Poll until a card is present (retry every 0.5s, dots show progress)
    while True:
        try:
            connection = reader.createConnection()
            connection.connect()
            print(" ✓ Card detected!")
            return connection
        except NoCardException:
            print(".", end="", flush=True)
            time.sleep(0.5)
        except Exception as e:
            print(f"\n✗ Unexpected reader error: {e}")
            sys.exit(1)



def read_uid(connection) -> str:
    """Read the UID from the chip using GetVersion or direct UID read."""
    # Standard UID read via ACR122U pseudo-APDU
    GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]
    data, sw1, sw2 = connection.transmit(GET_UID)
    if (sw1 << 8 | sw2) != 0x9000:
        raise RuntimeError(f"Failed to read UID — SW {sw1:02X}{sw2:02X}")
    uid_hex = ''.join(f'{b:02X}' for b in data)
    return uid_hex


def provision_chip(args):
    """Full provisioning sequence for one chip."""
    conn = get_reader_connection()
    tag = NTAG424DNA(conn)

    # Read UID first (before selecting the app, using reader-level command)
    uid_hex = read_uid(conn)
    print(f"  UID: {uid_hex}")

    # Generate a unique auth key for this chip
    auth_key = secrets.token_bytes(16)
    auth_key_hex = auth_key.hex().upper()

    print(f"\n── Provisioning chip {uid_hex} ──")

    # Step 1: Select application
    tag.select_application()

    # Step 2: Authenticate with factory Key 0 (all zeros)
    print("  Authenticating with factory key...")
    tag.authenticate_ev2_first(key_no=0, key=DEFAULT_KEY)

    # Step 3: Build and write NDEF URL template
    ndef_content = build_ndef_url_record()
    print(f"  NDEF content ({len(ndef_content)} bytes): writing to File 02...")
    tag.write_data(file_no=0x02, offset=0, data=ndef_content)

    # Step 4: Enable SDM via ChangeFileSettings
    offsets = calc_sdm_offsets(ndef_content)
    print(f"  SDM offsets — UID:{offsets['uid']}, Ctr:{offsets['ctr']}, "
          f"MACin:{offsets['mac_input']}, MAC:{offsets['mac']}")
    file_settings = build_file_settings(offsets)
    tag.change_file_settings(file_no=0x02, file_settings=file_settings)

    # Step 5: Change Key 0 from factory zeros to our unique auth key
    print("  Changing Key 0 to unique auth key...")
    tag.change_key(key_no=0, new_key=auth_key, old_key=DEFAULT_KEY)

    # Step 6: Register with backend
    if args.api_url:
        print("  Registering with backend...")
        register_with_backend(args.api_url, args.admin_key, uid_hex, auth_key_hex)
    else:
        print(f"\n  ⚠  No --api-url provided. Manually register this tag:")
        print(f"     UID:      {uid_hex}")
        print(f"     Auth Key: {auth_key_hex}")

    print(f"\n✅ Chip {uid_hex} provisioned successfully!\n")
    return uid_hex, auth_key_hex


def main():
    parser = argparse.ArgumentParser(
        description="Provision NTAG 424 DNA chips for the N3XO payment system"
    )
    parser.add_argument("--api-url", default=os.getenv("API_URL"),
                        help="Backend API URL (e.g. http://localhost:8000)")
    parser.add_argument("--admin-key", default=os.getenv("ADMIN_PROVISION_KEY", "changeme-set-in-env"),
                        help="Admin provisioning key (X-Admin-Key header)")
    parser.add_argument("--batch", type=int, default=1,
                        help="Number of chips to provision in sequence")
    args = parser.parse_args()

    print("╔══════════════════════════════════════════╗")
    print("║   N3XO — NTAG 424 DNA Chip Provisioner   ║")
    print("╚══════════════════════════════════════════╝\n")

    provisioned = []
    for i in range(args.batch):
        if args.batch > 1:
            print(f"\n─── Chip {i+1} of {args.batch} ───")
            if i > 0:
                input("Remove current chip and place the next one. Press Enter to continue...")

        uid, key = provision_chip(args)
        provisioned.append((uid, key))

    if len(provisioned) > 1:
        print("\n═══ Provisioning Summary ═══")
        for uid, key in provisioned:
            print(f"  {uid} → {key}")

    print("\nDone. Use the Link Wristband screen in the app to assign chips to children.")


if __name__ == "__main__":
    main()
