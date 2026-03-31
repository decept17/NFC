"""
Dev-mode payment test script.

Usage:
  1. Tap the NFC wristband with your phone
  2. Copy the SUN URL (e.g. https://api.n3xo.com/pay?uid=...&c=...&m=...)
  3. Run this script and paste the URL when prompted
     OR pass the URL as a command-line argument:
       python test_payment.py "https://api.n3xo.com/pay?uid=040D7672FD1290&c=000001&m=A1B2C3D4E5F6A7B8"
"""
import sys
import requests
from urllib.parse import urlparse, parse_qs

API_BASE = "http://localhost:8000"
MERCHANT_ID = "7883128b-a025-4326-a890-ff5e54075e1e"
CATEGORY = "Canteen"
AMOUNT = 3.50  # Change this to whatever test amount you want

def parse_sun_url(url: str):
    """Extract uid, counter, and cmac from a SUN URL."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    uid = params.get("uid", [None])[0]
    counter = params.get("c", [None])[0]
    cmac = params.get("m", [None])[0]
    return uid, counter, cmac

def main():
    # Get the URL from args or prompt
    if len(sys.argv) > 1:
        sun_url = sys.argv[1]
    else:
        print("Tap your wristband and paste the SUN URL below:")
        sun_url = input("> ").strip()

    uid, counter, cmac = parse_sun_url(sun_url)

    if not all([uid, counter, cmac]):
        print("❌ Could not parse SUN parameters from URL.")
        print(f"   Parsed: uid={uid}, c={counter}, m={cmac}")
        sys.exit(1)

    print(f"\n📡 SUN Parameters:")
    print(f"   UID     = {uid}")
    print(f"   Counter = {counter} (decimal: {int(counter, 16)})")
    print(f"   CMAC    = {cmac}")
    print(f"   Amount  = £{AMOUNT:.2f}")
    print(f"   Merchant= {MERCHANT_ID}")
    print()

    payload = {
        "uid": uid,
        "counter": counter,
        "cmac": cmac,
        "amount": AMOUNT,
        "merchantId": MERCHANT_ID,
        "category": CATEGORY,
    }

    print(f"🚀 Sending POST to {API_BASE}/api/transactions/pay ...")
    try:
        resp = requests.post(f"{API_BASE}/api/transactions/pay", json=payload)
        print(f"\n📦 Status: {resp.status_code}")
        print(f"📦 Response: {resp.json()}")

        if resp.status_code == 200:
            print(f"\n✅ Payment approved! New balance: £{resp.json().get('balance', '?')}")
        else:
            print(f"\n❌ Payment failed: {resp.json().get('detail', resp.text)}")
    except requests.ConnectionError:
        print(f"\n❌ Could not connect to {API_BASE}. Is docker-compose up?")

if __name__ == "__main__":
    main()
