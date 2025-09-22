export const PROJECT_TEMPLATES = [
  {
    emoji: "🚀",
    title: "Para SaaS",
    prompt:
      "Create a comprehensive SaaS landing page with: 1) A navigation bar with logo, menu items (Features, Pricing, About, Contact), and login/signup buttons; 2) Hero section with compelling headline, subheadline, CTA button, and product screenshot/demo; 3) Features section with icons and descriptions; 4) Pricing section with 3 tiers (Basic, Pro, Enterprise) showing monthly/yearly toggle, features list, and CTA buttons; 5) Testimonials with customer photos and quotes; 6) Footer with company info, product links, support links, social media icons, and newsletter signup. Use modern design with gradients, shadows, responsive layout, and professional color scheme.",
  },
  {
    emoji: "📈",
    title: "Para marketing",
    prompt:
      "Create a high-converting marketing landing page with: 1) Navigation bar with logo and key menu items; 2) Hero section with attention-grabbing headline, compelling subheadline, benefit-focused copy, and prominent CTA button; 3) Benefits/features section with icons, headlines, and descriptions; 4) Social proof section with customer testimonials, logos, and statistics; 5) Lead magnet section with valuable offer and email capture form; 6) FAQ section addressing common objections; 7) Footer with contact info, social links, and legal pages. Use persuasive copywriting, high-contrast colors, urgency elements, and mobile-first responsive design.",
  },
  {
    emoji: "🚪",
    title: "Para fake door",
    prompt:
      "Build a compelling fake door landing page with: 1) Minimal navigation with logo only; 2) Hero section with intriguing headline, mystery-building subheadline, and teaser description; 3) Countdown timer showing launch date with urgency messaging; 4) Email capture form with compelling lead magnet (early access, exclusive discount, beta invitation); 5) Social proof indicators (number of signups, testimonials from beta users); 6) Feature preview section with coming soon badges; 7) Social media links for updates; 8) Footer with basic company info. Use minimalist design, urgency elements, FOMO triggers, and mobile-optimized layout with focus on conversion.",
  },
  {
    emoji: "🏢",
    title: "Para empresarial",
    prompt:
      "Create a professional corporate landing page with: 1) Navigation bar with logo, services menu, about, contact, and request quote button; 2) Hero section with professional headline, company value proposition, and consultation CTA; 3) Services section with detailed service cards, icons, and descriptions; 4) About Us section with company history, mission, and team photos; 5) Client portfolio with logos, case studies, and success metrics; 6) Testimonials section with client quotes and company names; 7) Contact section with form, office locations, and business hours; 8) Footer with company info, service links, certifications, and social media. Use professional color scheme, clean typography, trust indicators, and corporate design elements.",
  },
  {
    emoji: "🎯",
    title: "Para lançamento de produto",
    prompt:
      "Design an exciting product launch landing page with: 1) Navigation with logo, product info, and pre-order button; 2) Hero section with product video/animation, launch headline, key benefits, and pre-order CTA; 3) Product showcase with high-quality images, 360° view, and feature highlights; 4) Features grid with icons, descriptions, and comparison charts; 5) Pricing section with early bird discounts, bundle options, and limited-time offers; 6) Social proof with influencer endorsements, media coverage, and pre-order numbers; 7) Launch timeline with key dates and milestones; 8) Newsletter signup for updates and exclusive content; 9) Footer with company info, support, and social links. Use dynamic animations, bold visuals, countdown timers, and conversion-focused design.",
  },
  {
    emoji: "🌟",
    title: "Para startup",
    prompt:
      "Build an innovative startup landing page with: 1) Navigation with logo, solution, team, investors, and contact links; 2) Hero section with problem statement, solution headline, value proposition, and demo request CTA; 3) Problem-solution section with pain points and how the startup solves them; 4) Product demo with screenshots, video walkthrough, and key features; 5) Market opportunity section with statistics and growth potential; 6) Team section with founder photos, bios, and expertise; 7) Investor/advisor section with logos and quotes; 8) Roadmap with milestones and future plans; 9) Press coverage and media mentions; 10) Contact section for partnerships and investment inquiries; 11) Footer with company info and social links. Use vibrant colors, modern design, storytelling elements, and startup-focused messaging.",
  },
  {
    emoji: "📱",
    title: "Para app",
    prompt:
      "Create a compelling app landing page with: 1) Navigation with logo, features, pricing, download, and support links; 2) Hero section with app icon, catchy headline, key benefits, and download buttons (iOS/Android); 3) App screenshots carousel showing key screens and user interface; 4) Features section with icons, descriptions, and app capabilities; 5) How it works section with step-by-step process; 6) User testimonials and app store ratings with 5-star reviews; 7) Pricing section for premium features or subscriptions; 8) FAQ section addressing common user questions; 9) Download section with app store badges and QR codes; 10) Footer with support links, privacy policy, and social media. Use mobile-first design, app store optimization elements, and user-centric messaging.",
  },
  {
    emoji: "⏳",
    title: "Para waitlist",
    prompt:
      "Create an engaging waitlist landing page with: 1) Minimal navigation with logo and login option; 2) Hero section with compelling headline, exclusive access messaging, and PROMINENT email capture form as the main focal point; 3) Large, eye-catching email signup form with clear CTA button, placeholder text, and immediate confirmation; 4) Benefits section highlighting early access perks, exclusive discounts, and VIP treatment; 5) Social proof with current signup numbers, testimonials from beta users, and influencer endorsements; 6) Launch countdown timer with anticipated release date; 7) Referral program integration within the email form; 8) Progress bar showing waitlist milestones and goals; 9) Sneak peek section with product teasers and behind-the-scenes content; 10) FAQ section addressing common waitlist questions; 11) Footer with company info and social media for updates. Use FOMO elements, urgency messaging, exclusive design aesthetics, and ensure the email form is the most prominent element on the page with mobile-optimized conversion flow.",
  }
] as const;

export const MAX_SEGMENTS = 4;

export const SANDBOX_TIMEOUT_IN_MS = 60_000 * 10 * 2;