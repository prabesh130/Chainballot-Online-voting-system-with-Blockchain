from rest_framework import generics
from .models import Student
from .serializers import StudentSerializer

# Create a new student
class StudentCreateView(generics.CreateAPIView):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer


# Retrieve, update, or delete a student by roll
class StudentRetrieveUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    lookup_field = 'roll'  # use 'roll' as the identifier instead of 'pk'
