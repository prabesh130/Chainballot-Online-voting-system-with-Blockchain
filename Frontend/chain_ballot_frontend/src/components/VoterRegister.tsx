import { useState } from "react";
import { FormEvent, ChangeEvent } from "react";

const SubForm = () => {
  const [name, setName] = useState<string>("");
  const [rollNo, setRollNo] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [batch, setBatch] = useState<string>("");
  const [about, setAbout] = useState<string>("");
  const [reason_to_join, setReason_to_join] = useState<string>("");
  const [interest, setInterest] = useState<string>("");
  const [resume, setResume] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState<string>("");
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [positions, setPositions] = useState<string>("");

  const [link1, setLink1] = useState<string>("");
  const [link2, setLink2] = useState<string>("");
  const [link3, setLink3] = useState<string>("");

  const showAlert = (message: string) => {
    // Create background overlay
    const bgOverlay = document.createElement("div");
    bgOverlay.className = "fixed inset-0 bg-black bg-opacity-50 z-50";

    // Create alert box
    const alertBox = document.createElement("div");
    alertBox.className =
      "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white text-black p-6 rounded shadow-lg z-50 max-w-xs w-full text-center";

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.className = "absolute top-0 right-0 mt-2 mr-2 text-black";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = () => {
      document.body.removeChild(alertBox);
      document.body.removeChild(bgOverlay);
    };

    // Append close button to alert box
    alertBox.appendChild(closeButton);

    // Create message paragraph
    const messageParagraph = document.createElement("p");
    messageParagraph.innerText = message;

    // Append message paragraph to alert box
    alertBox.appendChild(messageParagraph);

    // Append alert box and background overlay to the body
    document.body.appendChild(bgOverlay);
    document.body.appendChild(alertBox);
  };

  const redirectToHome = () => {
    const isGitHubPages = window.location.hostname.includes("github.io");
    if (isGitHubPages) {
      const pathSegments = window.location.pathname
        .split("/")
        .filter((segment) => segment);
      const repoName = pathSegments[0];
      window.location.href = repoName ? `/${repoName}/` : "/";
    } else {
      window.location.href = "/";
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.append("name", name);
    formData.append("campus_roll", rollNo);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("department", department);
    formData.append("batch", batch);
    formData.append("about", about);
    formData.append("reason_to_join", reason_to_join);
    formData.append("interests", interest);
    formData.append("post", positions);
    if (resume) {
      formData.append("resume", resume);
    }
    formData.append("github_link", link2); // GitHub is link2
    formData.append("facebook_link", link3); // Facebook is link3
    formData.append("linkedin_link", link1); // LinkedIn is link1

    try {
      // First try to submit to Google Sheets (POST JSON without resume)
      try {
        const gasUrl =
          "https://script.google.com/macros/s/AKfycbxAg8p9TENsGAjj59dRNS6T_PfUfGSdTmCK79rnppMCAzSjmoCUTxgXIis-S4DhbZRO/exec";

        // Prepare data for Google Sheets (JSON format)
        const dataToSend = {
          name: name,
          campus_roll: rollNo,
          email: email,
          phone: phone,
          department: department,
          batch: batch,
          about: about,
          reason_to_join: reason_to_join,
          interests: interest,
          post: positions,
          resume: resume ? resume.name : "", // Just send filename
          github_link: link2,
          facebook_link: link3,
          linkedin_link: link1,
        };

        console.log("Sending to Google Sheets:", dataToSend);

        const gasResponse = await fetch(gasUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSend),
          mode: "no-cors", // This might be necessary for Google Apps Script
        });

        console.log("Google Sheets response status:", gasResponse.status);
        console.log("Google Sheets submission completed");
      } catch (gasError) {
        console.log("Google Sheets error (non-critical):", gasError);
        // Continue with main API submission even if Google Sheets fails
      }

      // Submit to main API (full formData including resume)
      const response = await fetch(
        "https://ecast.pythonanywhere.com/api/intake/form/",
        {
          method: "POST",
          body: formData,
        }
      );

      setIsSubmitting(false);

      if (response.status !== 201) {
        let responseData;
        try {
          responseData = await response.json();
        } catch (parseError) {
          console.log("Failed to parse error response:", parseError);
          showAlert(
            "Failed to submit form. Please check your connection and try again."
          );
          return;
        }

        console.log("Error response:", responseData);

        if (
          responseData.error &&
          responseData.error.includes("email must make a unique set")
        ) {
          showAlert(
            "Error: The email is already used. Please use a unique email."
          );
        } else if (
          responseData.error &&
          responseData.error.includes("Enter a valid email address.")
        ) {
          showAlert("Error: Please enter a valid email address");
        } else if (responseData.error) {
          showAlert(`Error: ${responseData.error}`);
        } else {
          showAlert("Failed to submit form. Please try again.");
        }
        return;
      }

      // Success case
      try {
        const responseData = await response.json();
        console.log("Success:", responseData);
      } catch (parseError) {
        console.log("Response parse warning:", parseError);
        // Continue with success flow even if response parsing fails
      }

      setFormSubmitted(true);

      // Redirect to homepage after 3 seconds
      setTimeout(() => {
        redirectToHome();
      }, 3000);
    } catch (error) {
      console.log("Network or unexpected error:", error);
      setIsSubmitting(false);

      // Check for specific error types
      if (error instanceof TypeError) {
        if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("CORS")
        ) {
          showAlert(
            "Connection error. Please check your internet connection and try again."
          );
        } else if (error.message.includes("NetworkError")) {
          showAlert(
            "Network error. Please check your internet connection and try again."
          );
        } else {
          showAlert("Connection failed. Please try again.");
        }
      } else {
        showAlert("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResume(e.target.files[0]);
      setResumeName(e.target.files[0].name);
    }
  };

  const handleFileClick = () => {
    const cvElement = document.getElementById("cv") as HTMLInputElement | null;
    if (cvElement) {
      cvElement.click();
    }
  };

  return (
    <div className="bg-black min-h-screen">
      <div className="flex items-center justify-center px-4">
        <div className="my-8 p-8 rounded-lg w-full max-w-5xl border border-gray-700">
          <div className="flex flex-col items-center justify-center text-white">
            <p className="text-center text-white font-bold text-xl">
              ECAST INTAKE FORM
            </p>
            <div className="w-1/2 lg:w-1/4 mx-auto border-t-2 border-red-500 my-4 mb-8"></div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="name">
                Enter Your Name *
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                type="text"
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name Here"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="rollNo">
                Enter Roll No *
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                type="text"
                id="rollNo"
                name="rollNo"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="Campus Roll No. ex(THA080BEI01)"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="batch">
                Select Your Batch *
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                id="batch"
                name="batch"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                required
                disabled={isSubmitting || formSubmitted}
              >
                <option value="">Select Year</option>
                <option value="79">2079</option>
                <option value="80">2080</option>
                <option value="81">2081</option>
              </select>
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="department">
                Select Your Department *
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                id="department"
                name="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                disabled={isSubmitting || formSubmitted}
              >
                <option value="">Select Department</option>
                <option value="BCT">Computer Engineering</option>
                <option value="BEI">
                  Electronics, Communication and Information Engineering
                </option>
                <option value="BCE">Civil Engineering</option>
                <option value="BIE">Industrial Engineering</option>
                <option value="BME">Mechanical Engineering</option>
                <option value="BAM">Automobile Engineering</option>
                <option value="BEL">Electrical Engineering</option>
              </select>
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="phone">
                Contact *
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                type="text"
                id="phone"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your Contact Number"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="email">
                Email *
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Your Email Address"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="about">
                Describe Yourself In Few Words *
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                id="about"
                name="about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Write Your Answer"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="positions">
                Post You Want To Apply For *
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                id="positions"
                name="positions"
                value={positions}
                onChange={(e) => setPositions(e.target.value)}
                required
                disabled={isSubmitting || formSubmitted}
              >
                <option value="">Select Post</option>
                <option value="TT">Technical Team (Hardware / Software)</option>
                <option value="RD">Research & Development</option>
                <option value="SMM">Social Media Manager</option>
                <option value="EC">Events & Communications</option>
                <option value="EIC">Editor in chief</option>
                <option value="GD">Graphic Design</option>
              </select>
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="reason_to_join">
                Why You Want To Join ECAST? *
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                id="reason_to_join"
                name="reason_to_join"
                value={reason_to_join}
                onChange={(e) => setReason_to_join(e.target.value)}
                placeholder="Write Your Answer"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="interest">
                Your Skills And Interests (Mention any other post you would like to join in addition to the primary one in this section) *
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                id="interest"
                name="interest"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="Write Your Answer"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="cv">
                Upload Your CV * (only pdf is accepted)
              </label>
              <input
                className="hidden"
                type="file"
                id="cv"
                name="cv"
                onChange={handleFileChange}
                accept=".pdf"
                required
                disabled={isSubmitting || formSubmitted}
              />
              <button
                type="button"
                onClick={handleFileClick}
                className="w-full px-3 rounded-full font-bold py-2 text-white hover:text-black hover:bg-white hover:border-white transition duration-500 border-2 border-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || formSubmitted}
              >
                Choose File
              </button>
              {resumeName && (
                <p className="text-white mt-2 text-sm italic text-center">
                  <span className="font-semibold">Uploaded File: 📄</span>{" "}
                  {resumeName}
                </p>
              )}
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="link3">
                Enter Your Facebook Profile Link *
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                type="url"
                id="link3"
                name="link3"
                value={link3}
                onChange={(e) => setLink3(e.target.value)}
                placeholder="Paste The Url Here"
                required
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="link1">
                Enter Your Linkedin Profile Link
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                type="url"
                id="link1"
                name="link1"
                value={link1}
                onChange={(e) => setLink1(e.target.value)}
                placeholder="Paste The Url"
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <div className="mb-4 p-8 bg-black shadow-md shadow-gray-400 rounded-lg w-full max-w-5xl transform transition duration-500 hover:scale-105">
              <label className="block text-white mb-2" htmlFor="link2">
                Enter Your GitHub Link
              </label>
              <input
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
                type="url"
                id="link2"
                name="link2"
                value={link2}
                onChange={(e) => setLink2(e.target.value)}
                placeholder="Paste The Url"
                disabled={isSubmitting || formSubmitted}
              />
            </div>

            <button
              type="submit"
              className={`w-full px-3 rounded-full font-bold py-2 text-white transition duration-500 border-2 border-white relative overflow-hidden ${
                isSubmitting || formSubmitted
                  ? "bg-green-600 border-green-600 cursor-not-allowed"
                  : "hover:text-black hover:bg-white hover:border-white"
              }`}
              disabled={isSubmitting || formSubmitted}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Submitting...
                </div>
              ) : formSubmitted ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="w-5 h-5 mr-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Submitted Successfully!
                </div>
              ) : (
                "Submit"
              )}
            </button>
          </form>

          {formSubmitted && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
              <div className="relative bg-white text-black px-8 py-6 border-0 rounded-lg shadow-lg max-w-md mx-4">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Form Submitted Successfully!
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Thank you for your application. You will be redirected to
                    the homepage shortly.
                  </p>
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  </div>
                </div>
                <button
                  className="absolute top-2 right-2 p-1 focus:outline-none"
                  onClick={() => redirectToHome()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-400 hover:text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubForm;