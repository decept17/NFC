import os
import stripe
from dotenv import load_dotenv

load_dotenv('.env')
stripe.api_key = os.getenv('PAYMENT_GATEWAY_SECRET_KEY')

try:
    sess = stripe.checkout.Session.create(
        payment_method_types=['card'],
        mode='payment',
        line_items=[{
            'price_data': {
                'currency': 'gbp',
                'unit_amount': 1000,
                'product_data': {'name': 'test'}
            },
            'quantity': 1
        }],
        success_url='exp://192.168.1.100:8081/--/(tabs)/home?payment=success',
        cancel_url='exp://192.168.1.100:8081/--/(tabs)/home?payment=cancel'
    )
    print(sess.url)
except Exception as e:
    print(type(e), str(e))
