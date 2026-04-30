import Image from "next/image";

const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "/admin";
const mobileAppUrl = process.env.NEXT_PUBLIC_MOBILE_APP_URL ?? "#";
const apkDownloadUrl = process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL ?? "#";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[#f3f5f5] text-[#0f2744]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5 md:px-10 md:py-5">
          <a className="flex items-center gap-3" href="#">
            <Image src="/images/resina%20logo.png" alt="Resina logo" width={48} height={48} priority className="sm:h-14 sm:w-14" />
            <span className="font-[family-name:var(--font-display)] text-2xl leading-none sm:text-[30px]">RESINA</span>
          </a>

          {/* Removed About / Download / Features links from landing navbar */}

          <a
            href={apkDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-xl bg-[#46ad55] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#3a9749] sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Download APK
          </a>
        </header>

        <section className="grid flex-1 grid-cols-1 items-center gap-8 px-4 py-5 sm:px-5 md:grid-cols-2 md:gap-12 md:px-10 md:py-8">
          <div className="max-w-[560px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c5e8ce] bg-[#edf7ef] px-4 py-1.5 text-sm font-medium text-[#2e7d47]">
              <span className="h-2 w-2 rounded-full bg-[#2e9d5a]" />
              Brgy. Sta. Rita, Olongapo City
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-wide text-[#0d3d73] sm:text-5xl md:text-6xl">
              RESINA
            </h1>
            <p className="mt-3 text-2xl font-semibold leading-tight text-[#0d3d73] sm:text-3xl md:text-[42px]">
              Real-time Water Level Sensor IoT Network for Adaptive Flood Alerts
            </p>
            <p className="mt-6 max-w-[520px] text-base leading-7 text-[#5e6872] sm:mt-8 sm:text-lg md:text-xl">
              RESINA deploys IoT flood sensors along critical waterways in Barangay Sta. Rita,
              Olongapo City — monitoring water levels in real time to keep residents and
              barangay officials informed before flooding occurs.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <a
                href={webAppUrl}
                className="w-full rounded-lg bg-[#49af57] px-7 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-[#3f9a4d] sm:w-auto"
              >
                Get started today
              </a>
              <a
                href={apkDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-lg border border-[#49af57] bg-white px-7 py-3 text-center text-base font-semibold text-[#2f8e41] transition-colors hover:bg-[#eff9f1] sm:w-auto"
              >
                Download APK
              </a>
            </div>
          </div>

          <div className="relative mx-auto h-[360px] w-full max-w-[520px] sm:h-[420px] md:h-[560px]">
            <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e4ebe4] sm:h-[350px] sm:w-[350px] md:h-[440px] md:w-[440px]" />

            <Image
              src="/images/phone login.png"
              alt="Resina mobile screens"
              width={420}
              height={620}
              className="absolute left-1/2 top-1/2 w-[min(78%,320px)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_22px_34px_rgba(0,0,0,0.24)] sm:w-[min(78%,360px)] md:w-[min(80%,420px)]"
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


          </div>
        </footer>
      </div>
    </main>
  );
}
