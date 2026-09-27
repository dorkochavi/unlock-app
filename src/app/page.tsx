import { ButtonLink } from "@/components/button";
import { getMessages } from "@/messages";

export default function Home() {
  const messages = getMessages();

  return (
    <main className="flex flex-1 items-center justify-center p-6 sm:p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{messages.shell.heading}</h1>
        <p className="mt-3 text-lg text-muted">{messages.shell.tagline}</p>
        <ButtonLink href="/today" className="mt-6">
          {messages.shell.goToToday}
        </ButtonLink>
      </div>
    </main>
  );
}
