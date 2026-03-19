import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"login" | "loading" | "otp" | "success">("login");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("loading");
    
    const result = await login(email, password);
    
    if ("otpRequired" in result) {
      setTimeout(() => setStep("otp"), 800);
    } else if ("error" in result) {
      setError(result.error);
      setStep("login");
    } else {
      setStep("success");
      setTimeout(() => navigate("/"), 1500);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("loading");
    
    const success = await verifyOtp(email, otp);
    
    if (!success) {
      setError("Invalid or expired OTP");
      setStep("otp");
    } else {
      setStep("success");
      setTimeout(() => navigate("/"), 1500);
    }
  };

  return (
    <div className=" flex items-center my-12 justify-center ">
      <div className="w-full max-w-md px-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          {/* Login Step */}
          {step === "login" && (
            <form onSubmit={handleLogin}>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">Welcome Back</h2>
                <p className="text-gray-500 mt-2 text-sm">Sign in to your account</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  placeholder="sup@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-lg hover:shadow-xl"
              >
                Login
              </button>
              <p className="text-center text-gray-600 text-sm mt-4">
                Don't have an account? <a href="/register" className="text-blue-600 hover:text-blue-800 font-medium">Sign Up</a>
              </p>
              <p className="text-center text-gray-600 text-sm mt-2">
                <a href="/admin" className="text-blue-600 hover:text-blue-800 font-medium">Admin Login</a>
              </p>
            </form>
          )}

          {/* Loading Step */}
          {step === "loading" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Authenticating...</h3>
              <p className="text-gray-500 text-sm">Please wait a moment</p>
            </div>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <form onSubmit={handleOtp}>
              <div className="text-center mb-8">
                
                <h2 className="text-3xl font-bold text-gray-800">Check Your Email</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  We've sent a verification code to<br/>
                  <span className="font-medium text-gray-700">{email}</span>
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-lg hover:shadow-xl"
              >
                Verify Code
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setOtp("");
                  setError("");
                }}
                className="w-full mt-3 text-gray-600 hover:text-gray-800 text-sm font-medium transition"
              >
                ← Back to Login
              </button>
            </form>
          )}

          {/* Success Step */}
          {step === "success" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Login Successful!</h3>
              <p className="text-gray-500 text-sm">Redirecting you now...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}