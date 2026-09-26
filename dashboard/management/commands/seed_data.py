import os
import base64
import requests
from io import BytesIO
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from app.models import Category, Product, Descriptions


class Command(BaseCommand):
    help = 'Seed categories and products with sample data'

    def download_image(self, url, filename):
        """Download image from URL and return as ContentFile"""
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return ContentFile(response.content, name=filename)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Failed to download image: {e}'))
        return None

    def handle(self, *args, **options):
        self.stdout.write('Seeding categories and products...')

        # Create or get measure unit
        measure, _ = Descriptions.objects.get_or_create(
            name_uz="dona",
            name_ru="шт"
        )

        # ============ FAST FOOD CATEGORIES ============
        # Category 1: Hot-dog
        hotdog_cat, _ = Category.objects.get_or_create(
            name_uz="Hot-dog",
            name_ru="Хот-дог"
        )

        # Category 2: Burgers
        burger_cat, _ = Category.objects.get_or_create(
            name_uz="Burgerlar",
            name_ru="Бургеры"
        )

        # Category 3: Pizza
        pizza_cat, _ = Category.objects.get_or_create(
            name_uz="Pizza",
            name_ru="Пицца"
        )

        # ============ TO'RTLAR (CAKES) CATEGORIES ============
        # Category 4: Birthday cakes
        birthday_cat, _ = Category.objects.get_or_create(
            name_uz="Tug'ilgan kun tortlari",
            name_ru="Торты на день рождения"
        )

        # Category 5: Wedding cakes
        wedding_cat, _ = Category.objects.get_or_create(
            name_uz="To'y tortlari",
            name_ru="Свадебные торты"
        )

        # Category 6: Desserts
        dessert_cat, _ = Category.objects.get_or_create(
            name_uz="Desertlar",
            name_ru="Десерты"
        )

        # ============ GULLAR (FLOWERS) CATEGORIES ============
        # Category 7: Roses
        roses_cat, _ = Category.objects.get_or_create(
            name_uz="Atirgullar",
            name_ru="Розы"
        )

        # Category 8: Bouquets
        bouquet_cat, _ = Category.objects.get_or_create(
            name_uz="Buketlar",
            name_ru="Букеты"
        )

        # Category 9: Indoor plants
        plants_cat, _ = Category.objects.get_or_create(
            name_uz="Uy o'simliklari",
            name_ru="Комнатные растения"
        )

        self.stdout.write(self.style.SUCCESS('Categories created!'))

        # ============ HOT-DOG PRODUCTS ============
        hotdog_products = [
            {
                'name_uz': "Klassik Hot-dog",
                'name_ru': "Классический Хот-дог",
                'price': "15 000 UZS",
                'desc_uz': "🌭 An'anaviy hot-dog sosiska va yangi non bilan\n✨ Ketchup va gorchitsa bilan\n🥒 Tuzlangan bodring bilan",
                'desc_ru': "🌭 Традиционный хот-дог с сосиской и свежей булочкой\n✨ С кетчупом и горчицей\n🥒 С маринованным огурцом",
                'img_url': "https://images.unsplash.com/photo-1612392062126-3e6cc72d5a39?w=500"
            },
            {
                'name_uz': "Pishloqli Hot-dog",
                'name_ru': "Сырный Хот-дог",
                'price': "18 000 UZS",
                'desc_uz': "🧀 Eritilgan pishloq bilan\n🌭 Katta sosiska\n🍞 Yumshoq non",
                'desc_ru': "🧀 С плавленым сыром\n🌭 Большая сосиска\n🍞 Мягкая булочка",
                'img_url': "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=500"
            },
            {
                'name_uz': "BBQ Hot-dog",
                'name_ru': "BBQ Хот-дог",
                'price': "20 000 UZS",
                'desc_uz': "🔥 BBQ sous bilan\n🥓 Bekon bo'laklari bilan\n🧅 Piyoz halqalari bilan",
                'desc_ru': "🔥 С соусом BBQ\n🥓 С кусочками бекона\n🧅 С луковыми кольцами",
                'img_url': "https://images.unsplash.com/photo-1496054478555-d14192a4f1f8?w=500"
            },
            {
                'name_uz': "Mega Hot-dog",
                'name_ru': "Мега Хот-дог",
                'price': "25 000 UZS",
                'desc_uz': "🌭🌭 Ikki sosiska\n🧀 Ikki xil pishloq\n🥬 Ko'katlar bilan\n⭐ Maxsus sous",
                'desc_ru': "🌭🌭 Две сосиски\n🧀 Два вида сыра\n🥬 С зеленью\n⭐ Специальный соус",
                'img_url': "https://images.unsplash.com/photo-1613143669221-ec6574367ff3?w=500"
            },
        ]

        # ============ BURGER PRODUCTS ============
        burger_products = [
            {
                'name_uz': "Klassik Burger",
                'name_ru': "Классический Бургер",
                'price': "25 000 UZS",
                'desc_uz': "🍔 100% mol go'shti kotleti\n🥬 Yangi salat barglari\n🍅 Pomidor va piyoz\n🥒 Tuzlangan bodring",
                'desc_ru': "🍔 100% говяжья котлета\n🥬 Свежие листья салата\n🍅 Помидор и лук\n🥒 Маринованный огурец",
                'img_url': "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500"
            },
            {
                'name_uz': "Chicken Burger",
                'name_ru': "Чикен Бургер",
                'price': "22 000 UZS",
                'desc_uz': "🍗 Tovuq filesi\n🥗 Salat va sous\n🧀 Eritilgan pishloq\n🍞 Yumshoq bulochka",
                'desc_ru': "🍗 Куриное филе\n🥗 Салат и соус\n🧀 Плавленый сыр\n🍞 Мягкая булочка",
                'img_url': "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500"
            },
            {
                'name_uz': "Double Cheeseburger",
                'name_ru': "Двойной Чизбургер",
                'price': "35 000 UZS",
                'desc_uz': "🍔🍔 Ikki kotlet\n🧀🧀 Ikki qavat pishloq\n🥓 Bekon\n⭐ Maxsus burger sousi",
                'desc_ru': "🍔🍔 Две котлеты\n🧀🧀 Два слоя сыра\n🥓 Бекон\n⭐ Специальный бургер соус",
                'img_url': "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500"
            },
            {
                'name_uz': "Veggie Burger",
                'name_ru': "Вегги Бургер",
                'price': "20 000 UZS",
                'desc_uz': "🥬 Sabzavotli kotlet\n🥑 Avokado\n🍅 Yangi sabzavotlar\n🌿 Vegetarian",
                'desc_ru': "🥬 Овощная котлета\n🥑 Авокадо\n🍅 Свежие овощи\n🌿 Вегетарианский",
                'img_url': "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=500"
            },
        ]

        # ============ PIZZA PRODUCTS ============
        pizza_products = [
            {
                'name_uz': "Margherita Pizza",
                'name_ru': "Пицца Маргарита",
                'price': "45 000 UZS",
                'desc_uz': "🍕 Italyan klassikasi\n🧀 Mozzarella pishloq\n🍅 Pomidor sousi\n🌿 Yangi rayhon",
                'desc_ru': "🍕 Итальянская классика\n🧀 Сыр моцарелла\n🍅 Томатный соус\n🌿 Свежий базилик",
                'img_url': "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500"
            },
            {
                'name_uz': "Pepperoni Pizza",
                'name_ru': "Пицца Пепперони",
                'price': "55 000 UZS",
                'desc_uz': "🍕 Eng mashhur pizza\n🥓 Pepperoni kolbasa\n🧀 Ko'p pishloq\n🌶️ Biroz achchiq",
                'desc_ru': "🍕 Самая популярная пицца\n🥓 Колбаса пепперони\n🧀 Много сыра\n🌶️ Немного острая",
                'img_url': "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500"
            },
            {
                'name_uz': "4 Pishloqli Pizza",
                'name_ru': "Пицца 4 сыра",
                'price': "60 000 UZS",
                'desc_uz': "🧀 Mozzarella\n🧀 Parmezan\n🧀 Gorgonzola\n🧀 Ricotta\n⭐ Pishloq ishqibozlari uchun",
                'desc_ru': "🧀 Моцарелла\n🧀 Пармезан\n🧀 Горгонзола\n🧀 Рикотта\n⭐ Для любителей сыра",
                'img_url': "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500"
            },
            {
                'name_uz': "BBQ Tovuqli Pizza",
                'name_ru': "Пицца BBQ с курицей",
                'price': "58 000 UZS",
                'desc_uz': "🍗 Grilyaj tovuq\n🔥 BBQ sous\n🧅 Qizil piyoz\n🧀 Mozzarella",
                'desc_ru': "🍗 Курица гриль\n🔥 Соус BBQ\n🧅 Красный лук\n🧀 Моцарелла",
                'img_url': "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500"
            },
        ]

        # ============ BIRTHDAY CAKE PRODUCTS ============
        birthday_products = [
            {
                'name_uz': "Shokoladli Tort",
                'name_ru': "Шоколадный Торт",
                'price': "150 000 UZS",
                'desc_uz': "🎂 Klassik shokoladli tort\n🍫 Belgiya shokoladi\n🎉 Tug'ilgan kun uchun ideal\n⭐ 1 kg",
                'desc_ru': "🎂 Классический шоколадный торт\n🍫 Бельгийский шоколад\n🎉 Идеально для дня рождения\n⭐ 1 кг",
                'img_url': "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500"
            },
            {
                'name_uz': "Qulupnayli Tort",
                'name_ru': "Клубничный Торт",
                'price': "180 000 UZS",
                'desc_uz': "🍓 Yangi qulupnay bilan\n🍰 Yengil krem\n💕 Romantik dizayn\n⭐ 1.2 kg",
                'desc_ru': "🍓 Со свежей клубникой\n🍰 Лёгкий крем\n💕 Романтичный дизайн\n⭐ 1.2 кг",
                'img_url': "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500"
            },
            {
                'name_uz': "Bolalar Torti",
                'name_ru': "Детский Торт",
                'price': "200 000 UZS",
                'desc_uz': "🎈 Rang-barang dizayn\n🧁 Multfilm qahramonlari\n🎁 Bolalar uchun maxsus\n⭐ 1.5 kg",
                'desc_ru': "🎈 Яркий дизайн\n🧁 Герои мультфильмов\n🎁 Специально для детей\n⭐ 1.5 кг",
                'img_url': "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=500"
            },
            {
                'name_uz': "Red Velvet Tort",
                'name_ru': "Торт Красный Бархат",
                'price': "220 000 UZS",
                'desc_uz': "❤️ Qizil baxmal\n🧀 Krem-pishloq qatlami\n✨ Premium sifat\n⭐ 1.5 kg",
                'desc_ru': "❤️ Красный бархат\n🧀 Крем-чиз прослойка\n✨ Премиум качество\n⭐ 1.5 кг",
                'img_url': "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=500"
            },
        ]

        # ============ WEDDING CAKE PRODUCTS ============
        wedding_products = [
            {
                'name_uz': "Klassik To'y Torti",
                'name_ru': "Классический Свадебный Торт",
                'price': "500 000 UZS",
                'desc_uz': "💒 3 qavatli oq tort\n🌸 Gul bezaklari\n💍 To'y uchun ideal\n⭐ 5 kg",
                'desc_ru': "💒 3-ярусный белый торт\n🌸 Цветочные украшения\n💍 Идеально для свадьбы\n⭐ 5 кг",
                'img_url': "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=500"
            },
            {
                'name_uz': "Zamonaviy To'y Torti",
                'name_ru': "Современный Свадебный Торт",
                'price': "650 000 UZS",
                'desc_uz': "🎨 Minimalist dizayn\n🌿 Tabiat uslubi\n💫 Zamonaviy juftliklar uchun\n⭐ 6 kg",
                'desc_ru': "🎨 Минималистичный дизайн\n🌿 Природный стиль\n💫 Для современных пар\n⭐ 6 кг",
                'img_url': "https://images.unsplash.com/photo-1522767131822-6741b3b0fe8b?w=500"
            },
            {
                'name_uz': "Oltin To'y Torti",
                'name_ru': "Золотой Свадебный Торт",
                'price': "800 000 UZS",
                'desc_uz': "👑 Oltin bezaklar\n🍰 5 qavat\n✨ Hashamatli dizayn\n⭐ 8 kg",
                'desc_ru': "👑 Золотые украшения\n🍰 5 ярусов\n✨ Роскошный дизайн\n⭐ 8 кг",
                'img_url': "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=500"
            },
            {
                'name_uz': "Romantik To'y Torti",
                'name_ru': "Романтичный Свадебный Торт",
                'price': "550 000 UZS",
                'desc_uz': "💕 Pushti ranglar\n🌹 Atirgul bezaklari\n💝 Sevgi mavzusi\n⭐ 5 kg",
                'desc_ru': "💕 Розовые тона\n🌹 Украшения из роз\n💝 Тема любви\n⭐ 5 кг",
                'img_url': "https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?w=500"
            },
        ]

        # ============ DESSERT PRODUCTS ============
        dessert_products = [
            {
                'name_uz': "Tiramisu",
                'name_ru': "Тирамису",
                'price': "35 000 UZS",
                'desc_uz': "☕ Italyan klasssikasi\n🍫 Kakao kukunli\n🧀 Maskarpone pishloq\n✨ 1 porsiya",
                'desc_ru': "☕ Итальянская классика\n🍫 С какао порошком\n🧀 Сыр маскарпоне\n✨ 1 порция",
                'img_url': "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500"
            },
            {
                'name_uz': "Cheesecake",
                'name_ru': "Чизкейк",
                'price': "40 000 UZS",
                'desc_uz': "🧀 Nyu-York uslubi\n🍓 Qulupnay sousi\n🍪 Pechenye asosi\n✨ 1 porsiya",
                'desc_ru': "🧀 Нью-Йорк стиль\n🍓 Клубничный соус\n🍪 Основа из печенья\n✨ 1 порция",
                'img_url': "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=500"
            },
            {
                'name_uz': "Eklер",
                'name_ru': "Эклер",
                'price': "15 000 UZS",
                'desc_uz': "🥐 Fransuz pishirig'i\n🍫 Shokolad glazuri\n🍦 Krem to'ldiruvchi\n✨ 1 dona",
                'desc_ru': "🥐 Французская выпечка\n🍫 Шоколадная глазурь\n🍦 Кремовая начинка\n✨ 1 штука",
                'img_url': "https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=500"
            },
            {
                'name_uz': "Panna Cotta",
                'name_ru': "Панна Котта",
                'price': "30 000 UZS",
                'desc_uz': "🍮 Italyan deserti\n🍓 Mevali sous\n🥛 Qaymoqli konsistensiya\n✨ 1 porsiya",
                'desc_ru': "🍮 Итальянский десерт\n🍓 Фруктовый соус\n🥛 Сливочная консистенция\n✨ 1 порция",
                'img_url': "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500"
            },
        ]

        # ============ ROSES PRODUCTS ============
        roses_products = [
            {
                'name_uz': "Qizil Atirgullar (11 dona)",
                'name_ru': "Красные Розы (11 шт)",
                'price': "150 000 UZS",
                'desc_uz': "🌹 11 ta qizil atirgul\n💕 Sevgi ifodalash uchun\n🎀 Chiroyli o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "🌹 11 красных роз\n💕 Для выражения любви\n🎀 Красивая упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1518882605630-8eb771897914?w=500"
            },
            {
                'name_uz': "Oq Atirgullar (15 dona)",
                'name_ru': "Белые Розы (15 шт)",
                'price': "200 000 UZS",
                'desc_uz': "🤍 15 ta oq atirgul\n✨ Soflik ramzi\n🎀 Premium o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "🤍 15 белых роз\n✨ Символ чистоты\n🎀 Премиум упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1559563362-c667ba5f5480?w=500"
            },
            {
                'name_uz': "Pushti Atirgullar (21 dona)",
                'name_ru': "Розовые Розы (21 шт)",
                'price': "280 000 UZS",
                'desc_uz': "🌸 21 ta pushti atirgul\n💝 Nozik his-tuyg'ular\n🎀 Hashamatli o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "🌸 21 розовая роза\n💝 Нежные чувства\n🎀 Роскошная упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=500"
            },
            {
                'name_uz': "Aralash Atirgullar (25 dona)",
                'name_ru': "Микс Роз (25 шт)",
                'price': "350 000 UZS",
                'desc_uz': "🌹 25 ta turli rangli atirgul\n🎨 Rang-barang buket\n🎀 Eksklyuziv o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "🌹 25 разноцветных роз\n🎨 Яркий букет\n🎀 Эксклюзивная упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=500"
            },
        ]

        # ============ BOUQUET PRODUCTS ============
        bouquet_products = [
            {
                'name_uz': "Bahoriy Buket",
                'name_ru': "Весенний Букет",
                'price': "180 000 UZS",
                'desc_uz': "🌷 Lolalar va nargislar\n🌸 Bahoriy kayfiyat\n🎀 Yashil o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "🌷 Тюльпаны и нарциссы\n🌸 Весеннее настроение\n🎀 Зелёная упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=500"
            },
            {
                'name_uz': "Romantik Buket",
                'name_ru': "Романтичный Букет",
                'price': "250 000 UZS",
                'desc_uz': "💕 Atirgul va pионlar\n🌿 Ko'katlar bilan\n🎀 Pushti o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "💕 Розы и пионы\n🌿 С зеленью\n🎀 Розовая упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500"
            },
            {
                'name_uz': "Dala Gullari Buketi",
                'name_ru': "Букет Полевых Цветов",
                'price': "120 000 UZS",
                'desc_uz': "🌻 Dala gullari\n🌾 Tabiiy uslub\n🎀 Kraft qog'oz o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "🌻 Полевые цветы\n🌾 Природный стиль\n🎀 Упаковка крафт-бумага\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1444021465936-c6ca81d39b84?w=500"
            },
            {
                'name_uz': "Premium Buket",
                'name_ru': "Премиум Букет",
                'price': "450 000 UZS",
                'desc_uz': "👑 Ekzotik gullar\n🌺 Orxideyalar\n✨ VIP o'ram\n📦 Yetkazib berish bepul",
                'desc_ru': "👑 Экзотические цветы\n🌺 Орхидеи\n✨ VIP упаковка\n📦 Бесплатная доставка",
                'img_url': "https://images.unsplash.com/photo-1520763185298-1b434c919102?w=500"
            },
        ]

        # ============ INDOOR PLANTS PRODUCTS ============
        plants_products = [
            {
                'name_uz': "Monstera",
                'name_ru': "Монстера",
                'price': "200 000 UZS",
                'desc_uz': "🌿 Katta barglar\n🏠 Uy bezagi uchun\n💧 Kam suv talab qiladi\n🌱 Oson parvarish",
                'desc_ru': "🌿 Крупные листья\n🏠 Для украшения дома\n💧 Требует мало воды\n🌱 Лёгкий уход",
                'img_url': "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=500"
            },
            {
                'name_uz': "Fikus",
                'name_ru': "Фикус",
                'price': "150 000 UZS",
                'desc_uz': "🌳 Klassik uy o'simligi\n🍃 Yashil barglar\n🏢 Ofis uchun ideal\n🌱 O'rtacha parvarish",
                'desc_ru': "🌳 Классическое комнатное растение\n🍃 Зелёные листья\n🏢 Идеально для офиса\n🌱 Средний уход",
                'img_url': "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=500"
            },
            {
                'name_uz': "Kaktus To'plami",
                'name_ru': "Набор Кактусов",
                'price': "80 000 UZS",
                'desc_uz': "🌵 3 ta mini kaktus\n🏜️ Suv kam talab qiladi\n🎁 Sovg'a sifatida ideal\n🌱 Juda oson parvarish",
                'desc_ru': "🌵 3 мини кактуса\n🏜️ Требует мало воды\n🎁 Идеально для подарка\n🌱 Очень лёгкий уход",
                'img_url': "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=500"
            },
            {
                'name_uz': "Sukkulent To'plami",
                'name_ru': "Набор Суккулентов",
                'price': "100 000 UZS",
                'desc_uz': "🪴 5 ta sukkulent\n💚 Turli shakllar\n🏡 Stol uchun ideal\n🌱 Juda oson parvarish",
                'desc_ru': "🪴 5 суккулентов\n💚 Разные формы\n🏡 Идеально для стола\n🌱 Очень лёгкий уход",
                'img_url': "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=500"
            },
        ]

        # Create all products
        all_products = [
            (hotdog_cat, hotdog_products),
            (burger_cat, burger_products),
            (pizza_cat, pizza_products),
            (birthday_cat, birthday_products),
            (wedding_cat, wedding_products),
            (dessert_cat, dessert_products),
            (roses_cat, roses_products),
            (bouquet_cat, bouquet_products),
            (plants_cat, plants_products),
        ]

        for category, products in all_products:
            for product_data in products:
                # Check if product already exists
                existing = Product.objects.filter(
                    name_uz=product_data['name_uz'],
                    category=category
                ).first()

                if existing:
                    self.stdout.write(f"  Skipping existing: {product_data['name_ru']}")
                    continue

                # Download image
                img_content = self.download_image(
                    product_data['img_url'],
                    f"{product_data['name_uz'].replace(' ', '_')}.jpg"
                )

                product = Product(
                    name_uz=product_data['name_uz'],
                    name_ru=product_data['name_ru'],
                    price=product_data['price'],
                    desc_uz=product_data['desc_uz'],
                    desc_ru=product_data['desc_ru'],
                    category=category,
                    measure=measure,
                )

                if img_content:
                    product.img = img_content
                    # Save base64
                    img_content.seek(0)
                    product.img_64 = base64.b64encode(img_content.read()).decode('utf-8')

                product.save()
                self.stdout.write(f"  Created: {product_data['name_ru']}")

        self.stdout.write(self.style.SUCCESS('\nAll categories and products created successfully!'))
        self.stdout.write(f"\nSummary:")
        self.stdout.write(f"  Categories: {Category.objects.count()}")
        self.stdout.write(f"  Products: {Product.objects.count()}")
