import { getContent } from "@/lib/content";
import {
  updateProfileAction,
  addExperienceAction,
  deleteExperienceAction,
  addSkillAction,
  deleteSkillAction,
  logoutAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const content = await getContent();
  const { profile, experience, skills } = content;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <form action={logoutAction}>
          <button className="text-sm text-neutral-500 underline hover:text-neutral-800">
            Cerrar sesión
          </button>
        </form>
      </div>

      <section className="mb-10 rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Perfil</h2>
        <form action={updateProfileAction} className="grid gap-4">
          <Field label="Nombre" name="name" defaultValue={profile.name} />
          <Field label="Título / cargo" name="title" defaultValue={profile.title} />
          <Field label="Tagline" name="tagline" defaultValue={profile.tagline} />
          <TextArea label="Bio corta" name="bioShort" defaultValue={profile.bioShort} />
          <TextArea label="Historia personal" name="bioLong" defaultValue={profile.bioLong} rows={6} />
          <Field label="Ubicación" name="location" defaultValue={profile.location} />
          <Field label="Email" name="email" defaultValue={profile.email} />
          <Field label="LinkedIn" name="linkedinUrl" defaultValue={profile.linkedinUrl} />
          <Field label="GitHub" name="githubUrl" defaultValue={profile.githubUrl} />
          <div>
            <label className="mb-1 block text-sm font-medium">Foto principal (hero)</label>
            {profile.heroPhotoUrl && (
              <p className="mb-1 text-xs text-neutral-500">Actual: {profile.heroPhotoUrl}</p>
            )}
            <input type="file" name="heroPhoto" accept="image/*" className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Foto sección historia</label>
            {profile.aboutPhotoUrl && (
              <p className="mb-1 text-xs text-neutral-500">Actual: {profile.aboutPhotoUrl}</p>
            )}
            <input type="file" name="aboutPhoto" accept="image/*" className="text-sm" />
          </div>
          <button className="mt-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Guardar perfil
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Experiencia</h2>
        <ul className="mb-6 space-y-3">
          {experience.map((exp) => (
            <li key={exp.id} className="flex items-start justify-between rounded-md border border-neutral-100 p-3">
              <div>
                <p className="font-medium">
                  {exp.role} · {exp.company}
                </p>
                <p className="text-sm text-neutral-500">
                  {exp.startDate} — {exp.endDate || "Presente"}
                </p>
                <p className="mt-1 text-sm text-neutral-700">{exp.description}</p>
              </div>
              <form action={deleteExperienceAction}>
                <input type="hidden" name="id" value={exp.id} />
                <button className="text-sm text-red-600 hover:underline">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addExperienceAction} className="grid gap-3 border-t border-neutral-100 pt-4">
          <p className="text-sm font-medium">Agregar experiencia</p>
          <Field label="Empresa" name="company" />
          <Field label="Cargo" name="role" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio (ej. 2016)" name="startDate" />
            <Field label="Fin (vacío = presente)" name="endDate" />
          </div>
          <TextArea label="Descripción" name="description" rows={3} />
          <div>
            <label className="mb-1 block text-sm font-medium">Logo (opcional)</label>
            <input type="file" name="logo" accept="image/*" className="text-sm" />
          </div>
          <button className="mt-1 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Agregar
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Skills</h2>
        <ul className="mb-6 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill.id} className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-sm">
              {skill.name}
              <form action={deleteSkillAction}>
                <input type="hidden" name="id" value={skill.id} />
                <button className="text-red-600 hover:underline">×</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addSkillAction} className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
          <Field label="Nombre" name="name" />
          <Field label="Categoría" name="category" />
          <button className="col-span-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Agregar skill
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
      />
    </div>
  );
}
