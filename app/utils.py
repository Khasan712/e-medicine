import re


def extract_price(price_text):
    # Remove non-numeric characters except space and dot
    cleaned_price = re.sub(r"[^\d.]", " ", price_text)

    # Remove extra spaces and keep only numbers with optional decimal points
    match = re.search(r"[\d\s]+(?:\.\d+)?", cleaned_price)

    numeric_str = match.group().replace(" ", "")
    return float(numeric_str)


def format_price(price):
    return f"{price:,}".replace(",", " ")
