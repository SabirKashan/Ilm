import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 bg-[#1B4332] rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-[#F59E0B] text-2xl font-bold">ع</span>
      </div>
      <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-[#1B4332] hover:bg-[#2D6A4F] text-white px-4 py-2 text-sm font-medium transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
