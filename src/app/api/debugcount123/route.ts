import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getContent();
  return Response.json({
    messagesCount: content.messages.length,
    lastMessageAt: content.messages.at(-1)?.createdAt ?? null,
    educationCount: content.education.length,
    skillsCount: content.skills.length,
    experienceCount: content.experience.length,
  });
}
