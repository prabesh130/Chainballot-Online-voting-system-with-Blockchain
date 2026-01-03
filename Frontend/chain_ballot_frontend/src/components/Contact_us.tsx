import { Card, CardContent } from "./Card";
import { useState } from "react";
import Logo from "../assets/image/chain_ballot_logo_no_bg.png";

export default function ContactUs() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log(form);
    try{
      const response = await fetch("http://127.0.0.1:8000/contact/contact_us/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }, 
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: form.message,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Message sent successfully!");
        setForm({ name: "", email: "", message: "" });
      } else {
        alert("Error: "+(data.error || "Failed to send message."));
        }
    }catch(error){
      alert("An error occurred while sending the message.");
      console.error("Error:", error);
    } finally{
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen ">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        {/* Header */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Contact Us
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Have questions about ChainBallot or electronic voting security?{" "}
            <br />
            Reach out to us and we’ll respond as soon as possible.
          </p>
          <div className="w-1/2 mx-auto border-t-2 border-red-500"></div>
        </section>

        {/* Content */}
        <section className="grid md:grid-cols-2 gap-10">
          {/* Info Card */}
          <Card className="shadow-lg relative overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <img
                src={Logo}
                alt="ChainBallot watermark"
                className="
                     pointer-events-none
                     select-none
                     absolute
                     top-1/2 left-1/2
                     -translate-x-1/2 -translate-y-1/2
                     w-[260px] md:w-[320px]
                     blur-sm
                        opacity-30
                     "
              />

              <h2 className="text-2xl font-semibold">Get in Touch</h2>

              <div className="space-y-4 text-gray-600">
                <p>
                  📍{" "}
                  <span className="font-medium text-gray-800">Location:</span>{" "}
                  Thapathali Campus, Nepal
                </p>
                <p>
                  📧 <span className="font-medium text-gray-800">Email:</span>{" "}
                  support@chainballot.com
                </p>
                <p>
                  🔐 <span className="font-medium text-gray-800">Focus:</span>{" "}
                  Secure, transparent, blockchain-based voting systems
                </p>
              </div>

              <p className="text-sm text-gray-500">
                ChainBallot is built with transparency, privacy, and integrity
                at its core.
              </p>
            </CardContent>
          </Card>

          {/* Form Card */}
          <Card className="shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    name="message"
                    rows={4}
                    required
                    value={form.message}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="
                    w-full
                    rounded-xl
                    bg-blue-500
                    text-white
                    py-3
                    font-semibold
                    transition-all
                    hover:bg-blue-600
                    active:scale-[0.98]
                  "
                >
                  Send Message
                </button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
