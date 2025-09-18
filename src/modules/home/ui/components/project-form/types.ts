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
  order?: number;
};

export type AnalyticsState = { provider: AnalyticsProvider; code?: string };

export const COMPONENT_TRANSLATIONS: Record<ComponentKey, string> = {
  Background: "Fundo",
  Announcement: "Anúncio",
  CallToAction: "Chamada para Ação",
  Clients: "Clientes",
  Features: "Recursos",
  Footers: "Rodapés",
  Heroes: "Heróis",
  Images: "Imagens",
  Header: "Cabeçalho",
  Pricing: "Preços",
  Testimonials: "Depoimentos",
  Video: "Vídeo",
};
