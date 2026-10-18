from django.db.models import Q
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, user_id_validator
from .serializers import MeSerializer, PublicUserSerializer, RegisterSerializer


def auth_response(user, status_code=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    return Response(
        {"access": str(refresh.access_token), "refresh": str(refresh), "user": MeSerializer(user).data},
        status=status_code,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return auth_response(serializer.save(), status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """Sign in with user ID or email + password."""
    identifier = str(request.data.get("login", "")).strip().lower().lstrip("@")
    password = request.data.get("password", "")
    user = User.objects.filter(Q(username=identifier) | Q(email=identifier)).first()
    if not user or not user.is_active or not user.check_password(password):
        return Response(
            {"detail": "Wrong user ID, email or password."}, status=status.HTTP_401_UNAUTHORIZED
        )
    return auth_response(user)


@api_view(["GET"])
@permission_classes([AllowAny])
def check_user_id(request):
    value = request.query_params.get("id", "").strip().lower()
    try:
        user_id_validator(value)
    except Exception as e:
        return Response({"available": False, "reason": e.messages[0]})
    if User.objects.filter(username=value).exists():
        return Response({"available": False, "reason": "That user ID is taken."})
    return Response({"available": True})


@api_view(["GET"])
def search_users(request):
    q = request.query_params.get("q", "").strip().lower().lstrip("@")
    if len(q) < 2:
        return Response([])
    users = User.objects.filter(username__startswith=q).exclude(pk=request.user.pk).order_by("username")[:10]
    return Response(PublicUserSerializer(users, many=True).data)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user
