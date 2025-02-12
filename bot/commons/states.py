from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup


class UserState(StatesGroup):
    main_menu = State()
    products = State()
    select_category = State()
    category_selected = State()
    product_detail = State()
    orders = State()
    search = State()
    cart = State()
    order_update_first_name = State()
    order_update_location = State()
    order_update_phone = State()
    my_orders_detail = State()


async def clear_quantity_states(state: FSMContext):
    """Remove all 'quantity_' keys without affecting other stored states."""
    data = await state.get_data()
    filtered_data = {k: v for k, v in data.items() if not k.startswith("quantity_")}

    await state.set_data(filtered_data)
