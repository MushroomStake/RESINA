import Image from "next/image";

const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "#";
const mobileAppUrl = process.env.NEXT_PUBLIC_MOBILE_APP_URL ?? "#";
const apkDownloadUrl =
  "https://github.com/MushroomStake/RESINA/releases/download/v1.0.0/application-eac13c28-f258-4457-8938-ba9262efa675.apk";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[#f3f5f5] text-[#0f2744]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col">
        <header className="flex items-center justify-between px-5 py-4 md:px-10 md:py-5">
          <a className="flex items-center gap-3" href="#">
            <Image src="/images/resina%20logo.png" alt="Resina logo" width={56} height={56} priority />
            <span className="font-[family-name:var(--font-display)] text-[30px] leading-none">RESINA</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-[#4f5963] md:flex">
            <a className="text-[#2e9d5a]" href="#about">
              About
            </a>
            <a href="#download">Download</a>
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
          </nav>

          <a
            href={apkDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-[#46ad55] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a9749]"
          >
            Download APK
          </a>
        </header>

        <section className="grid flex-1 grid-cols-1 items-center gap-12 px-5 py-6 md:grid-cols-2 md:px-10 md:py-8">
          <div className="max-w-[560px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c5e8ce] bg-[#edf7ef] px-4 py-1.5 text-sm font-medium text-[#2e7d47]">
              <span className="h-2 w-2 rounded-full bg-[#2e9d5a]" />
              Brgy. Sta. Rita, Olongapo City
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-wide text-[#0d3d73] md:text-6xl">
              RESINA
            </h1>
            <p className="mt-3 text-3xl font-semibold leading-tight text-[#0d3d73] md:text-[42px]">
              Real-time Water Level Sensor IoT Network for Adaptive Flood Alerts
            </p>
            <p className="mt-8 max-w-[520px] text-lg leading-8 text-[#5e6872] md:text-xl">
              RESINA deploys IoT flood sensors along critical waterways in Barangay Sta. Rita,
              Olongapo City — monitoring water levels in real time to keep residents and
              barangay officials informed before flooding occurs.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href={webAppUrl}
                className="rounded-lg bg-[#49af57] px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-[#3f9a4d]"
              >
                Get started today
              </a>
              <a
                href={apkDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[#49af57] bg-white px-7 py-3 text-base font-semibold text-[#2f8e41] transition-colors hover:bg-[#eff9f1]"
              >
                Download APK
              </a>
            </div>
          </div>

          <div className="relative mx-auto h-[460px] w-full max-w-[520px] md:h-[560px]">
            <div className="absolute left-[56%] top-[48%] h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e4ebe4] md:h-[440px] md:w-[440px]" />

            <Image
              src="/images/phone login.png"
              alt="Resina mobile screens"
              width={420}
              height={620}
              className="absolute left-1/2 top-[45%] w-[min(76%,390px)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_22px_34px_rgba(0,0,0,0.24)] md:left-[58%] md:top-[47%] md:w-[min(80%,420px)]"
              priority
            />
          </div>
        </section>

        <footer className="mt-6 border-t border-[#e8ecee] bg-[#f0f2f4] px-5 py-10 md:px-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.1fr_1fr_1fr]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-4">
                <Image src="/images/resina%20logo.png" alt="Resina logo" width={76} height={76} />
                <span className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[#334155]">
                  RESINA
                </span>
              </div>
              <p className="mt-1 text-sm text-[#6b7280]">Brgy. Sta. Rita, Olongapo City</p>
            </div>

            <div>
              <h2 className="mb-3 text-xl font-semibold text-[#111827]">Link</h2>
              <ul className="space-y-2 text-base text-[#4b5563]">
                <li>
                  <a href="/admin" className="hover:text-[#0d3d73]">
                    Admin Portal
                  </a>
                </li>
                <li>
                  <a href={apkDownloadUrl} target="_blank" rel="noreferrer" className="hover:text-[#0d3d73]">
                    Download RESINA
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-xl font-semibold text-[#111827]">Company</h2>
              <ul className="space-y-2 text-base text-[#4b5563]">
                <li>
                  <a href="#about" className="hover:text-[#0d3d73]">
                    About
                  </a>
                </li>
                <li>
                  <a href="#join" className="hover:text-[#0d3d73]">
                    Join us
                  </a>
                </li>
              </ul>

              <div className="mt-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                <a className="rounded-full bg-white px-2.5 py-1.5 shadow-sm hover:text-[#0d3d73]" href="#">
                  Tw
                </a>
                <a className="rounded-full bg-white px-2.5 py-1.5 shadow-sm hover:text-[#0d3d73]" href="#">
                  Fb
                </a>
                <a className="rounded-full bg-white px-2.5 py-1.5 shadow-sm hover:text-[#0d3d73]" href="#">
                  In
                </a>
                <a className="rounded-full bg-white px-2.5 py-1.5 shadow-sm hover:text-[#0d3d73]" href="#">
                  Yt
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
