export function Footer() {
  return (
    <footer className="border-t bg-secondary">
      <div className="container py-4 text-center text-sm text-secondary-foreground">
        © {new Date().getFullYear()} OnlyFly. All rights reserved.
      </div>
    </footer>
  );
}
