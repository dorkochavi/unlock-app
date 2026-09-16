import { getMessages } from "@/messages";

export default function Home() {
  const messages = getMessages();

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <main className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {messages.shell.heading}
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          {messages.shell.tagline}
        </p>
      </main>
    </div>
  );
}
