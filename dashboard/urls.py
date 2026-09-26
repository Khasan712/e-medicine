from django.urls import path
from . import views, sales

app_name = 'dashboard'

urlpatterns = [
    # Sales (orders created by staff, by hand or by voice)
    path('sales/', sales.sales_pos, name='sales_pos'),
    path('sales/create/', sales.sales_create, name='sales_create'),
    path('sales/voice/token/', sales.sales_voice_token, name='sales_voice_token'),
    path('sales/voice/parse/', sales.sales_voice_parse, name='sales_voice_parse'),

    # Authentication
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Language & Theme
    path('switch-language/', views.switch_language, name='switch_language'),
    path('switch-theme/', views.switch_theme, name='switch_theme'),

    # Dashboard
    path('', views.dashboard_view, name='dashboard'),

    # Orders
    path('orders/', views.orders_list, name='orders_list'),
    path('orders/<int:pk>/', views.order_detail, name='order_detail'),
    path('orders/<int:pk>/update-status/', views.order_update_status, name='order_update_status'),

    # Clients
    path('clients/', views.clients_list, name='clients_list'),
    path('clients/<int:pk>/', views.client_detail, name='client_detail'),
    path('clients/<int:pk>/edit/', views.client_edit, name='client_edit'),

    # Products
    path('products/', views.products_list, name='products_list'),
    path('products/create/', views.product_create, name='product_create'),
    path('products/<int:pk>/', views.product_detail, name='product_detail'),
    path('products/<int:pk>/edit/', views.product_edit, name='product_edit'),
    path('products/<int:pk>/delete/', views.product_delete, name='product_delete'),

    # Categories
    path('categories/', views.categories_list, name='categories_list'),
    path('categories/create/', views.category_create, name='category_create'),
    path('categories/<int:pk>/edit/', views.category_edit, name='category_edit'),
    path('categories/<int:pk>/delete/', views.category_delete, name='category_delete'),

    # Users (System Users)
    path('users/', views.users_list, name='users_list'),
    path('users/create/', views.user_create, name='user_create'),
    path('users/<int:pk>/', views.user_detail, name='user_detail'),
    path('users/<int:pk>/edit/', views.user_edit, name='user_edit'),
    path('users/<int:pk>/delete/', views.user_delete, name='user_delete'),

    # HTMX Partials
    path('partials/orders-table/', views.orders_table_partial, name='orders_table_partial'),
    path('partials/clients-table/', views.clients_table_partial, name='clients_table_partial'),
    path('partials/products-table/', views.products_table_partial, name='products_table_partial'),
]
