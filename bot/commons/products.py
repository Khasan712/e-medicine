import re
import pytz
from commons.dictionary import DICTIONARY
from commons.utils import price_reformat_float, extract_price, get_total, format_price
from commons.constants import UZBEK_LANG, RUSSIAN_LANG, UZS_CURRENCY

TASHKENT_TZ = pytz.timezone("Asia/Tashkent")


def get_product_detail_template(
        name, desc, price: str, quantity, lang, measure=None, manufacturer=None
):
    price_int = extract_price(price)

    if lang == UZBEK_LANG:
        text = f"🛍️ <b>{name}</b>\n" \
               f"\n📄 <b>Ma'lumot:</b> {desc}\n"
        if manufacturer:
            text += f"\n🏭 <b>Ishlab chiqaruvchi:</b> {manufacturer}\n"
        if measure:
            text += f"\n📏 <b>{measure}</b>\n"
        text += f"\n💰 {price}\n"\
                f"\n💵 Umumiy: {get_total(price_int, quantity)} {UZS_CURRENCY}"
        return text
    else:
        text = f"🛍️ <b>{name}</b>\n"\
               f"\n📄 Описание: {desc}\n"
        if manufacturer:
            text += f"\n🏭 <b>Производитель:</b> {manufacturer}\n"
        if measure:
            text += f"\n📏 <b>{measure}</b>\n"
        text += f"\n💰 {price}\n"\
                f"\n💵 Общая сумма: {get_total(price_int, quantity)} {UZS_CURRENCY}"
        return text


def get_order_items_detail_template(order_items, lang, order):
    total = 0
    updated_time = order.updated_at.astimezone(TASHKENT_TZ).strftime("%Y-%m-%d %H:%M") if order.updated_at else "N/A"
    status = DICTIONARY['34'][lang][order.status]
    text = f"ID: {order.id} | {DICTIONARY['33'][lang]}: {status}\n\n"
    for order_item in order_items:
        price = extract_price(order_item.product.price)
        quantity = int(order_item.quantity)
        item_total = price * quantity

        if lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {format_price(item_total)} {UZS_CURRENCY}"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {format_price(item_total)} {UZS_CURRENCY}"
            total += int(item_total)
    if lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {format_price(total)} {UZS_CURRENCY}\n" \
                f"{DICTIONARY['32'][lang]}: {updated_time}"
    else:
        text += f"\n\n💵 Общая сумма: {format_price(total)} {UZS_CURRENCY}\n" \
                f"{DICTIONARY['32'][lang]}: {updated_time}"
    return text


def get_order_items_template(order_items, lang):
    text = ""
    total = 0
    for order_item in order_items:
        price = extract_price(order_item.product.price)
        quantity = int(order_item.quantity)
        item_total = price * quantity
        if lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {format_price(item_total)} {UZS_CURRENCY}"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {format_price(item_total)} {UZS_CURRENCY}"
            total += int(item_total)
    if lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {format_price(total)} {UZS_CURRENCY}"
    else:
        text += f"\n\n💵 Общая сумма: {format_price(total)} {UZS_CURRENCY}"
    return text


def get_order_confirm_template(order_items, client):
    text = ""
    total = 0
    for order_item in order_items:
        price = extract_price(order_item.product.price)
        quantity = int(order_item.quantity)
        item_total = price * quantity

        if client.lang == UZBEK_LANG:
            text += f"\n🛍️ <b>{order_item.product.name_uz}</b> x {quantity} = {format_price(item_total)} {UZS_CURRENCY}"
            total += int(item_total)
        else:
            text += f"\n🛍️ <b>{order_item.product.name_ru}</b> x {quantity} = {format_price(item_total)} {UZS_CURRENCY}"
            total += int(item_total)
    if client.lang == UZBEK_LANG:
        text += f"\n\n💵 Umumiy: {format_price(total)} {UZS_CURRENCY}\n\n"
    elif client.lang == RUSSIAN_LANG:
        text += f"\n\n💵 Общая сумма: {format_price(total)} {UZS_CURRENCY}\n\n"
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
