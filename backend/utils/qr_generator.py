import random
import string


def generate_qr_token(length: int = 6) -> str:
    """Generate random alphanumeric QR token"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


def generate_pickup_delivery_tokens() -> tuple[str, str]:
    """Generate unique pickup and delivery tokens"""
    return generate_qr_token(), generate_qr_token()
