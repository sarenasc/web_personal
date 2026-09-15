import { getContent } from "@/lib/content";
import {
  updateProfileAction,
  addExperienceAction,
  updateExperienceAction,
  deleteExperienceAction,
  addEducationAction,
  deleteEducationAction,
  addSkillAction,
  deleteSkillAction,
  deleteMessageAction,
  logoutAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const content = await getContent();
  const { profile, experience, education, skills, messages } = content;

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
            <li key={exp.id} className="rounded-md border border-neutral-100 p-3">
              <div className="flex items-start justify-between gap-2">
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
                  <button className="shrink-0 text-sm text-red-600 hover:underline">Eliminar</button>
                </form>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-neutral-600 hover:underline">
                  Editar
                </summary>
                <form
                  action={updateExperienceAction}
                  className="mt-3 grid gap-3 border-t border-neutral-100 pt-3"
                >
                  <input type="hidden" name="id" value={exp.id} />
                  <Field label="Empresa" name="company" defaultValue={exp.company} />
                  <Field label="Cargo" name="role" defaultValue={exp.role} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Inicio" name="startDate" defaultValue={exp.startDate} />
                    <Field label="Fin (vacío = presente)" name="endDate" defaultValue={exp.endDate} />
                  </div>
                  <TextArea label="Descripción" name="description" defaultValue={exp.description} rows={3} />
                  <div>
                    <label className="mb-1 block text-sm font-medium">Logo (opcional)</label>
                    {exp.logoUrl && (
                      <p className="mb-1 text-xs text-neutral-500">Actual: {exp.logoUrl}</p>
                    )}
                    <input type="file" name="logo" accept="image/*" className="text-sm" />
                  </div>
                  <button className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
        <form action={addExperienceAction} className="grid gap-3 border-t border-neutral-100 pt-4">
          <div>
            <p className="text-sm font-medium">Agregar experiencia</p>
            <p className="text-xs text-neutral-500">
              Se agregan una por una: completa y presiona Agregar. El formulario queda vacío,
              listo para la siguiente.
            </p>
          </div>
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

      <section className="mb-10 rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Educación</h2>
        <ul className="mb-6 space-y-3">
          {education.map((edu) => (
            <li key={edu.id} className="flex items-start justify-between rounded-md border border-neutral-100 p-3">
              <div>
                <p className="font-medium">{edu.program}</p>
                <p className="text-sm text-neutral-500">{edu.institution}</p>
                <p className="text-sm text-neutral-500">
                  {edu.startDate || "—"} — {edu.endDate || "En curso"}
                </p>
                {edu.description && (
                  <p className="mt-1 text-sm text-neutral-700">{edu.description}</p>
                )}
              </div>
              <form action={deleteEducationAction}>
                <input type="hidden" name="id" value={edu.id} />
                <button className="text-sm text-red-600 hover:underline">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addEducationAction} className="grid gap-3 border-t border-neutral-100 pt-4">
          <div>
            <p className="text-sm font-medium">Agregar educación</p>
            <p className="text-xs text-neutral-500">
              Se agregan una por una: completa y presiona Agregar. El formulario queda vacío,
              listo para la siguiente.
            </p>
          </div>
          <Field label="Institución" name="institution" />
          <Field label="Programa / título" name="program" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio (opcional)" name="startDate" />
            <Field label="Fin (vacío = en curso)" name="endDate" />
          </div>
          <TextArea label="Descripción (opcional)" name="description" rows={2} />
          <button className="mt-1 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Agregar
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-xl border border-neutral-200 p-6">
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
          <p className="col-span-2 text-xs text-neutral-500">
            Se agregan una por una: completa y presiona Agregar skill, cuantas veces quieras.
          </p>
          <Field label="Nombre" name="name" />
          <Field label="Categoría" name="category" />
          <button className="col-span-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Agregar skill
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Mensajes {messages.length > 0 && `(${messages.length})`}
        </h2>
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no has recibido mensajes.</p>
        ) : (
          <ul className="space-y-3">
            {[...messages].reverse().map((msg) => (
              <li key={msg.id} className="rounded-md border border-neutral-100 p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {msg.firstName} {msg.lastName}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(msg.createdAt).toLocaleString("es-CL")}
                    </p>
                  </div>
                  <form action={deleteMessageAction}>
                    <input type="hidden" name="id" value={msg.id} />
                    <button className="text-sm text-red-600 hover:underline">Eliminar</button>
                  </form>
                </div>
                <p className="whitespace-pre-line text-sm text-neutral-700">{msg.body}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                  <a href={`mailto:${msg.email}`} className="underline">
                    {msg.email}
                  </a>
                  {msg.phone && <span>{msg.phone}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
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
