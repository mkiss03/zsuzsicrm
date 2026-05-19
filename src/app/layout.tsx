import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ZsuzsiCRM", template: "%s | ZsuzsiCRM" },
  description: "UtazóFotós — utazásszervezési CRM rendszer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="hu"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className={GeistSans.className}>
        {children}
        <Toaster
          position="bottom-right"
          duration={4000}
          toastOptions={{
            unstyled: false,
            classNames: {
              toast:   "font-sans text-[13px] rounded-md border shadow-sm",
              success: "border-green-200 bg-green-50  text-green-800",
              error:   "border-red-200   bg-red-50    text-red-800",
              info:    "border-blue-200  bg-blue-50   text-blue-800",
              warning: "border-amber-200 bg-amber-50  text-amber-800",
              title:   "font-medium",
              description: "opacity-80",
            },
          }}
        />
      </body>
    </html>
  );
}
