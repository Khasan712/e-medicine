import base64
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncDate
from django.core.paginator import Paginator
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta

from app.models import Product, Category, Client, Order, OrderItem, Descriptions
from app.enums import OrderEnum, OrderSourceEnum
from .forms import (
    LoginForm, ProductForm, CategoryForm, ClientForm,
    OrderStatusForm, UserForm, UserCreateForm
)

User = get_user_model()


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard:dashboard')

    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            phone_number = form.cleaned_data['phone_number']
            password = form.cleaned_data['password']
            user = authenticate(request, username=phone_number, password=password)

            if user is not None:
                login(request, user)
                messages.success(request, 'Welcome back!')
                return redirect('dashboard:dashboard')
            else:
                messages.error(request, 'Invalid phone number or password')
    else:
        form = LoginForm()

    return render(request, 'dashboard/login.html', {'form': form})


def logout_view(request):
    logout(request)
    messages.info(request, 'You have been logged out')
    return redirect('dashboard:login')


def switch_language(request):
    """Switch dashboard language between Uzbek and Russian"""
    lang = request.GET.get('lang', 'uz')
    if lang not in ['uz', 'ru']:
        lang = 'uz'
    request.session['dashboard_lang'] = lang

    # Redirect back to the referring page or dashboard
    referer = request.META.get('HTTP_REFERER')
    if referer:
        return redirect(referer)
    return redirect('dashboard:dashboard')


def switch_theme(request):
    """Toggle dashboard theme between light and dark"""
    current_theme = request.session.get('dashboard_theme', 'dark')
    new_theme = 'dark' if current_theme == 'light' else 'light'
    request.session['dashboard_theme'] = new_theme

    # Redirect back to the referring page or dashboard
    referer = request.META.get('HTTP_REFERER')
    if referer:
        return redirect(referer)
    return redirect('dashboard:dashboard')


@login_required(login_url='dashboard:login')
def dashboard_view(request):
    # Get date range for statistics
    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # Order statistics
    total_orders = Order.objects.exclude(status=OrderEnum.new.value).count()
    new_orders = Order.objects.filter(status=OrderEnum.ordered.value).count()
    orders_on_way = Order.objects.filter(status=OrderEnum.on_the_way.value).count()
    completed_orders = Order.objects.filter(status=OrderEnum.completed.value).count()

    # Recent orders (last 7 days)
    recent_orders = Order.objects.exclude(
        status=OrderEnum.new.value
    ).filter(
        created_at__date__gte=week_ago
    ).count()

    # Client statistics
    total_clients = Client.objects.count()
    new_clients_week = Client.objects.filter(created_at__date__gte=week_ago).count()

    # Product statistics
    total_products = Product.objects.count()
    total_categories = Category.objects.count()

    # Recent orders for dashboard table
    latest_orders = Order.objects.exclude(
        status=OrderEnum.new.value
    ).select_related('client').order_by('-created_at')[:10]

    # Orders by status for chart
    orders_by_status = Order.objects.exclude(
        status=OrderEnum.new.value
    ).values('status').annotate(count=Count('id'))

    # Daily orders for last 7 days
    daily_orders = Order.objects.exclude(
        status=OrderEnum.new.value
    ).filter(
        created_at__date__gte=week_ago
    ).annotate(
        date=TruncDate('created_at')
    ).values('date').annotate(count=Count('id')).order_by('date')

    context = {
        'total_orders': total_orders,
        'new_orders': new_orders,
        'orders_on_way': orders_on_way,
        'completed_orders': completed_orders,
        'recent_orders': recent_orders,
        'total_clients': total_clients,
        'new_clients_week': new_clients_week,
        'total_products': total_products,
        'total_categories': total_categories,
        'latest_orders': latest_orders,
        # Serialized as JSON: the template embeds these in <script>, and date objects are not valid JS.
        'orders_by_status': json.dumps(list(orders_by_status)),
        'daily_orders': json.dumps([
            {'date': row['date'].isoformat(), 'count': row['count']} for row in daily_orders
        ]),
    }

    return render(request, 'dashboard/dashboard.html', context)


# ============ ORDERS ============

