import LandingPage from "@/components/LandingPage";
export default async function HomePage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const query = await searchParams;
  return <LandingPage googleResult={query.result} />;
}
