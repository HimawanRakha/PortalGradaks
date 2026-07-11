import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Inter: body text — chosen for legibility at the small dense-table sizes
// this dashboard leans on heavily (stat cards, matrices, score grids).
const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Plus Jakarta Sans: headings/titles only (CardTitle, DialogTitle,
// SheetTitle already apply `font-heading` — see components/ui/card.tsx).
// Distinct weight/character from the body face on purpose, for hierarchy.
const fontHeading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Portal Pengembangan MABA 26",
    template: "%s — Portal Pengembangan MABA 26",
  },
  description: "Portal scoring mentor & pemantauan GRADAKS 2026 — PSDM BEM FTEIC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delay={200}>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
