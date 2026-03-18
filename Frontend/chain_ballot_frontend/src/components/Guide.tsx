import { useState } from "react";

const steps = [
  {
    title: "Confirm You Are Pre-Registered",
    body: "You must already be added by your institution/admin before you can continue. If your details are not pre-registered, contact the election admin first.",
    action: "Check with admin that your roll number and email are pre-listed.",
    caution: "If you are not pre-registered, self-registration will fail.",
  },
  {
    title: "Complete Student Registration",
    body: "Use the registration page and enter your details exactly as expected (name, roll number, and email). Only pre-registered users can complete this step.",
    action: "Submit the registration form with exact details.",
    caution: "Mismatch in email or roll number can block your registration.",
  },
  {
    title: "Verify Your Account",
    body: "Check your email inbox and open the verification link. Your account must be verified before login is allowed.",
    action: "Open the latest verification link from your mailbox.",
    caution: "Unverified accounts cannot continue to OTP login.",
  },
  {
    title: "Login With OTP",
    body: "Login with your credentials and then enter the OTP sent to your email. OTP login is mandatory.",
    action: "Use the fresh OTP immediately after receiving it.",
    caution: "If OTP expires, request a new OTP and retry login.",
  },
  {
    title: "Wait For Election Start",
    body: "Do not try to vote before the election starts. The mnemonic is only useful after the election is active.",
    action: "Confirm election status is active before entering mnemonic.",
    caution: "Before active phase, voting actions will not complete.",
  },
  {
    title: "Enter Your 12-Word Mnemonic",
    body: "When election is active, enter your mnemonic exactly as provided by admin email. Keep word order and spelling unchanged.",
    action: "Type all 12 words in exact order and spelling.",
    caution: "Never share your mnemonic with anyone.",
  },
  {
    title: "Select Candidates And Review",
    body: "Choose one candidate for each available post and carefully review your summary before final submission.",
    action: "Review every selected post before final click.",
    caution: "Once submitted, you may not be able to change your vote.",
  },
] as const;

const Guide = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [showRules, setShowRules] = useState(true);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const activeData = steps[activeStep];

  const goNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goPrevious = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full  blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-28 h-80 w-80 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-cyan-200/70 bg-white/85 p-6 shadow-xl backdrop-blur md:p-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
            ChainBallot User Guide
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Follow the guided path from pre-registration to final vote
            submission confirmation.
          </p>
        </header>
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg md:p-8">
              <div className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Step {activeStep + 1} of {steps.length}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {activeData.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                {activeData.body}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                    Do This Now
                  </p>
                  <p className="mt-1 text-sm font-medium text-cyan-900">
                    {activeData.action}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                    Avoid This
                  </p>
                  <p className="mt-1 text-sm font-medium text-rose-900">
                    {activeData.caution}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={goPrevious}
                  disabled={activeStep === 0}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={goNext}
                  disabled={activeStep === steps.length - 1}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Next
                </button>
                <button
                  onClick={() => setActiveStep(0)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Restart Guide
                </button>
              </div>
            </article>
            
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
          <aside className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur">
            <h2 className="px-2 pb-3 text-lg font-bold text-slate-900">
              Guide Path
            </h2>
            <div className="space-y-2">
              {steps.map((step, index) => {
                const isActive = index === activeStep;
                return (
                  <button
                    key={step.title}
                    onClick={() => setActiveStep(index)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                      isActive
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                          {step.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Click to view details
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <button
                onClick={() => setShowRules((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  Important Rules
                </h2>
                <span className="text-sm font-semibold text-slate-500">
                  {showRules ? "Hide" : "Show"}
                </span>
              </button>
              {showRules && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>
                    You must be pre-registered by admin before
                    self-registration.
                  </li>
                  <li>Account verification is required before OTP login.</li>
                  <li>Do not share your 12-word mnemonic with anyone.</li>
                  <li>
                    Do not close, refresh, or leave the page during final
                    submission.
                  </li>
                  <li>
                    Wait until the success message confirms your vote is
                    submitted.
                  </li>
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <button
                onClick={() => setShowTroubleshoot((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  If Something Fails
                </h2>
                <span className="text-sm font-semibold text-slate-500">
                  {showTroubleshoot ? "Hide" : "Show"}
                </span>
              </button>
              {showTroubleshoot && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>No verification email: check spam/junk and retry.</li>
                  <li>OTP expired: request a new OTP and login again.</li>
                  <li>
                    Mnemonic rejected: re-enter all 12 words exactly in
                    lowercase and correct order.
                  </li>
                  <li>
                    Submission stuck: keep the page open and ensure internet
                    remains stable until final status appears.
                  </li>
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 md:p-6">
              <p className="text-sm font-semibold text-amber-900">
                Final reminder
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">
                Submit your vote only when you are fully sure, then stay on the
                page until the final blockchain submission confirmation is
                visible.
              </p>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Guide;
