import { getContent } from "@/lib/content";
import { getMessagesForAdmin } from "@/lib/messages";
import { logoutAction } from "./actions";
import { ProfileForm } from "./ProfileForm";
import { ExperienceSection } from "./ExperienceSection";
import { EducationSection } from "./EducationSection";
import { SkillsSection } from "./SkillsSection";
import { MessagesSection } from "./MessagesSection";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [content, messages] = await Promise.all([getContent(), getMessagesForAdmin()]);
  const { profile, experience, education, skills } = content;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <form action={logoutAction}>
          <button className="text-sm text-neutral-500 underline hover:text-neutral-800">Cerrar sesión</button>
        </form>
      </div>

      <section className="mb-10 rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Perfil</h2>
        <ProfileForm profile={profile} />
      </section>

      <ExperienceSection experience={experience} />
      <EducationSection education={education} />
      <SkillsSection skills={skills} />
      <MessagesSection messages={messages} />
    </main>
  );
}
