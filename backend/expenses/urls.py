from django.urls import path

from . import views

urlpatterns = [
    path("groups/<int:group_id>/expenses/", views.expenses),
    path("expenses/<int:expense_id>/", views.expense_detail),
    path("groups/<int:group_id>/balances/", views.balances),
    path("groups/<int:group_id>/settle/", views.settle),
    path("groups/<int:group_id>/settlements/", views.settlements),
    path("settlements/<int:settlement_id>/", views.settlement_detail),
]

urlpatterns += [
    path("activity/", views.activity),
    path("pending/", views.pending),
]
