import Image from "next/image";
import { cookies } from "next/headers";
import { getContent } from "@/lib/content";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { UnderConstruction } from "./_components/UnderConstruction";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.SITE_LIVE !== "true") {
    const cookieStore = await cookies();
    const isAdmin = await verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
    if (!isAdmin) {
      return <UnderConstruction />;
    }
  }

  const { profile, experience, education, skills } = await getContent();

  const skillsByCategory = skills.reduce<Record<string, typeof skills>>((acc, skill) => {
    const key = skill.category || "Otros";
    acc[key] = acc[key] ? [...acc[key], skill] : [skill];
    return acc;
  }, {});

  return (
    <>
      {profile.logoUrl && (
        <header className="mx-auto w-full max-w-3xl px-6 pt-6">
          <Image src={profile.logoUrl} alt={`Logo de ${profile.name}`} width={40} height={40} className="h-10 w-auto" />
        </header>
      )}
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      {/* Hero */}
      <section className="mb-24 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="h-20 w-20 shrink-0 border border-cyan text-cyan sm:h-24 sm:w-24">
          {profile.heroPhotoUrl ? (
            <Image
              src={profile.heroPhotoUrl}
              alt={profile.name}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xl">
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
          )}
        </div>
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {profile.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-cyan">{profile.title}</p>
          <p className="mt-2 text-sm text-muted">{profile.tagline}</p>
        </div>
      </section>

      {/* Historia */}
      <section className="mb-20">
        <SectionLabel>sobre-mi</SectionLabel>
        <div className="flex flex-col gap-6 sm:flex-row">
          {profile.aboutPhotoUrl && (
            <Image
              src={profile.aboutPhotoUrl}
              alt="Sobre mí"
              width={180}
              height={180}
              className="h-36 w-36 shrink-0 border border-border object-cover"
            />
          )}
          <p className="whitespace-pre-line leading-relaxed text-muted">{profile.bioLong}</p>
        </div>
      </section>

      {/* Experiencia */}
      <section className="mb-20">
        <SectionLabel>experiencia</SectionLabel>
        <ol className="space-y-4">
          {experience.map((exp) => (
            <li
              key={exp.id}
              className="flex gap-4 border border-border bg-surface px-5 py-4"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-green shadow-[0_0_6px] shadow-green" />
              <div>
                <p className="font-mono text-xs tracking-wide text-muted">
                  {exp.startDate} — {exp.endDate || "PRESENTE"}
                </p>
                <h3 className="mt-1 font-semibold text-ink">{exp.role}</h3>
                <p className="text-sm text-muted">{exp.company}</p>
                {exp.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{exp.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Educación */}
      {education.length > 0 && (
        <section className="mb-20">
          <SectionLabel>educacion</SectionLabel>
          <ol className="space-y-4">
            {education.map((edu) => (
              <li
                key={edu.id}
                className="flex gap-4 border border-border bg-surface px-5 py-4"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-cyan shadow-[0_0_6px] shadow-cyan" />
                <div>
                  {(edu.startDate || edu.endDate) && (
                    <p className="font-mono text-xs tracking-wide text-muted">
                      {edu.startDate || "—"} — {edu.endDate || "EN CURSO"}
                    </p>
                  )}
                  <h3 className="mt-1 font-semibold text-ink">{edu.program}</h3>
                  <p className="text-sm text-muted">{edu.institution}</p>
                  {edu.description && (
                    <p className="mt-2 text-sm leading-relaxed text-muted">{edu.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Skills */}
      <section className="mb-20">
        <SectionLabel>skills</SectionLabel>
        <div className="grid gap-6 sm:grid-cols-2">
          {Object.entries(skillsByCategory).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <span
                    key={skill.id}
                    className="border border-cyan px-2.5 py-1 font-mono text-xs text-cyan before:content-['['] before:mr-1 before:text-muted after:content-[']'] after:ml-1 after:text-muted"
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
        <SectionLabel>contacto</SectionLabel>

        <div className="mb-8 flex flex-wrap gap-3">
          {profile.email && (
            <a
              href={`mailto:${profile.email}`}
              className="border border-green px-4 py-2 font-mono text-sm text-green transition hover:bg-green hover:text-[#062018]"
            >
              {profile.email}
            </a>
          )}
          {profile.linkedinUrl && (
            <a
              href={profile.linkedinUrl}
              target="_blank"
              className="border border-green px-4 py-2 font-mono text-sm text-green transition hover:bg-green hover:text-[#062018]"
            >
              LinkedIn
            </a>
          )}
          {profile.githubUrl && (
            <a
              href={profile.githubUrl}
              target="_blank"
              className="border border-green px-4 py-2 font-mono text-sm text-green transition hover:bg-green hover:text-[#062018]"
            >
              GitHub
            </a>
          )}
        </div>

        <ContactForm />
      </section>
      </main>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-4 font-mono text-xs tracking-wider text-cyan">
      <span className="text-muted">{"// "}</span>
      {children}
    </p>
  );
}
