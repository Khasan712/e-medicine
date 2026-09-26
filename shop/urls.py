from django.urls import path

from . import views

app_name = 'shop'

urlpatterns = [
    path('', views.index, name='index'),
    path('img/<int:pk>/', views.product_image, name='product_image'),

    path('api/bootstrap/', views.bootstrap, name='bootstrap'),
    path('api/auth/telegram/webapp/', views.auth_telegram_webapp, name='auth_telegram_webapp'),
    path('api/auth/telegram/start/', views.auth_telegram_start, name='auth_telegram_start'),
    path('api/auth/telegram/check/', views.auth_telegram_check, name='auth_telegram_check'),
    path('api/auth/phone/request/', views.auth_phone_request, name='auth_phone_request'),
    path('api/auth/phone/verify/', views.auth_phone_verify, name='auth_phone_verify'),
    path('api/me/', views.me, name='me'),
    path('api/orders/', views.orders, name='orders'),
    path('api/orders/<int:pk>/', views.order_detail, name='order_detail'),
]
