import { Navbar } from "@/modules/home/ui/components/navbar";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col max-w-3xl mx-auto w-full">
      <Navbar />
      <section className="space-y-6 pt-[16vh] 2xl:pt-48">
        <div className="flex flex-col items-center">{children}</div>
      </section>
    </div>
  );
}
