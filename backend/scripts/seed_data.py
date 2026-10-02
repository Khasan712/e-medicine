"""Demo catalog (fast food, cakes, pizza) with generated images, for one business:
    python manage.py tenant_command shell --schema=<schema> < scripts/seed_data.py
"""
import io
import base64
import hashlib
from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont
from apps.core.models import Category, Product, Descriptions


def color_from(seed: str):
    h = hashlib.md5(seed.encode()).digest()
    return (60 + h[0] % 180, 60 + h[1] % 180, 60 + h[2] % 180)


def make_image_bytes(label: str, color):
    img = Image.new("RGB", (800, 500), color)
    d = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), label, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((800 - w) / 2, (500 - h) / 2), label, fill=(255, 255, 255), font=font)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82)
    return buf.getvalue()


# --- Measure units ---
m_dona, _ = Descriptions.objects.get_or_create(name_uz="dona", name_ru="шт")
m_porsiya, _ = Descriptions.objects.get_or_create(name_uz="porsiya", name_ru="порция")
m_kg, _ = Descriptions.objects.get_or_create(name_uz="kg", name_ru="кг")

# --- Data: (group, cat_uz, cat_ru, products[(name_uz, name_ru, price, desc_uz, desc_ru,
#                                            manufacturer_uz, manufacturer_ru, measure)]) ---
DATA = [
    # =============== FAST FOOD ===============
    ("fastfood", "Burgerlar", "Бургеры", [
        ("Chizburger", "Чизбургер", "35 000",
         "Mazali mol go'shtli kotlet, cheddar pishlog'i, salat va maxsus sous",
         "Сочная говяжья котлета, сыр чеддер, салат и фирменный соус",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Dabl Burger", "Дабл Бургер", "48 000",
         "Ikkita mol go'shtli kotlet, ikki qavat pishloq, sous",
         "Две говяжьи котлеты, двойной сыр, соус",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Tovuqli Burger", "Куриный Бургер", "32 000",
         "Qurishqili tovuq filesi, salat, pomidor va mayonez",
         "Хрустящее куриное филе, салат, помидор и майонез",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("BBQ Burger", "BBQ Бургер", "42 000",
         "Go'shtli kotlet, BBQ sous, qovurilgan piyoz va bekon",
         "Говяжья котлета, BBQ соус, жареный лук и бекон",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Vegetarian Burger", "Вегетарианский Бургер", "30 000",
         "Sabzavotli kotlet, avokado, salat va gorchitsa",
         "Овощная котлета, авокадо, салат и горчица",
         "Milli Fast Food", "Milli Fast Food", m_dona),
    ]),
    ("fastfood", "Hot-doglar", "Хот-доги", [
        ("Klassik Hot-Dog", "Классический Хот-Дог", "25 000",
         "Frankfurt sosiska, bulochka, ketchup va gorchitsa",
         "Франкфуртская сосиска, булочка, кетчуп и горчица",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Pishloqli Hot-Dog", "Сырный Хот-Дог", "28 000",
         "Sosiska, eritgan cheddar pishlog'i va piyoz",
         "Сосиска, плавленый чеддер и жареный лук",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Chili Hot-Dog", "Чили Хот-Дог", "30 000",
         "Sosiska, achchiq chili sous, jalapeño",
         "Сосиска, острый чили-соус, халапеньо",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("BBQ Hot-Dog", "BBQ Хот-Дог", "27 000",
         "Sosiska, BBQ sous, qovurilgan piyoz",
         "Сосиска, BBQ соус, жареный лук",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Jumbo Hot-Dog", "Джамбо Хот-Дог", "35 000",
         "Katta sosiska, qo'shimcha pishloq va sabzavotlar",
         "Большая сосиска, двойной сыр и овощи",
         "Milli Fast Food", "Milli Fast Food", m_dona),
    ]),
    ("fastfood", "Fri va qovurilganlar", "Картофель фри и закуски", [
        ("Fri kartoshka (kichik)", "Картофель фри (маленький)", "15 000",
         "Yupqa qovurilgan kartoshka, kichik porsiya",
         "Хрустящий картофель фри, маленькая порция",
         "Milli Fast Food", "Milli Fast Food", m_porsiya),
        ("Fri kartoshka (katta)", "Картофель фри (большой)", "22 000",
         "Yupqa qovurilgan kartoshka, katta porsiya",
         "Хрустящий картофель фри, большая порция",
         "Milli Fast Food", "Milli Fast Food", m_porsiya),
        ("Pishloqli fri", "Картофель с сыром", "25 000",
         "Fri kartoshka, eritilgan cheddar va chekan piyoz",
         "Картофель фри с плавленым чеддером и зелёным луком",
         "Milli Fast Food", "Milli Fast Food", m_porsiya),
        ("Nagets (6 dona)", "Наггетсы (6 шт)", "30 000",
         "Tovuq go'shtidan qovurilgan qurishqili nagetslar",
         "Хрустящие куриные наггетсы, 6 штук",
         "Milli Fast Food", "Milli Fast Food", m_porsiya),
        ("Piyoz halqalari", "Луковые кольца", "20 000",
         "Qurishqili qoplamada qovurilgan piyoz halqalari",
         "Луковые кольца в хрустящей панировке",
         "Milli Fast Food", "Milli Fast Food", m_porsiya),
    ]),
    ("fastfood", "Sendvichlar", "Сэндвичи", [
        ("Klub Sendvich", "Клаб Сэндвич", "35 000",
         "Tovuq, bekon, salat, pomidor, tuxum — uch qavat non",
         "Курица, бекон, салат, помидор, яйцо — три слоя хлеба",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Tovuqli Sendvich", "Куриный Сэндвич", "30 000",
         "Qovurilgan tovuq filesi, salat, sous",
         "Жареное куриное филе, салат, соус",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Tuna Sendvich", "Сэндвич с тунцом", "38 000",
         "Tuna baliq, ko'katlar, mayonez, qizil piyoz",
         "Тунец, зелень, майонез, красный лук",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("Vegetarian Sendvich", "Вегетарианский Сэндвич", "28 000",
         "Avokado, pomidor, bodring, salat, pishloq",
         "Авокадо, помидор, огурец, салат, сыр",
         "Milli Fast Food", "Milli Fast Food", m_dona),
        ("BLT Sendvich", "БЛТ Сэндвич", "32 000",
         "Bekon, salat, pomidor va mayonez",
         "Бекон, салат, помидор и майонез",
         "Milli Fast Food", "Milli Fast Food", m_dona),
    ]),

    # =============== TORTLAR ===============
    ("tort", "Tug'ilgan kun tortlari", "Праздничные торты", [
        ("Klassik krem torti", "Классический кремовый торт", "180 000",
         "An'anaviy bisquit qatlamlari, krem va vanil ta'mi",
         "Классические бисквитные коржи с кремом и ванилью",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Shokoladli tort", "Шоколадный торт", "220 000",
         "Qora shokoladli bisquit, ganash krem",
         "Тёмный шоколадный бисквит с ганашем",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Vanil torti", "Ванильный торт", "200 000",
         "Yumshoq vanilli bisquit va sut kremi",
         "Нежный ванильный бисквит с молочным кремом",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Qulupnayli tort", "Клубничный торт", "250 000",
         "Yangi qulupnay, krem va bisquit qatlamlari",
         "Свежая клубника со сливочным кремом",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Red Velvet", "Ред Велвет", "280 000",
         "Qizil barxat bisquit va krim cheese krem",
         "Красный бархатный бисквит с крем-чизом",
         "Shirin Uy", "Shirin Uy", m_dona),
    ]),
    ("tort", "Shokoladli tortlar", "Шоколадные торты", [
        ("Qora shokolad torti", "Чёрный шоколадный торт", "250 000",
         "70% kakaoli qora shokoladdan tayyorlangan",
         "Из чёрного шоколада 70% какао",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Oq shokolad torti", "Белый шоколадный торт", "240 000",
         "Yumshoq oq shokoladli krem va bisquit",
         "Нежный крем из белого шоколада",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Sut shokolad torti", "Молочный шоколадный торт", "220 000",
         "Sut shokoladi, fundug va karamel",
         "Молочный шоколад, фундук и карамель",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Nutella torti", "Нутелла торт", "270 000",
         "Nutella krem va qovurilgan fundug qatlamlari",
         "Нутелла-крем и слои обжаренного фундука",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Brownie torti", "Брауни торт", "200 000",
         "Qalin shokoladli brownie va ganash",
         "Плотный шоколадный брауни с ганашем",
         "Shirin Uy", "Shirin Uy", m_dona),
    ]),
    ("tort", "Mevali tortlar", "Фруктовые торты", [
        ("Mavsumiy mevali tort", "Сезонный фруктовый торт", "230 000",
         "Yangi mavsumiy mevalar bilan bezatilgan",
         "С украшением из свежих сезонных фруктов",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Mango tort", "Манго торт", "260 000",
         "Tropik mango puresi va qaymoq",
         "Тропическое пюре манго и взбитые сливки",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Olma torti", "Яблочный торт", "180 000",
         "Karamellangan olma va dolchin",
         "Карамелизированное яблоко с корицей",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Kivi torti", "Киви торт", "220 000",
         "Yangi kivi va yengil sut kremi",
         "Свежий киви и лёгкий молочный крем",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Sitrus torti", "Цитрусовый торт", "240 000",
         "Limon, apelsin va greyfurutning tozalangan ta'mi",
         "Лимон, апельсин и грейпфрут в идеальном балансе",
         "Shirin Uy", "Shirin Uy", m_dona),
    ]),
    ("tort", "Cheesecake'lar", "Чизкейки", [
        ("Klassik cheesecake", "Классический чизкейк", "180 000",
         "Krim cheese va pecheneli tagi",
         "Крем-чиз на печенье-основе",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Qulupnayli cheesecake", "Клубничный чизкейк", "200 000",
         "Qulupnay sousi bilan klassik cheesecake",
         "Классический чизкейк с клубничным соусом",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Shokoladli cheesecake", "Шоколадный чизкейк", "210 000",
         "Qora shokolad qatlami va krim cheese",
         "Слой тёмного шоколада и крем-чиз",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Limonli cheesecake", "Лимонный чизкейк", "190 000",
         "Yangi limon puresi bilan yengil cheesecake",
         "Лёгкий чизкейк с пюре свежего лимона",
         "Shirin Uy", "Shirin Uy", m_dona),
        ("Karamelli cheesecake", "Карамельный чизкейк", "220 000",
         "Tuzlangan karamel va vanil cheesecake",
         "Солёная карамель и ванильный чизкейк",
         "Shirin Uy", "Shirin Uy", m_dona),
    ]),

    # =============== PITSA ===============
    ("pizza", "Klassik pitsalar", "Классические пиццы", [
        ("Margherita", "Маргарита", "85 000",
         "Pomidor sousi, mozzarella va rayxon",
         "Томатный соус, моцарелла и базилик",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Pepperoni", "Пепперони", "95 000",
         "Mozzarella va achchiq pepperoni kolbasa",
         "Моцарелла и острая колбаса пепперони",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Hawaiian", "Гавайская", "100 000",
         "Jambon, ananas va mozzarella",
         "Ветчина, ананас и моцарелла",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Quattro Formaggi", "Кватро Формаджи", "120 000",
         "To'rt xil pishloq: mozzarella, parmezan, gorgonzola, fetachino",
         "Четыре сыра: моцарелла, пармезан, горгонзола, фета",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Napoletana", "Наполитана", "110 000",
         "An'anaviy Napol uslubida pomidor, ancho'us va zaytun",
         "Традиционный Неаполь: томат, анчоус, оливки",
         "Milli Pizza", "Milli Pizza", m_dona),
    ]),
    ("pizza", "Go'shtli pitsalar", "Мясные пиццы", [
        ("Meat Lover", "Мясная", "140 000",
         "Mol go'shti, tovuq, pepperoni va bekon",
         "Говядина, курица, пепперони и бекон",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("BBQ Chicken", "BBQ Курица", "125 000",
         "BBQ sousli tovuq, piyoz va mozzarella",
         "Курица в BBQ соусе, лук и моцарелла",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Spicy Beef", "Пикантная говядина", "145 000",
         "Achchiq mol go'shti, jalapeño va qizil qalampir",
         "Острая говядина, халапеньо и красный перец",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Salami", "Салями", "115 000",
         "Italyan salami, mozzarella va pomidor",
         "Итальянская салями, моцарелла и томат",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Italian Sausage", "Итальянская колбаса", "135 000",
         "Qaynatilgan italyan kolbasa va qalampir",
         "Жареная итальянская колбаса с перцем",
         "Milli Pizza", "Milli Pizza", m_dona),
    ]),
    ("pizza", "Sabzavotli pitsalar", "Овощные пиццы", [
        ("Veggie Supreme", "Овощной супрем", "95 000",
         "Qalampir, piyoz, zaytun, qo'ziqorin va pomidor",
         "Перец, лук, оливки, грибы и помидор",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Margherita Deluxe", "Маргарита Делюкс", "100 000",
         "Qo'shimcha pishloq va pomidor bilan margherita",
         "Маргарита с двойным сыром и помидором",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Mushroom", "Грибная", "90 000",
         "To'rt xil qo'ziqorin va pishloq",
         "Четыре вида грибов и сыр",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Spinach & Cheese", "Шпинат и сыр", "105 000",
         "Ismaloq, fetachino va mozzarella",
         "Шпинат, фета и моцарелла",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Mediterranean", "Средиземноморская", "115 000",
         "Zaytun, artishoq, pomidor va fetachino",
         "Оливки, артишок, томат и фета",
         "Milli Pizza", "Milli Pizza", m_dona),
    ]),
    ("pizza", "Dengiz mahsulotli pitsalar", "Пиццы с морепродуктами", [
        ("Tuna", "Тунец", "130 000",
         "Tuna baliq, qizil piyoz va kapers",
         "Тунец, красный лук и каперсы",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Shrimp Lover", "Креветочная", "150 000",
         "Katta qisqichbaqalar, sarimsoq va limon",
         "Крупные креветки, чеснок и лимон",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Seafood Mix", "Морепродукты микс", "165 000",
         "Qisqichbaqa, midiya, kalmar va tuna",
         "Креветки, мидии, кальмары и тунец",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Salmon", "Лосось", "155 000",
         "Dudlangan losos, krim va rayxon",
         "Копчёный лосось, сливки и базилик",
         "Milli Pizza", "Milli Pizza", m_dona),
        ("Calamari", "Кальмар", "140 000",
         "Qovurilgan kalmar, sarimsoq va ko'katlar",
         "Жареный кальмар, чеснок и зелень",
         "Milli Pizza", "Milli Pizza", m_dona),
    ]),
]


created_cats = 0
updated_cats = 0
created_prods = 0
updated_prods = 0

for group, cat_uz, cat_ru, products in DATA:
    cat, cat_new = Category.objects.get_or_create(
        name_uz=cat_uz, defaults={"name_ru": cat_ru}
    )
    if cat_new:
        created_cats += 1
    else:
        if cat.name_ru != cat_ru:
            cat.name_ru = cat_ru
            cat.save()
        updated_cats += 1

    cat_color = color_from(cat_uz)

    for name_uz, name_ru, price, desc_uz, desc_ru, man_uz, man_ru, measure in products:
        existing = Product.objects.filter(name_uz=name_uz, category=cat).first()
        img_bytes = make_image_bytes(name_uz, cat_color)
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        file_name = f"{name_uz.lower().replace(' ', '_').replace('/', '_')}.jpg"

        if existing is None:
            p = Product(
                name_uz=name_uz,
                name_ru=name_ru,
                price=price,
                desc_uz=desc_uz,
                desc_ru=desc_ru,
                manufacturer_uz=man_uz,
                manufacturer_ru=man_ru,
                measure=measure,
                category=cat,
                img_64=img_b64,
            )
            p.img.save(file_name, ContentFile(img_bytes), save=False)
            p.save()
            created_prods += 1
        else:
            existing.name_ru = name_ru
            existing.price = price
            existing.desc_uz = desc_uz
            existing.desc_ru = desc_ru
            existing.manufacturer_uz = man_uz
            existing.manufacturer_ru = man_ru
            existing.measure = measure
            existing.img_64 = img_b64
            existing.img.save(file_name, ContentFile(img_bytes), save=False)
            existing.save()
            updated_prods += 1

print(f"Categories: +{created_cats} created, {updated_cats} updated")
print(f"Products:   +{created_prods} created, {updated_prods} updated")
print(f"Totals in DB -> categories: {Category.objects.count()}, products: {Product.objects.count()}, "
      f"measures: {Descriptions.objects.count()}")
