import { useState } from "react";

const VoterRegister = () => {
  const [formData, setFormData] = useState({
    name: "",
    crn: "",
    email: "",
    number:"",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (name === "password" || name === "confirmPassword") {
      if (
        (name === "password" && value !== formData.confirmPassword) ||
        (name === "confirmPassword" && value !== formData.password)
      ) {
        setError("Passwords do not match");
      } else {
        setError("");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    console.log("Submitting:", formData);
    const payload = {
      username: formData.crn, // roll no
      email: formData.email,
      password: formData.password,
      password2: formData.confirmPassword,
      first_name: formData.name.split(" ")[0] || "",
      last_name: formData.name.split(" ").slice(1).join(" ") || "",
      number: formData.number,
    };
    console.log("Payload:", payload);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(JSON.stringify(data));

      localStorage.setItem("access", data.tokens.access);
      localStorage.setItem("refresh", data.tokens.refresh);

      console.log("Registered:", data.user);
    } catch (err: any) {
      setError("Registration failed");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4">
        <div className="my-8 p-8 rounded-lg w-full max-w-5xl border bg-white  shadow-2xl shadow-gray-600">
          <div className="flex flex-col items-center justify-center  text-black">
            <p className="text-center  text-black font-bold text-5xl">
              Registration Form
            </p>
            <div className="w-1/2 mx-auto border-t-2 border-blue-500 my-4 mb-8"></div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4 p-8 shadow-md shadow-gray-200 rounded-lg w-full max-w-5xl transition duration-300 hover:shadow-lg hover:shadow-blue-400/50">
              <label
                className="block text-left text-lg  text-black mb-2"
                htmlFor="name"
              >
                Enter Your Name
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                type="text"
                id="name"
                name="name"
                placeholder="Your Name Here"
                required
                onChange={handleChange}
              />
            </div>

            <div className="mb-4 p-8 shadow-md shadow-gray-200 rounded-lg w-full max-w-5xl transition duration-300 hover:shadow-lg hover:shadow-blue-400/50">
              <label
                className="block text-left text-lg  text-black mb-2"
                htmlFor="crn"
              >
                Enter Roll No
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                type="text"
                id="crn"
                name="crn"
                onChange={handleChange}
                placeholder="Campus Roll No. ex(THA070BCT047)"
                required
              />
            </div>

            <div className="mb-4 p-8 shadow-md shadow-gray-200 rounded-lg w-full max-w-5xl transition duration-300 hover:shadow-lg hover:shadow-blue-400/50">
              <label
                className="block text-left text-lg  text-black mb-2"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                type="email"
                id="email"
                name="email"
                onChange={handleChange}
                placeholder="Enter Your Email Address"
                required
              />
            </div>

            <div className="mb-4 p-8 shadow-md shadow-gray-200 rounded-lg w-full max-w-5xl transition duration-300 hover:shadow-lg hover:shadow-blue-400/50">
              <label
                className="block text-left text-lg  text-black mb-2"
                htmlFor="number"
              >
                Phone Number
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                type="number"
                id="number"
                name="number"
                onChange={handleChange}
                placeholder="Enter Your Phone Number"
                required
              />
            </div>

            {/* Password */}
            <div className="mb-4 p-8 shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl relative transition duration-300 hover:shadow-lg hover:ring-1 hover:ring-blue-500">
              <label
                htmlFor="password"
                className="block text-lg text-left text-black mb-2"
              >
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a Password"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-10 top-10 text-gray-600"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="mb-4 p-8 shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl relative transition duration-300 hover:shadow-lg hover:ring-1 hover:ring-blue-500">
              <label
                htmlFor="confirmPassword"
                className="block text-left text-lg text-black mb-2"
              >
                Confirm Password
              </label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Your Password"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-10 top-10 text-gray-600"
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-6 text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700  text-white py-2.5 rounded-md font-medium transition"
            >
              Register
            </button>

            <p className="text-xs text-gray-500 text-center mt-6">
              Your vote will be encrypted and securely recorded on the
              blockchain.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VoterRegister;
