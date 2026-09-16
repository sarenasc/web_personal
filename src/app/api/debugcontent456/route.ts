import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getContent();
  return Response.json({
    education: content.education,
    skills: content.skills,
    messagesCount: content.messages.length,
  });
}
