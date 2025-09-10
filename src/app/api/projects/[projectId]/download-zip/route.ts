import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import prisma from '@/lib/prisma';
import { Fragment } from '@/generated/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // Fetch all fragments for the project
    const fragments = await prisma.fragment.findMany({
      where: {
        message: {
          projectId: projectId,
        },
      },
      include: {
        message: true,
      },
    });

    if (fragments.length === 0) {
      return NextResponse.json({ error: 'No files found for this project' }, { status: 404 });
    }

    const zip = new JSZip();

    // Collect all generated files content to detect dependencies
    let allFilesContent = '';
    fragments.forEach((fragment: Fragment) => {
      const files = fragment.files as Record<string, string>;
      allFilesContent += Object.values(files).join('\n');
    });

  // Detect dependencies based on imports
    const detectedDeps = new Set<string>();
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(allFilesContent)) !== null) {
      const packageName = match[1];
      // Skip relative imports, alias, built-ins, and Next.js subpath imports like next/link, next/image
      if (
        packageName.startsWith('.') ||
        packageName.startsWith('~/') ||
        packageName.startsWith('@/') ||
        packageName === 'react' ||
        packageName === 'next' ||
        packageName.startsWith('next/')
      ) {
        continue;
      }
      detectedDeps.add(packageName);
    }

    // Base dependencies
    const baseDeps: Record<string, string> = {
      "next": "14.0.0",
      "react": "^18",
      "react-dom": "^18",
      "clsx": "^2.1.1",
      "tailwind-merge": "^2.3.0",
      "class-variance-authority": "^0.7.1",
      "radix-ui": "^1.4.2"
    };

    // Add detected dependencies
    const allDeps: Record<string, string> = { ...baseDeps };
  detectedDeps.forEach(dep => {
      // Map common packages to versions
      const versionMap: Record<string, string> = {
        'lucide-react': '^0.469.0',
        '@radix-ui/react-icons': 'latest',
        '@number-flow/react': 'latest',
        'framer-motion': 'latest',
        // Add more mappings as needed
      };
      if (versionMap[dep]) {
        allDeps[dep] = versionMap[dep];
      } else {
        // Default version for unknown packages
        allDeps[dep] = 'latest';
      }
    });

    // Remove any accidental next/* pseudo-packages and sanitize accidental ^latest or ~latest
    Object.keys(allDeps).forEach((k) => {
      if (k.startsWith('next/')) {
        delete allDeps[k];
      }
    });
    Object.keys(allDeps).forEach((k) => {
      const v = String(allDeps[k] ?? '').trim();
      if (/^[~^]\s*latest$/i.test(v)) {
        allDeps[k] = 'latest';
      }
    });

    // Generate package.json
    const packageJson = {
      "name": "generated-project",
      "version": "0.1.0",
      "private": true,
      "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "lint": "next lint"
      },
      "dependencies": allDeps,
      "devDependencies": {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        "typescript": "^5",
        "eslint": "^8",
        "eslint-config-next": "14.0.0",
        "tailwindcss": "^3.4.0",
        "autoprefixer": "^10.4.0",
        "postcss": "^8.4.0",
        "tailwindcss-animate": "^1.0.7"
      }
    };

    // Determine which shadcn/ui components are referenced
    const usedUi = new Set<string>();
    const uiImportRegex = /from\s+['"]@\/components\/ui\/([^'"\n]+)['"]/g;
    let uiMatch;
    while ((uiMatch = uiImportRegex.exec(allFilesContent)) !== null) {
      usedUi.add(uiMatch[1]);
    }

    // Available UI snippets
    const uiSnippets: Record<string, string> = {
      'button': `import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        customize:
          "border border-primary bg-primary/20 text-primary shadow-xs hover:bg-primary/30 dark:bg-primary/30 dark:border-primary dark:hover:bg-primary/40",
        tertiary:
          "bg-primary/25 dark:bg-primary/30 text-primary shadow-xs hover:bg-primary/20 dark:hover:bg-primary/25",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };` ,
      'card': `import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
` ,
      'input': `import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
`
    };

    // Add default project files
    const defaultFiles: Record<string, string> = {
      'package.json': JSON.stringify(packageJson, null, 2),
      'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental: {
  //   appDir: true,
  // },
}

module.exports = nextConfig
`,
      'tsconfig.json': JSON.stringify({
        "compilerOptions": {
          "target": "es5",
          "lib": ["dom", "dom.iterable", "es6"],
          "allowJs": true,
          "skipLibCheck": true,
          "strict": true,
          "noEmit": true,
          "esModuleInterop": true,
          "module": "esnext",
          "moduleResolution": "bundler",
          "resolveJsonModule": true,
          "isolatedModules": true,
          "jsx": "preserve",
          "incremental": true,
          "plugins": [
            {
              "name": "next"
            }
          ],
          "baseUrl": ".",
          "paths": {
            "@/*": ["./*"]
          }
        },
        "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        "exclude": ["node_modules"]
      }, null, 2),
      // Provide a minimal layout only if the fragment doesn't include one.
      'app/layout.tsx': `import './globals.css'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
      'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`,
      'lib/utils.ts': `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`,
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
`,
      'postcss.config.js': `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
      // No default app/page.tsx; the fragment should provide it.
    };

    // Add only referenced UI components
    for (const name of usedUi) {
      if (uiSnippets[name]) {
        defaultFiles[`components/ui/${name}.tsx`] = uiSnippets[name];
      }
    }

    Object.entries(defaultFiles).forEach(([path, content]) => {
      zip.file(path, content);
    });

    // Add files from each fragment
    fragments.forEach((fragment: Fragment) => {
      const files = fragment.files as Record<string, string>; // Assuming files is {path: content}
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });
    });

    // Generate ZIP buffer
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    // Return ZIP as response
    return new NextResponse(new Uint8Array(zipArrayBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project-${projectId}.zip"`,
      },
    });
  } catch (error) {
    console.error('Error generating ZIP:', error);
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 });
  }
}
