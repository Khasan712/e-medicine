"""Money, quantities, phones and time — the same rules as the backend (apps.core.utils / services)."""
import re
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from .config import settings

COORDINATES_RE = re.compile(r'^\s*-?\d{1,3}\.\d+[\s,]+-?\d{1,3}\.\d+\s*$')


def parse_price(value):
    """Parse a price stored as text ("35 000", "35 000 UZS", "35000.00", "35,000") into an int."""
    if value is None:
        return 0
    if isinstance(value, (int, float, Decimal)):
        return int(round(value))

    match = re.search(r'\d[\d\s.,]*', str(value).replace('\xa0', ' '))
    if not match:
        return 0
    number = re.sub(r'\s', '', match.group()).rstrip('.,')

    # A trailing separator followed by 1-2 digits is a decimal part; any other separator groups thousands.
    decimal_part = re.search(r'[.,](\d{1,2})$', number)
    if decimal_part:
        integer_part = re.sub(r'[.,]', '', number[:decimal_part.start()])
        return int(round(float(f'{integer_part or 0}.{decimal_part.group(1)}')))
    return int(re.sub(r'[.,]', '', number) or 0)


def parse_quantity(value, default=1):
    """Order item quantities are stored as text; whole numbers are expected."""
    try:
        return int(float(str(value).replace(',', '.')))
    except (TypeError, ValueError):
        return default


def format_money(amount):
    """35000 -> '35 000'"""
    return f'{int(amount):,}'.replace(',', ' ')


def normalize_phone(value):
    """Return a phone number as '+998XXXXXXXXX' (or '+<digits>' for other countries), or None if invalid."""
    digits = re.sub(r'\D', '', str(value or ''))
    if len(digits) == 9:
        digits = '998' + digits
    if 10 <= len(digits) <= 15:
        return '+' + digits
    return None


def is_coordinates(value):
    return bool(value and COORDINATES_RE.match(value))


# ---------------------------------------------------------------------------
# time: the database stores UTC, people see the business's local time
# ---------------------------------------------------------------------------

def now():
    return datetime.now(UTC)


def local_zone():
    return ZoneInfo(settings.time_zone)


def localtime(value):
    return value.astimezone(local_zone())


def localdate():
    return localtime(now()).date()


def day_range(day):
    """[start, end) of a local day as aware datetimes (for created_at filters)."""
    start = datetime.combine(day, time.min, tzinfo=local_zone())
    return start, start + timedelta(days=1)