@login_required(login_url='dashboard:login')
def orders_list(request):
    status_filter = request.GET.get('status', '')
    source_filter = request.GET.get('source', '')
    search = request.GET.get('search', '')

    orders = Order.objects.exclude(
        status=OrderEnum.new.value
    ).select_related('client').prefetch_related('order_items__product')

    if status_filter:
        orders = orders.filter(status=status_filter)

    if source_filter:
        orders = orders.filter(source=source_filter)

    if search:
        orders = orders.filter(
            Q(client__first_name__icontains=search) |
            Q(client__last_name__icontains=search) |
            Q(client__phone__icontains=search) |
            Q(customer_name__icontains=search) |
            Q(phone__icontains=search) |
            Q(id__icontains=search)
        )

    orders = orders.order_by('-created_at')

    paginator = Paginator(orders, 15)
    page = request.GET.get('page', 1)
    orders = paginator.get_page(page)

    status_choices = [(status.value, status.name.replace('_', ' ').title()) for status in OrderEnum if status != OrderEnum.new]

    context = {
        'orders': orders,
        'status_choices': status_choices,
        'source_choices': [source.value for source in OrderSourceEnum],
        'current_status': status_filter,
        'current_source': source_filter,
        'search': search,
    }

    if request.headers.get('HX-Request'):
        return render(request, 'dashboard/partials/orders_table.html', context)

    return render(request, 'dashboard/orders/list.html', context)


@login_required(login_url='dashboard:login')
def order_detail(request, pk):
    order = get_object_or_404(
        Order.objects.select_related('client', 'created_by').prefetch_related('order_items__product'),
        pk=pk
    )

    total = order.get_total()

    form = OrderStatusForm(initial={'status': order.status})

    context = {
        'order': order,
        'total': total,
        'form': form,
    }

    return render(request, 'dashboard/orders/detail.html', context)


@login_required(login_url='dashboard:login')
def order_update_status(request, pk):
    order = get_object_or_404(Order, pk=pk)

    if request.method == 'POST':
        new_status = request.POST.get('status')
        if new_status:
            order.status = new_status
            order.save()
            messages.success(request, f'Order #{pk} status updated to {new_status}')

    if request.headers.get('HX-Request'):
        form = OrderStatusForm(initial={'status': order.status})
        return render(request, 'dashboard/partials/order_status_select.html', {
            'order': order,
            'form': form
        })

    return redirect('dashboard:order_detail', pk=pk)


@login_required(login_url='dashboard:login')
def orders_table_partial(request):
    return orders_list(request)


# ============ CLIENTS ============

@login_required(login_url='dashboard:login')
def clients_list(request):
    search = request.GET.get('search', '')

    clients = Client.objects.annotate(
        orders_count=Count('order', filter=~Q(order__status=OrderEnum.new.value))
    )

    if search:
        clients = clients.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(phone__icontains=search) |
            Q(tg_nick__icontains=search)
        )

    clients = clients.order_by('-created_at')

    paginator = Paginator(clients, 15)
    page = request.GET.get('page', 1)
    clients = paginator.get_page(page)

    context = {
        'clients': clients,
        'search': search,
    }

    if request.headers.get('HX-Request'):
        return render(request, 'dashboard/partials/clients_table.html', context)

    return render(request, 'dashboard/clients/list.html', context)


@login_required(login_url='dashboard:login')
def client_detail(request, pk):
    client = get_object_or_404(Client, pk=pk)
    orders = Order.objects.filter(
        client=client
    ).exclude(
        status=OrderEnum.new.value
    ).prefetch_related('order_items__product').order_by('-created_at')

    context = {
        'client': client,
        'orders': orders,
    }

    return render(request, 'dashboard/clients/detail.html', context)


@login_required(login_url='dashboard:login')
def client_edit(request, pk):
    client = get_object_or_404(Client, pk=pk)

    if request.method == 'POST':
        form = ClientForm(request.POST, instance=client)
        if form.is_valid():
            form.save()
            messages.success(request, 'Client updated successfully')
            return redirect('dashboard:client_detail', pk=pk)
    else:
        form = ClientForm(instance=client)

    context = {
        'client': client,
        'form': form,
    }

    return render(request, 'dashboard/clients/edit.html', context)


@login_required(login_url='dashboard:login')
def clients_table_partial(request):
    return clients_list(request)


# ============ PRODUCTS ============

