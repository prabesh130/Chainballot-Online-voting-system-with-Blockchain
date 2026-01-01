import { Card, CardImage, CardContent } from "./Card";
import { useEffect, useState } from "react";
import logo from "../assets/image/chain_ballot_logo_no_bg.png";

// -------------------- Countdown Hook --------------------
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function calculateTimeLeft(targetDate: Date) {
  const now = new Date().getTime();
  const diff = targetDate.getTime() - now;

  if (diff <= 0) {
    return {
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);

  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);

  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);

  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  const days = totalDays % 30;
  const months = Math.floor(totalDays / 30);

  return { months, days, hours, minutes, seconds };
}

// -------------------- Mock API --------------------
async function fetchElectionNews() {
  // Replace with real API call
  return [
    {
      id: 1,
      title: "Election Commission Announces Voting Date",
      image:"https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZWxlY3Rpb258ZW58MHx8MHx8fDA%3D&w=1000&q=80",
      summary:
        "National elections scheduled with enhanced blockchain security.",
      url: "/register",
    },
    {
      id: 2,
      title: "ChainBallot Audit Completed",
      image:"https://images.unsplash.com/photo-1507679799987-c73779587ccf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaXR8ZW58MHx8MHx8fDA%3D&w=1000&q=80",
      summary: "Independent audit confirms immutability of vote records.",
      url:"/guide",
    },
    {
      id: 3,
      title: "Voter Registration Hits Record High",
      image:"https://images.unsplash.com/photo-1504384308090-c894fdcc538d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dm90ZXJ8ZW58MHx8MHx8fDA%3D&w=1000&q=80",
      summary: "Digital onboarding increases participation across regions.",
      url:"/contact-us",
    },
  ];
}

// -------------------- Home Page --------------------
export default function Home() {
  const electionDate = new Date("2026-04-15T09:00:00"); // dynamic later
  const { months, days, hours, minutes, seconds } = useCountdown(electionDate);
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetchElectionNews().then(setNews);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-contain blur-lg scale-110 opacity-60"
        style={{ backgroundImage: `url(${logo})` }}
      />

      <div className="absolute inset-0 bg-white/70" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 space-y-16">
        <section className="text-center space-y-6">
          <h1 className="md:text-6xl mb-20 text-4xl font-bold tracking-tight">
            Time For Upcoming National Election
          </h1>

          <div className="flex justify-center gap-6 mt-8 ">
            {[
              { label: "Months", value: months },
              { label: "Days", value: days },
              { label: "Hours", value: hours },
              { label: "Minutes", value: minutes },
              { label: "Seconds", value: seconds },
            ].map((item) => (
              <Card key={item.label} className="w-60 text-center shadow-lg">
                <CardContent className="py-10">
                  <div className="text-6xl font-medium  tabular-nums">
                    {item.value.toString().padStart(2, "0")}
                  </div>
                  <div className="text-lg text-gray-500 mt-1">{item.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* News Section */}
        <section className="space-y-6 md:py-16 py-10">
          <h2 className="text-4xl font-semibold">Latest Election Updates</h2>

          <div className="grid md:grid-cols-1 gap-6 cursor-pointer">
            {news.map((item) => (
              <Card key={item.id}  className="hover:shadow-xl transition mt-10"
              onClick={() => window.open(item.url, "_blank")}>
                {/* Optional image */}
                {item.image && <CardImage src={item.image} alt={item.title} />}

                <CardContent className="p-6 space-y-3">
                  <h3 className="font-medium text-lg">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
