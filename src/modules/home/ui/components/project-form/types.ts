export type AnalyticsProvider = "none" | "google-analytics" | "clarity" | "other";

export type ComponentKey =
  | "Background"
  | "Announcement"
  | "CallToAction"
  | "Clients"
  | "Features"
  | "Footers"
  | "Heroes"
  | "Images"
  | "Header"
  | "Pricing"
  | "Testimonials"
  | "Video";

export type ComponentConfig = {
  enabled: boolean;
  prompt?: string;
  border?: {
    enabled: boolean;
    prompt?: string;
  };
};

export type AnalyticsState = { provider: AnalyticsProvider; code?: string };
