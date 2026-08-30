import { seoulDateKey } from "@/src/applications/application-data";
import HomeClientPage from "@/src/home/home-client-page";

const seoulFullDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "full",
});

export default function HomePage() {
  const now = new Date();
  const today = seoulDateKey(now);
  const todayLabel = seoulFullDateFormatter.format(now);

  return <HomeClientPage today={today} todayLabel={todayLabel} />;
}
