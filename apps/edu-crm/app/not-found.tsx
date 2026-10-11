import { uz } from "@/lib/uz";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="type-heading text-title text-foreground">{uz.unknownTitle}</h1>
        <p className="mt-1 text-body text-muted-foreground">{uz.unknownHint}</p>
      </div>
    </main>
  );
}
