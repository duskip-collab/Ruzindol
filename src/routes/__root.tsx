import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSettingsProvider } from "../context/AppSettingsContext";
import { AppModeProvider } from "../context/AppModeContext";
import { FontScaleProvider } from "../context/FontScaleContext";
import { NotificationProvider } from "../context/NotificationContext";
import { ThemeProvider } from "../context/ThemeContext";
import { RouteErrorView } from "../components/RouteErrorView";
import { RealtimeNotificationBanner } from "../components/RealtimeNotificationBanner";
import { Splash } from "../components/Splash";
import { useActivityTracking } from "../hooks/useActivityTracking";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

const ErrorComponent = RouteErrorView;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#18181b" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "Moji Susedia" },
      { title: "Komunita" },
      { name: "description", content: "PWA aplikácia pre lokálnu komunitu" },
      { name: "author", content: "Komunita" },
      { property: "og:title", content: "Komunita" },
      {
        property: "og:description",
        content: "PWA aplikácia pre lokálnu komunitu",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-192.png", sizes: "192x192" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useActivityTracking();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FontScaleProvider>
          <AppSettingsProvider>
            <AppModeProvider>
              <NotificationProvider>
                <div className="relative min-h-screen bg-slate-50 text-foreground">
                  <Splash />
                  <RealtimeNotificationBanner />
                  {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                  <Outlet />
                </div>
              </NotificationProvider>
            </AppModeProvider>
          </AppSettingsProvider>
        </FontScaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
