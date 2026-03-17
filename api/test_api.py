import requests
import json
import uuid

# Find a valid account ID
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Account, User

engine = create_engine('sqlite:///test.db')
Session = sessionmaker(bind=engine)
db = Session()

account = db.query(Account).first()
if account:
    url = f"http://localhost:8000/api/accounts/{account.account_id}/create-checkout-session"
    print(f"Testing URL: {url}")
    
    # We also need a token, but let's just see if we get a 401 or something else.
    response = requests.post(url, json={
        "amount": 10.0,
        "success_url": "exp://192.168.1.100:8081/--/(tabs)/home?payment=success",
        "cancel_url": "exp://192.168.1.100:8081/--/(tabs)/home?payment=cancel"
    })
    print(response.status_code)
    print(response.text)
else:
    print("No accounts found.")
