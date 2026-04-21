import { cookies } from "next/headers";
import MediaDashboard from "@/components/MediaDashboard";
import PersonalAccessGate from "@/components/PersonalAccessGate";
import { getMediaItems } from "@/app/actions";
import { dbHasPersonalAccessKey } from "@/lib/db";
import { PERSONAL_ACCESS_COOKIE } from "@/lib/personal-access-cookie";

export const dynamic = "force-dynamic";

export default async function PersonalDashboardPage() {
  const hasKeyConfigured = await dbHasPersonalAccessKey();
  const cookieStore = await cookies();
  const isAuthorized = cookieStore.get(PERSONAL_ACCESS_COOKIE)?.value === "granted";

  if (!hasKeyConfigured || !isAuthorized) {
    return <PersonalAccessGate hasKeyConfigured={hasKeyConfigured} />;
  }

  const initialItems = await getMediaItems();
  return <MediaDashboard initialItems={initialItems} mode="personal" />;
}
