import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";

export const metadata: Metadata = {
  title: "PDF Extractor",
  description: "Upload a lab report PDF and see its test results as a table",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-light">
        <nav className="navbar navbar-dark bg-dark mb-4">
          <div className="container">
            <span className="navbar-brand">PDF Extractor</span>
          </div>
        </nav>
        <main className="container pb-5">{children}</main>
      </body>
    </html>
  );
}
