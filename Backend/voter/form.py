from django import forms
from student.models import Student
from voter.models import Voter
from django.contrib.auth.hashers import make_password

class VoterRegistrationForm(forms.Form):
    roll = forms.CharField(label="Roll Number")
    email = forms.EmailField(label="Email")
    password = forms.CharField(widget=forms.PasswordInput)
    confirm_password = forms.CharField(widget=forms.PasswordInput)

    def clean(self):
        cleaned_data = super().clean()
        roll = cleaned_data.get('roll')
        email = cleaned_data.get('email')
        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')

        # Validate student
        try:
            student = Student.objects.get(roll=roll, email=email)
        except Student.DoesNotExist:
            raise forms.ValidationError("Roll number and Email do not match our records")

        # Prevent duplicate voter registration
        if hasattr(student, 'voter'):
            raise forms.ValidationError("This student is already registered as a voter")

        # Password validation
        if password != confirm_password:
            raise forms.ValidationError("Passwords do not match")

        cleaned_data['student'] = student
        return cleaned_data

    def save(self):
        return Voter.objects.create(
            student=self.cleaned_data['student'],
            password=make_password(self.cleaned_data['password'])
        )