@login_required(login_url='dashboard:login')
def products_list(request):
    search = request.GET.get('search', '')
    category_filter = request.GET.get('category', '')

    products = Product.objects.select_related('category', 'measure')

    if search:
        products = products.filter(
            Q(name_uz__icontains=search) |
            Q(name_ru__icontains=search) |
            Q(manufacturer_uz__icontains=search) |
            Q(manufacturer_ru__icontains=search)
        )

    if category_filter:
        products = products.filter(category_id=category_filter)

    products = products.order_by('-created_at')

    paginator = Paginator(products, 15)
    page = request.GET.get('page', 1)
    products = paginator.get_page(page)

    categories = Category.objects.all()

    context = {
        'products': products,
        'categories': categories,
        'search': search,
        'current_category': category_filter,
    }

    if request.headers.get('HX-Request'):
        return render(request, 'dashboard/partials/products_table.html', context)

    return render(request, 'dashboard/products/list.html', context)


@login_required(login_url='dashboard:login')
def product_detail(request, pk):
    product = get_object_or_404(Product.objects.select_related('category', 'measure'), pk=pk)

    context = {
        'product': product,
    }

    return render(request, 'dashboard/products/detail.html', context)


@login_required(login_url='dashboard:login')
def product_create(request):
    if request.method == 'POST':
        form = ProductForm(request.POST, request.FILES)
        if form.is_valid():
            product = form.save(commit=False)
            if 'img' in request.FILES:
                product._uploaded_image = request.FILES['img']
            product.save()
            messages.success(request, 'Product created successfully')
            return redirect('dashboard:products_list')
    else:
        form = ProductForm()

    context = {
        'form': form,
        'title': 'Create Product',
    }

    return render(request, 'dashboard/products/form.html', context)


@login_required(login_url='dashboard:login')
def product_edit(request, pk):
    product = get_object_or_404(Product, pk=pk)

    if request.method == 'POST':
        form = ProductForm(request.POST, request.FILES, instance=product)
        if form.is_valid():
            product = form.save(commit=False)
            if 'img' in request.FILES:
                product._uploaded_image = request.FILES['img']
            product.save()
            messages.success(request, 'Product updated successfully')
            return redirect('dashboard:product_detail', pk=pk)
    else:
        form = ProductForm(instance=product)

    context = {
        'form': form,
        'product': product,
        'title': 'Edit Product',
    }

    return render(request, 'dashboard/products/form.html', context)


@login_required(login_url='dashboard:login')
def product_delete(request, pk):
    product = get_object_or_404(Product, pk=pk)

    if request.method == 'POST':
        product.delete()
        messages.success(request, 'Product deleted successfully')
        return redirect('dashboard:products_list')

    context = {
        'product': product,
    }

    return render(request, 'dashboard/products/delete.html', context)


@login_required(login_url='dashboard:login')
def products_table_partial(request):
    return products_list(request)


# ============ CATEGORIES ============

@login_required(login_url='dashboard:login')
def categories_list(request):
    search = request.GET.get('search', '')

    categories = Category.objects.annotate(products_count=Count('product'))

    if search:
        categories = categories.filter(
            Q(name_uz__icontains=search) |
            Q(name_ru__icontains=search)
        )

    categories = categories.order_by('-created_at')

    paginator = Paginator(categories, 15)
    page = request.GET.get('page', 1)
    categories = paginator.get_page(page)

    context = {
        'categories': categories,
        'search': search,
    }

    return render(request, 'dashboard/categories/list.html', context)


@login_required(login_url='dashboard:login')
def category_create(request):
    if request.method == 'POST':
        form = CategoryForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Category created successfully')
            if request.headers.get('HX-Request'):
                return HttpResponse(status=204, headers={'HX-Trigger': 'categoryCreated'})
            return redirect('dashboard:categories_list')
    else:
        form = CategoryForm()

    context = {
        'form': form,
        'title': 'Create Category',
    }

    if request.headers.get('HX-Request'):
        return render(request, 'dashboard/partials/category_form_modal.html', context)

    return render(request, 'dashboard/categories/form.html', context)


