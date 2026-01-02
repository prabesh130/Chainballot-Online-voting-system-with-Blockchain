import { Card, CardImage, CardContent } from "./Card";
import { useEffect, useState } from "react";
import LeftDecor from "../assets/image/vecto.png";
import RightDecor from "../assets/image/moon.png";

// -------------------- Countdown Hook --------------------
interface NewsItem {
  title: string;
  description: string;
  link: string;
  image_url?: string | null;
  category?: string | string[] | null;
  article_id?: string | number; // fallback for key
  [key: string]: any; // for extra API fields
}

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

// -------------------- Fetch News --------------------
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
            cat.toLowerCase() === "lifestyle" ||
            cat.toLowerCase() === "top"
        );
      }

      if (typeof item.category === "string") {
        return (
          item.category.toLowerCase() === "politics" ||
          item.category.toLowerCase() === "political" ||
          item.category.toLowerCase() === "election" ||
          item.category.toLowerCase() === "lifestyle" ||
          item.category.toLowerCase() === "top"
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

// -------------------- Home Page --------------------
export default function Home() {
  const electionDate = new Date("2026-04-15T09:00:00"); // dynamic later
  const { months, days, hours, minutes, seconds } = useCountdown(electionDate);
  const [news, setNews] = useState<NewsItem[]>([]);

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

  return (
    <div className="min-h-screen relative overflow-visible">
      <img
        src={LeftDecor}
        alt="Decorative Vector"
        className="
          hidden md:block
          absolute -left-6 
          pointer-events-none
          z-0
          blur-sm
          rotate-[15deg]
          transition-all duration-700 ease-in-out
        "
      />

      <div className="relative z-10 max-w-6xl mt-20 mx-auto px-6 py-16 space-y-16">
        <section className="text-center space-y-6">
          <h1 className="md:text-6xl mb-28 text-4xl font-bold tracking-tight">
            Time For Upcoming National Election
          </h1>

          <div className="flex justify-center gap-6 mt-8">
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
                  <div className="text-lg text-gray-500 mt-1">{item.label}</div>
                </CardContent>
              </Card>
            ))}
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
          {news.map((item, index) => (
            <Card
              key={item.article_id ?? index} // fallback key
              className="hover:shadow-xl cursor-pointer transition mt-10"
              onClick={() => window.open(item.link, "_blank")}
            >
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
          ))}
        </div>
      </section>
    </div>
  );
}
