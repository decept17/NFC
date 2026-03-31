"""
Sets up a Stripe Connect test merchant account with all required details.
"""
import requests
import json

API_KEY = "STRIPE_SECRET_KEY_REMOVED"
ACCOUNT_ID = "acct_1TH8r63RgKZYZKEU"

headers = {}
auth = (API_KEY, "")

# Step 1: Update account with company details + external account
print("Step 1: Updating account with company details...")
r = requests.post(
    f"https://api.stripe.com/v1/accounts/{ACCOUNT_ID}",
    auth=auth,
    data={
        "business_profile[url]": "https://schoolcanteen.example.com",
        "company[name]": "School Canteen Ltd",
        "company[address][line1]": "123 Test Street",
        "company[address][city]": "London",
        "company[address][postal_code]": "SW1A 1AA",
        "company[tax_id]": "000000000",
        "company[directors_provided]": "true",
        "company[executives_provided]": "true",
        "company[owners_provided]": "true",
        "external_account": "btok_gb",
    }
)
if r.status_code == 200:
    data = r.json()
    print(f"  ✅ Account updated. Transfers: {data['capabilities'].get('transfers')}")
    print(f"  Remaining requirements: {len(data['requirements']['currently_due'])}")
else:
    print(f"  ❌ Failed: {r.json().get('error', {}).get('message')}")
    exit(1)

# Step 2: Check if requirements still need persons
remaining = data['requirements']['currently_due']
needs_persons = any("directors" in r or "executives" in r or "owners" in r for r in remaining)

if needs_persons:
    print("\nStep 2: Adding representative/director/executive/owner person...")
    r2 = requests.post(
        f"https://api.stripe.com/v1/accounts/{ACCOUNT_ID}/persons",
        auth=auth,
        data={
            "first_name": "Jane",
            "last_name": "Doe",
            "dob[day]": "15",
            "dob[month]": "6",
            "dob[year]": "1985",
            "address[line1]": "456 School Road",
            "address[city]": "London",
            "address[postal_code]": "EC1A 1BB",
            "relationship[representative]": "true",
            "relationship[executive]": "true",
            "relationship[director]": "true",
            "relationship[owner]": "true",
            "relationship[percent_ownership]": "100",
        }
    )
    if r2.status_code == 200:
        print(f"  ✅ Person added: {r2.json()['id']}")
    else:
        print(f"  ❌ Failed: {r2.json().get('error', {}).get('message')}")

# Step 3: Re-check capabilities
print("\nStep 3: Checking final account status...")
r3 = requests.get(
    f"https://api.stripe.com/v1/accounts/{ACCOUNT_ID}",
    auth=auth,
)
data3 = r3.json()
transfers = data3['capabilities'].get('transfers')
remaining = data3['requirements']['currently_due']
print(f"  Transfers capability: {transfers}")
print(f"  Remaining requirements: {len(remaining)}")
if remaining:
    for req in remaining:
        print(f"    - {req}")

if transfers == "active":
    print("\n🎉 Ready for transfers! You can now test NFC payments.")
elif transfers == "pending":
    print("\n⏳ Transfers capability is pending — Stripe is reviewing. Should activate shortly in test mode.")
else:
    print(f"\n⚠️ Transfers still {transfers}. Check Stripe Dashboard for more info.")
