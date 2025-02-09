from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import User, Product


class ProductAdminForm(forms.ModelForm):
    # image_upload = forms.ImageField(required=False, label="Upload Image")

    class Meta:
        model = Product
        fields = "__all__"

    def save(self, commit=True):
        instance = super().save(commit=False)
        print(self.cleaned_data)
        if self.cleaned_data.get("img"):
            print(self.cleaned_data.get('img'))
            instance.save_image_as_base64(self.cleaned_data["img"])
        if commit:
            instance.save()
        return instance


class CustomUserCreationForm(UserCreationForm):
    """ ✅ Custom Form for Creating Users in Admin """

    class Meta:
        model = User
        fields = ("phone_number", "first_name", "last_name", "role", "is_active", "is_staff", "is_confirmed")


class CustomUserChangeForm(UserChangeForm):
    """ ✅ Custom Form for Editing Users in Admin """

    class Meta:
        model = User
        fields = ("phone_number", "first_name", "last_name", "role", "is_active", "is_staff", "is_deleted", "is_confirmed")