"""Customer messages for the bot service (see Outbox): only customers who use the customers' bot get them."""
from .models import Outbox

STATUS_EVENTS = ('accepted', 'on_the_way', 'completed', 'rejected')


def reaches_telegram(order):
    return bool(order.client_id and order.client.tg_id)


def queue_order_created(order):
    if reaches_telegram(order):
        Outbox.objects.create(kind=Outbox.KIND_ORDER_CREATED, order=order)


def queue_order_status(order, event):
    if event in STATUS_EVENTS and reaches_telegram(order):
        Outbox.objects.create(kind=Outbox.KIND_ORDER_STATUS, order=order, event=event)
