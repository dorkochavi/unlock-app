import type { Metadata } from "next";
import { locale } from "@/lib/locale";
import { getMessages } from "@/messages";
import "./globals.css";

const messages = getMessages();

export const metadata: Metadata = {
  title: messages.app.name,
  description: messages.app.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={locale.lang} dir={locale.dir} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
