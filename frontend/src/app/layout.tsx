import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import Gate from "@/components/Gate";

const noto = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: "moire — 나의 작은 옷장",
  description: "내 옷을 데이터화하고 날씨·기분에 맞는 코디를 캐릭터에 입혀보는 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={noto.variable}>
      <body className="min-h-screen">
        <StoreProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            <Gate>{children}</Gate>
          </main>
          <Toast />
        </StoreProvider>
      </body>
    </html>
  );
}
