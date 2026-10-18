from django.urls import path

from . import views

urlpatterns = [
    path("groups/", views.groups),
    path("groups/<int:group_id>/", views.group_detail),
    path("groups/<int:group_id>/members/<int:member_id>/", views.member_detail),
    path("groups/<int:group_id>/invite-link/", views.invite_link),
    path("groups/<int:group_id>/invite-link/reset/", views.reset_invite_link),
    path("groups/<int:group_id>/invites/", views.direct_invites),
    path("invites/", views.my_invites),
    path("invites/<int:invite_id>/<str:action>/", views.respond_invite),
    path("join/<str:code>/", views.join),
]
