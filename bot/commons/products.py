from commons.constants import UZBEK_LANG, RUSSIAN_LANG
import re
from commons.dictionary import DICTIONARY
import pytz

TASHKENT_TZ = pytz.timezone("Asia/Tashkent")


def get_product_detail_template(name, desc, price, quantity, lang):
    price = int(re.sub(r"\D", "", price))

    if lang == UZBEK_LANG:
        return f"🛍️ <b>{name}</b>\n" \
               f"📄 Ma'lumot: {desc}\n\n" \
               f"💰 {price} x {quantity} = {int(price) * quantity} UZS\n" \
               f"💵 Umumiy: {int(price) * quantity} UZS"
    return f"🛍️ <b>{name}</b>\n" \
           f"📄 Описание: {desc}\n\n" \
           f"💰 {price} x {quantity} = {int(price) * quantity} UZS\n" \
           f"💵 Общая сумма: {int(price) * quantity} UZS"


def get_order_items_detail_template(order_items, lang, order):
    total = 0
    updated_time = order.updated_at.astimezone(TASHKENT_TZ).strftime("%Y-%m-%d %H:%M") if order.updated_at else "N/A"
    status = DICTIONARY['34'][lang][order.status]
    text = f"ID: {order.id} | {DICTIONARY['33'][lang]}: {status}\n\n"
    for order_item in order_items:
        price = int(re.sub(r"\D", "", order_item.product.price))
        quantity = int(order_item.quantity)
        item_total = price * quantity

        if lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {item_total} UZS"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {item_total} UZS"
            total += int(item_total)
    if lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {total} UZS\n" \
                f"{DICTIONARY['32'][lang]}: {updated_time}"
    else:
        text += f"\n\n💵 Общая сумма: {total} UZS\n" \
                f"{DICTIONARY['32'][lang]}: {updated_time}"
    return text


def get_order_items_template(order_items, lang):
    text = ""
    total = 0
    for order_item in order_items:
        price = int(re.sub(r"\D", "", order_item.product.price))
        quantity = int(order_item.quantity)
        item_total = price * quantity

        if lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {item_total} UZS"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {item_total} UZS"
            total += int(item_total)
    if lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {total} UZS"
    else:
        text += f"\n\n💵 Общая сумма: {total} UZS"
    return text


def get_order_confirm_template(order_items, client):
    text = ""
    total = 0
    for order_item in order_items:
        price = int(re.sub(r"\D", "", order_item.product.price))
        quantity = int(order_item.quantity)
        item_total = price * quantity

        if client.lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {item_total} UZS"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {item_total} UZS"
            total += int(item_total)
    if client.lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {total} UZS\n\n"
    else:
        text += f"\n\n💵 Общая сумма: {total} UZS\n\n"
    text += f"{DICTIONARY['24'][client.lang]}: {client.phone}\n"
    if client.location:
        text += f"📍:  {client.location}"
    else:
        text += f"{DICTIONARY['23'][client.lang]}"
    return text