@login_required(login_url='dashboard:login')
def category_edit(request, pk):
    category = get_object_or_404(Category, pk=pk)

    if request.method == 'POST':
        form = CategoryForm(request.POST, instance=category)
        if form.is_valid():
            form.save()
            messages.success(request, 'Category updated successfully')
            if request.headers.get('HX-Request'):
                return HttpResponse(status=204, headers={'HX-Trigger': 'categoryUpdated'})
            return redirect('dashboard:categories_list')
    else:
        form = CategoryForm(instance=category)

    context = {
        'form': form,
        'category': category,
        'title': 'Edit Category',
    }

    if request.headers.get('HX-Request'):
        return render(request, 'dashboard/partials/category_form_modal.html', context)

    return render(request, 'dashboard/categories/form.html', context)


@login_required(login_url='dashboard:login')
def category_delete(request, pk):
    category = get_object_or_404(Category, pk=pk)

    if request.method == 'POST':
        category.delete()
        messages.success(request, 'Category deleted successfully')
        if request.headers.get('HX-Request'):
            return HttpResponse(status=204, headers={'HX-Trigger': 'categoryDeleted'})
        return redirect('dashboard:categories_list')

    context = {
        'category': category,
    }

    if request.headers.get('HX-Request'):
        return render(request, 'dashboard/partials/delete_confirm_modal.html', {
            'object': category,
            'object_name': f'{category.name_uz} / {category.name_ru}',
            'delete_url': request.path,
        })

    return render(request, 'dashboard/categories/delete.html', context)


# ============ USERS ============

@login_required(login_url='dashboard:login')
def users_list(request):
    # Only admin can access users management
    if request.user.role != 'admin':
        messages.error(request, 'You do not have permission to access this page')
        return redirect('dashboard:dashboard')

    search = request.GET.get('search', '')

    users = User.objects.all()

    if search:
        users = users.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(phone_number__icontains=search)
        )

    users = users.order_by('-created_at')

    paginator = Paginator(users, 15)
    page = request.GET.get('page', 1)
    users = paginator.get_page(page)

    context = {
        'users': users,
        'search': search,
    }

    return render(request, 'dashboard/users/list.html', context)


@login_required(login_url='dashboard:login')
def user_detail(request, pk):
    if request.user.role != 'admin':
        messages.error(request, 'You do not have permission to access this page')
        return redirect('dashboard:dashboard')

    user = get_object_or_404(User, pk=pk)

    context = {
        'user_obj': user,
    }

    return render(request, 'dashboard/users/detail.html', context)


@login_required(login_url='dashboard:login')
def user_create(request):
    if request.user.role != 'admin':
        messages.error(request, 'You do not have permission to access this page')
        return redirect('dashboard:dashboard')

    if request.method == 'POST':
        form = UserCreateForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            messages.success(request, 'User created successfully')
            return redirect('dashboard:users_list')
    else:
        form = UserCreateForm()

    context = {
        'form': form,
        'title': 'Create User',
    }

    return render(request, 'dashboard/users/form.html', context)


@login_required(login_url='dashboard:login')
def user_edit(request, pk):
    if request.user.role != 'admin':
        messages.error(request, 'You do not have permission to access this page')
        return redirect('dashboard:dashboard')

    user = get_object_or_404(User, pk=pk)

    if request.method == 'POST':
        form = UserForm(request.POST, instance=user)
        if form.is_valid():
            user = form.save(commit=False)
            password = form.cleaned_data.get('password')
            if password:
                user.set_password(password)
            user.save()
            messages.success(request, 'User updated successfully')
            return redirect('dashboard:user_detail', pk=pk)
    else:
        form = UserForm(instance=user)

    context = {
        'form': form,
        'user_obj': user,
        'title': 'Edit User',
    }

    return render(request, 'dashboard/users/form.html', context)


@login_required(login_url='dashboard:login')
def user_delete(request, pk):
    if request.user.role != 'admin':
        messages.error(request, 'You do not have permission to access this page')
        return redirect('dashboard:dashboard')

    user = get_object_or_404(User, pk=pk)

    if user == request.user:
        messages.error(request, 'You cannot delete your own account')
        return redirect('dashboard:users_list')

    if request.method == 'POST':
        user.delete()
        messages.success(request, 'User deleted successfully')
        return redirect('dashboard:users_list')

    context = {
        'user_obj': user,
    }

    return render(request, 'dashboard/users/delete.html', context)
