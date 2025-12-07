import re

from db.models import Client


def price_reformat_float(price: str):
    match = re.search(r"[\d]+(?:\.\d+)?", price)
    return float(match.group()) if match else 0


def extract_price(price_text):
    # Remove non-numeric characters except space and dot
    cleaned_price = re.sub(r"[^\d.]", " ", price_text)

    # Remove extra spaces and keep only numbers with optional decimal points
    match = re.search(r"[\d\s]+(?:\.\d+)?", cleaned_price)

    numeric_str = match.group().replace(" ", "")
    return float(numeric_str)


def format_price(price):
    return f"{price:,}".replace(",", " ")


def get_total(price, qty):
    return format_price(price*qty)


def client_to_dict(client: Client) -> dict:
    return {
        "id": client.id,
        "first_name": client.first_name,
        "last_name": client.last_name,
        "phone": client.phone,
        "tg_phone": client.tg_phone,
        "tg_id": client.tg_id,
        "tg_nick": client.tg_nick,
        "location": client.location,
        "l_t": client.l_t,
        "e_t": client.e_t,
        "lang": client.lang,
    }
