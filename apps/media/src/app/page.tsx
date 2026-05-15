import MediaDashboard from "@/components/MediaDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <MediaDashboard initialItems={[]} initialKnowledgeBases={[]} mode="public" />;
}
