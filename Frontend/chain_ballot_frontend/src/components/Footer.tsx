import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      className="bg-white border-b-8 border-gray-300
 text-gray-700  relative z-10 w-full"
    >
      {/* Top content */}
      <div
        className="w-full md:px-32 px-9 py-12
                      md:flex md:justify-between md:items-start
                      space-y-8
                      
                      md:space-y-0"
      >
        {/* About */}
        <div className="md:w-1/4 space-y-3">
          <h2 className="text-xl font-bold">ChainBallot</h2>
          <p className="text-sm text-gray-500">
            Secure online voting system leveraging blockchain technology to
            ensure tamper-proof elections.
          </p>
        </div>

        {/* Links */}
        <div className="md:w-1/3 flex justify-between">
          <div className="space-y-2">
            <h3 className="font-semibold">Quick Links</h3>
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-900 block"
            >
              Home
            </Link>
            <Link
              to="/register"
              className="text-sm text-gray-500 hover:text-gray-900 block"
            >
              Register
            </Link>
            <Link
              to="/guide"
              className="text-sm text-gray-500 hover:text-gray-900 block"
            >
              Guide
            </Link>
            <Link
              to="/contact-us"
              className="text-sm text-gray-500 hover:text-gray-900 block"
            >
              Contact
            </Link>
          </div>

          <div className=" space-y-2">
            <h3 className="font-semibold">Follow Us</h3>
            <div className="flex gap-4 mt-1 text-lg">
              <a href="#" className="hover:text-gray-900">
                🐦
              </a>
              <a href="#" className="hover:text-gray-900">
                📘
              </a>
              <a href="#" className="hover:text-gray-900">
                💼
              </a>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className=" space-y-2">
          <h3 className="font-semibold">Contact</h3>
          <p className="text-sm text-gray-500">Email: info@chainballot.com</p>
          <p className="text-sm text-gray-500">Phone: +977 123 456 789</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-300 text-center text-sm text-gray-500 py-4">
        © {new Date().getFullYear()} ChainBallot. All rights reserved.
      </div>
    </footer>
  );
}
