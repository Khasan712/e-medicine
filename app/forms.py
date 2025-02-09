from django import forms
from .models import Product


class ProductAdminForm(forms.ModelForm):
    # image_upload = forms.ImageField(required=False, label="Upload Image")

    class Meta:
        model = Product
        fields = "__all__"

    def save(self, commit=True):
        print('Hello')
        instance = super().save(commit=False)
        print(self.cleaned_data)
        if self.cleaned_data.get("img"):
            print(self.cleaned_data.get('img'))
            instance.save_image_as_base64(self.cleaned_data["img"])
        if commit:
            instance.save()
        return instance
