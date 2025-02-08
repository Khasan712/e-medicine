from aiogram.fsm.state import State, StatesGroup


class UserState(StatesGroup):
    main_menu = State()
    products = State()
    product_detail = State()
    orders = State()
    search = State()
    cart = State()
    order_update_location = State()
    order_update_phone = State()
    my_orders_detail = State()
