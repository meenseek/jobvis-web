import HomeClientPage from "@/src/home/home-client-page";

const seoulFullDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "full",
});

export default function HomePage() {
	const now = new Date();
	const todayLabel = seoulFullDateFormatter.format(now);

	return <HomeClientPage todayLabel={todayLabel} />;
}
