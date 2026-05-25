import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Indrexa",
  description:
    "AI-readable semantic commerce infrastructure for product retrieval, comparison, and recommendation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="llms" type="text/plain" href="/llms.txt" />
      </head>
      <body>{children}</body>
    </html>
  );
}
