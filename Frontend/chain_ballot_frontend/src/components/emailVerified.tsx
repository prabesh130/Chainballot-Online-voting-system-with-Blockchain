import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const EmailVerified = () => {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const redirectTimer = setTimeout(() => {
      navigate("/");
    }, 5000);

    return () => {
      clearInterval(countdown);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl border-2 border-red-800 bg-gray-50/80 backdrop-blur-lg shadow-xl p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl font-bold">
          ✓
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-blue-500">
          Email verified successfully
        </h1>

        <p className="text-gray-600 text-base md:text-lg">
          Your account is now verified. You will be redirected to the home page
          in <span className="font-semibold text-blue-600">{secondsLeft}s</span>
          .
        </p>

        <button
          onClick={() => navigate("/")}
          className="mt-2 px-6 py-2 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-700 transition"
        >
          Go to Home Now
        </button>
      </div>
    </div>
  );
};

export default EmailVerified;
