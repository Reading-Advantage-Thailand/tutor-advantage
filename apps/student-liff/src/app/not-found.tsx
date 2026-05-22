import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">{t("app.notFoundTitle")}</h2>
      <p className="text-gray-600 mb-8">{t("app.notFoundDescription")}</p>
      <a
        href="/dashboard"
        className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
      >
        {t("app.backDashboard")}
      </a>
    </div>
  );
}
