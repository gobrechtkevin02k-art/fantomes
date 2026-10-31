import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-6 [&_h1]:mt-6 [&_h1]:font-serif [&_h1]:text-4xl [&_h1]:font-extrabold [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
      <Link href="/" className="inline-block py-2 pr-4 underline underline-offset-4">Accueil</Link>
      {children}
    </main>
  );
}
