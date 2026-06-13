import { Card, CardImage, CardContent } from "./Card";
import { useEffect, useState } from "react";
import LeftDecor from "../assets/image/vecto.png";

// -------------------- Countdown Hook --------------------
interface NewsItem {
  title: string;
  description: string;
  link: string;
  image_url?: string | null;
  category?: string | string[] | null;
  article_id?: string | number;
  [key: string]: any;
}

async function fetchElectionNews(): Promise<NewsItem[]> {
  const url =
    "https://newsdata.io/api/1/latest?country=np&apikey=pub_441242573cfc4e70afc9e75ee81374fc";

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data: { results: NewsItem[] } = await response.json();

    // Filter only politics news
    const politicsNews = data.results.filter((item): item is NewsItem => {
      if (!item.category) return false;

      if (Array.isArray(item.category)) {
        return item.category.some(
          (cat) =>
            (typeof cat === "string" && cat.toLowerCase() === "politics") ||
            cat.toLowerCase() === "political" ||
            cat.toLowerCase() === "election" ||
            cat.toLowerCase() === "lifestyle",
          // cat.toLowerCase() === "top",
        );
      }

      if (typeof item.category === "string") {
        return (
          item.category.toLowerCase() === "politics" ||
          item.category.toLowerCase() === "political" ||
          item.category.toLowerCase() === "election" ||
          item.category.toLowerCase() === "lifestyle"
          // item.category.toLowerCase() === "top"
        );
      }

      return false; // fallback for unexpected types
    });

    return politicsNews;
  } catch (error) {
    console.error("Error fetching news data:", error);
    return []; // always return an array
  }
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

function getLoopingCountdownTarget(
  now: Date,
  startDate: Date,
  endDate: Date,
) {
  const cycleMs = Math.max(endDate.getTime() - startDate.getTime(), 1000);

  if (now.getTime() <= startDate.getTime()) {
    return startDate;
  }

  const elapsedMs = now.getTime() - startDate.getTime();
  const cyclesCompleted = Math.floor(elapsedMs / cycleMs);
  let nextTarget = new Date(startDate.getTime() + (cyclesCompleted + 1) * cycleMs);

  while (nextTarget.getTime() <= now.getTime()) {
    nextTarget = new Date(nextTarget.getTime() + cycleMs);
  }

  return nextTarget;
}

// -------------------- Home Page --------------------
export default function Home() {
  const electionStartDate = new Date("2026-03-29T10:30:00");
  const electionEndDate = new Date("2026-03-30T22:00:00"); // Election ends at 10 PM
  const [news, setNews] = useState<NewsItem[]>([]);
  const [countdownTarget, setCountdownTarget] = useState(() =>
    getLoopingCountdownTarget(new Date(), electionStartDate, electionEndDate),
  );

  useEffect(() => {
    const fetchAndSetNews = async () => {
      const newsData = await fetchElectionNews();
      setNews(newsData);
    };

    // fetch initially
    fetchAndSetNews();

    const interval = setInterval(fetchAndSetNews, 120000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCountdownTarget(
        getLoopingCountdownTarget(now, electionStartDate, electionEndDate),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate countdown based on the next active cycle
  const timeLeft = calculateTimeLeft(countdownTarget);
  const { months, days, hours, minutes, seconds } = timeLeft;

  return (
    <div className="min-h-screen relative overflow-visible">
      <div className="relative max-w-6xl mx-auto px-6 py-16 space-y-16">
        <img
          src={LeftDecor}
          alt="Decorative Vector"
          className="
          hidden md:block
          absolute -left-52 -bottom-24
          pointer-events-none
          -z-10
          blur-sm
          rotate-[25deg]
          transition-all duration-700 ease-in-out
        "
        />

        <section className="text-center space-y-6">
          <h1 className="md:text-6xl mb-10 text-4xl z-20 font-bold tracking-tight">
            Time For Upcoming National Election
          </h1>

          <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
            The countdown refreshes automatically and restarts when it reaches zero.
          </p>

          <div className="mt-8">
            {/* Mobile (Months, Days, Hours) */}
            <div className="grid grid-cols-3 gap-4 sm:hidden max-w-md mx-auto">
              {[
                { label: "Months", value: months },
                { label: "Days", value: days },
                { label: "Hours", value: hours },
              ].map((item) => (
                <Card key={item.label} className="text-center shadow-md">
                  <CardContent className="py-6">
                    <div className="text-5xl font-semibold tabular-nums">
                      {item.value.toString().padStart(2, "0")}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop (Months, Days, Hours, Minutes, Seconds) */}
            <div className="hidden sm:flex justify-center gap-6">
              {[
                { label: "Months", value: months },
                { label: "Days", value: days },
                { label: "Hours", value: hours },
                { label: "Minutes", value: minutes },
                { label: "Seconds", value: seconds },
              ].map((item) => (
                <Card key={item.label} className="w-60 text-center shadow-lg">
                  <CardContent className="py-10">
                    <div className="text-6xl font-medium tabular-nums">
                      {item.value.toString().padStart(2, "0")}
                    </div>
                    <div className="text-lg text-gray-500 mt-1">
                      {item.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* News Section */}
      <section className="space-y-6 pt-10 mt-10 bg-white">
        <h2 className="text-4xl text-center font-semibold">
          Latest Election Updates
        </h2>
        <div className="w-1/2 mx-auto border-t-2 border-red-500 my-4 mb-8"></div>
        <div className="grid md:grid-cols-2 mx-auto gap-6 max-w-sm md:max-w-5xl">
          {news.length > 0 ? (
            news.map((item, index) => (
              <a
                key={item.article_id ?? index}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="hover:shadow-xl cursor-pointer transition mt-10">
                  {item.image_url ? (
                    <CardImage src={item.image_url} alt={item.title} />
                  ) : (
                    <CardImage src="/placeholder.png" alt="No image" />
                  )}

                  <CardContent className="p-6 space-y-3">
                    <h3 className="font-medium text-lg">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </CardContent>
                </Card>
              </a>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500 py-12">
              No election news available at the moment.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
