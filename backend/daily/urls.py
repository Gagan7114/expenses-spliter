from django.urls import path

from . import views

urlpatterns = [
    path("daily-items/", views.items),
    path("daily-items/<int:item_id>/", views.item_detail),
    path("daily-items/<int:item_id>/month/", views.item_month),
    path("daily-items/<int:item_id>/days/<str:day>/", views.item_day),
    path("daily-items/<int:item_id>/bill/", views.item_bill),
]
