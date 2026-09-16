"use client";

import { deleteMessageAction } from "./actions";
import type { Message } from "@/lib/messages";
import { ConfirmDeleteButton } from "@/app/_components/ConfirmDeleteButton";

export function MessagesSection({ messages }: { messages: Message[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Mensajes {messages.length > 0 && `(${messages.length})`}</h2>
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
                  <p className="text-xs text-neutral-500">{new Date(msg.createdAt).toLocaleString("es-CL")}</p>
                </div>
                <form action={deleteMessageAction}>
                  <input type="hidden" name="id" value={msg.id} />
                  <ConfirmDeleteButton />
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
  );
}
