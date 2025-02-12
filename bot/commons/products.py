from commons.constants import UZBEK_LANG, RUSSIAN_LANG
import re
from commons.dictionary import DICTIONARY
import pytz

TASHKENT_TZ = pytz.timezone("Asia/Tashkent")


def get_product_detail_template(
        name, desc, price, quantity, lang, measure=None, manufacturer=None
):
    price_int = int(re.sub(r"\D", "", price))
    cur = str(price).split()[-1]
    if cur.isdigit():
        cur = ''

    if lang == UZBEK_LANG:
        text = f"🛍️ <b>{name}</b>\n" \
               f"\n📄 <b>Ma'lumot:</b> {desc}\n"
        if manufacturer:
            text += f"\n🏭 <b>Ishlab chiqaruvchi:</b> {manufacturer}\n"
        if measure:
            text += f"\n📏 <b>{measure}</b>\n"
        text += f"\n💰 {price}\n"\
                f"\n💵 Umumiy: {int(price_int) * quantity} {cur}"
        return text
    else:
        text = f"🛍️ <b>{name}</b>\n"\
               f"\n📄 Описание: {desc}\n"
        if manufacturer:
            text += f"\n🏭 <b>Производитель:</b> {manufacturer}\n"
        if measure:
            text += f"\n📏 <b>{measure}</b>\n"
        text += f"\n💰 {price}\n"\
                f"\n💵 Общая сумма: {int(price_int) * quantity} {cur}"
        return text


def get_order_items_detail_template(order_items, lang, order):
    total = 0
    updated_time = order.updated_at.astimezone(TASHKENT_TZ).strftime("%Y-%m-%d %H:%M") if order.updated_at else "N/A"
    status = DICTIONARY['34'][lang][order.status]
    text = f"ID: {order.id} | {DICTIONARY['33'][lang]}: {status}\n\n"
    for order_item in order_items:
        price = int(re.sub(r"\D", "", order_item.product.price))
        cur = str(order_item.product.price).split()[-1]
        if cur.isdigit():
            cur = ''
        quantity = int(order_item.quantity)
        item_total = price * quantity

        if lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {item_total} {cur}"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {item_total} {cur}"
            total += int(item_total)
    if lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {total}\n" \
                f"{DICTIONARY['32'][lang]}: {updated_time}"
    else:
        text += f"\n\n💵 Общая сумма: {total}\n" \
                f"{DICTIONARY['32'][lang]}: {updated_time}"
    return text


def get_order_items_template(order_items, lang):
    text = ""
    total = 0
    for order_item in order_items:
        price = int(re.sub(r"\D", "", order_item.product.price))
        quantity = int(order_item.quantity)
        item_total = price * quantity
        cur = str(order_item.product.price).split()[-1]
        if lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {item_total} {cur}"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {item_total} {cur}"
            total += int(item_total)
    if lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {total}"
    else:
        text += f"\n\n💵 Общая сумма: {total}"
    return text


def get_order_confirm_template(order_items, client):
    text = ""
    total = 0
    for order_item in order_items:
        price = int(re.sub(r"\D", "", order_item.product.price))
        quantity = int(order_item.quantity)
        item_total = price * quantity
        cur = str(order_item.product.price).split()[-1]

        if client.lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {item_total} {cur}"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {item_total} {cur}"
            total += int(item_total)
    if client.lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {total}\n\n"
    elif client.lang == RUSSIAN_LANG:
        text += f"\n\n💵 Общая сумма: {total}\n\n"
    if client.first_name:
        text += f"{DICTIONARY['39'][client.lang]}: {client.first_name}\n"
    else:
        text += f"{DICTIONARY['40'][client.lang]}\n"
    if client.phone:
        text += f"{DICTIONARY['24'][client.lang]}: {client.phone}\n"
    else:
        text += f"{DICTIONARY['28'][client.lang]}\n"
    if client.location:
        text += f"📍:  {client.location}"
    else:
        text += f"{DICTIONARY['23'][client.lang]}"
    return text
