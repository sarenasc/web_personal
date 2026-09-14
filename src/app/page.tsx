import Image from "next/image";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { profile, experience, skills } = await getContent();

  const skillsByCategory = skills.reduce<Record<string, typeof skills>>((acc, skill) => {
    const key = skill.category || "Otros";
    acc[key] = acc[key] ? [...acc[key], skill] : [skill];
    return acc;
  }, {});

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      {/* Hero */}
      <section className="mb-20 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          {profile.heroPhotoUrl ? (
            <Image
              src={profile.heroPhotoUrl}
              alt={profile.name}
              width={128}
              height={128}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
              Foto
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{profile.name}</h1>
          <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">{profile.title}</p>
          <p className="mt-1 text-sm text-neutral-500">{profile.tagline}</p>
        </div>
      </section>

      {/* Historia */}
      <section className="mb-20">
        <h2 className="mb-4 text-xl font-semibold">Sobre mí</h2>
        <div className="flex flex-col gap-6 sm:flex-row">
          {profile.aboutPhotoUrl && (
            <Image
              src={profile.aboutPhotoUrl}
              alt="Sobre mí"
              width={200}
              height={200}
              className="h-40 w-40 shrink-0 rounded-lg object-cover"
            />
          )}
          <p className="whitespace-pre-line text-neutral-700 dark:text-neutral-300">
            {profile.bioLong}
          </p>
        </div>
      </section>

      {/* Experiencia */}
      <section className="mb-20">
        <h2 className="mb-6 text-xl font-semibold">Experiencia</h2>
        <ol className="space-y-8 border-l border-neutral-200 pl-6 dark:border-neutral-800">
          {experience.map((exp) => (
            <li key={exp.id} className="relative">
              <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
              <p className="text-sm text-neutral-500">
                {exp.startDate} — {exp.endDate || "Presente"}
              </p>
              <h3 className="font-semibold">{exp.role}</h3>
              <p className="text-neutral-600 dark:text-neutral-400">{exp.company}</p>
              {exp.description && (
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {exp.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Skills */}
      <section className="mb-20">
        <h2 className="mb-6 text-xl font-semibold">Skills</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {Object.entries(skillsByCategory).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-medium text-neutral-500">{category}</h3>
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-800"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contacto */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Contacto</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="underline hover:text-neutral-500">
              {profile.email}
            </a>
          )}
          {profile.linkedinUrl && (
            <a href={profile.linkedinUrl} target="_blank" className="underline hover:text-neutral-500">
              LinkedIn
            </a>
          )}
          {profile.githubUrl && (
            <a href={profile.githubUrl} target="_blank" className="underline hover:text-neutral-500">
              GitHub
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
