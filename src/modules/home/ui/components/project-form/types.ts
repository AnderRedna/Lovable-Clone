import { z } from "zod";

export const analyticsProviderSchema = z.enum(["none", "google-analytics", "clarity", "hotjar", "other"]);

export type AnalyticsProvider = z.infer<typeof analyticsProviderSchema>;

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

export function getOrderedComponentKeys(
  componentKeys: ComponentKey[],
  componentsCfg: Record<ComponentKey, ComponentConfig>
): ComponentKey[] {
  const enabledKeys = componentKeys.filter((k) => componentsCfg[k].enabled);

  if (enabledKeys.length === 0) return [];

  // Header sempre vem primeiro
  const headerKey = enabledKeys.find(k => k === "Header");
  // Footers sempre vem por último
  const footerKey = enabledKeys.find(k => k === "Footers");

  // Componentes do meio, ordenados pela ordem de seleção
  const middleKeys = enabledKeys
    .filter(k => k !== "Header" && k !== "Footers")
    .sort((a, b) => {
      const orderA = componentsCfg[a].order || 0;
      const orderB = componentsCfg[b].order || 0;
      return orderA - orderB;
    });

  // Monta a ordem final: Header + componentes do meio + Footers
  const result: ComponentKey[] = [];
  if (headerKey) result.push(headerKey);
  result.push(...middleKeys);
  if (footerKey) result.push(footerKey);

  return result;
}
