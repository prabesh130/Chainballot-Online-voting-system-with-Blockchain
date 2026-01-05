from django.urls import path
from .views import StudentCreateView, StudentRetrieveUpdateDeleteView

urlpatterns = [
    path('add/', StudentCreateView.as_view(), name='add-student'),
    path('<str:roll>/', StudentRetrieveUpdateDeleteView.as_view(), name='student-detail'),
]
