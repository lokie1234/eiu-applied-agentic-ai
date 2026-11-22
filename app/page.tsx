import LandingPage from "@/components/LandingPage";
import { redirect } from 'next/navigation';
import { currentUserAccess } from '@/lib/auth/currentUser';
export default async function HomePage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const [query,access] = await Promise.all([searchParams,currentUserAccess()]);
  // Reuse the existing signed session, including live permission/revocation
  // checks. A merely valid cookie could loop back here after access is revoked.
  if(access?.isActive)redirect('/learn');
  return <LandingPage googleResult={query.result} />;
}
