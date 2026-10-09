import { fr } from "@/i18n/fr";

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
      <h1 className="text-title text-primary">{fr.app.name}</h1>
    </main>
  );
}
