import io
import ssl
import base64
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.files.base import ContentFile
from PIL import Image
from app.models import Product

KEYWORD_MAP = {
    "Burgerlar": "burger",
    "Hot-doglar": "hotdog",
    "Fri va qovurilganlar": "fries",
    "Sendvichlar": "sandwich",
    "Tug'ilgan kun tortlari": "birthday,cake",
    "Shokoladli tortlar": "chocolate,cake",
    "Mevali tortlar": "fruit,cake,dessert",
    "Cheesecake'lar": "cheesecake",
    "Klassik pitsalar": "pizza",
    "Go'shtli pitsalar": "pizza,meat",
    "Sabzavotli pitsalar": "pizza,vegetable",
    "Dengiz mahsulotli pitsalar": "pizza,seafood",
}

CTX = ssl.create_default_context()
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.read()


def download_food_image(keyword: str, lock_seed: int):
    candidates = [
        f"https://loremflickr.com/800/500/{keyword}?lock={lock_seed}",
        f"https://loremflickr.com/800/500/{keyword}",
        f"https://picsum.photos/seed/{keyword.replace(',', '-')}{lock_seed}/800/500",
    ]
    last_err = None
    for url in candidates:
        try:
            data = fetch(url)
            if len(data) < 2000:
                continue
            img = Image.open(io.BytesIO(data)).convert("RGB")
            img.thumbnail((1000, 700))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            return buf.getvalue()
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"all sources failed for {keyword!r}: {last_err}")


def work(product_id: int):
    p = Product.objects.get(id=product_id)
    keyword = KEYWORD_MAP.get(p.category.name_uz if p.category else "", "food")
    img_bytes = download_food_image(keyword, lock_seed=product_id)
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
    file_name = f"{p.name_uz.lower().replace(' ', '_').replace('/', '_').replace(chr(39), '')}.jpg"
    p.img.save(file_name, ContentFile(img_bytes), save=False)
    p.img_64 = img_b64
    p.save()
    return f"OK #{p.id:2d} {p.name_uz:25s} [{keyword}] ({len(img_bytes)//1024} KB)"


ids = list(Product.objects.values_list("id", flat=True).order_by("id"))
print(f"Downloading images for {len(ids)} products in parallel...")

ok, err = 0, 0
with ThreadPoolExecutor(max_workers=8) as ex:
    futs = {ex.submit(work, pid): pid for pid in ids}
    for f in as_completed(futs):
        try:
            print(f.result())
            ok += 1
        except Exception as e:
            print(f"ERR pid={futs[f]}: {e}")
            err += 1

print(f"\nDone: {ok} ok, {err} err")
