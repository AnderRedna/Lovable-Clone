import { SignedIn } from "@clerk/nextjs";
import Image from "next/image";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";

export default function HomePage() {
  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full min-h-full">
      <section className="space-y-6 py-16 md:py-[16vh] 2xl:py-48 flex-shrink-0">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="lovable-clone"
            width={50}
            height={50}
            className="hidden md:block"
          />
        </div>
        <h1 className="text-xl md:text-3xl font-bold text-center">
          Crie uma landing page profissional em segundos
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground text-center">
          Foco em conversão, design moderno e SEO.
        </p>

        <div className="max-w-3xl mx-auto w-full">
          <ProjectForm />
        </div>
      </section>

      <SignedIn>
        <div className="mt-8 mb-8">
          <ProjectsList />
        </div>
      </SignedIn>
    </div>
  );
}
