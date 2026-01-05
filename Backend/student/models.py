from django.db import models

# Create your models here.
class Student(models.Model):
    roll = models.CharField(max_length=15, primary_key=True)
    name = models.CharField(max_length=50)
    contact = models.CharField(max_length=20)
    email = models.EmailField(max_length=50)

    def __str__(self):
        return f"{self.roll} - {self.name}"