"use client";

import { useEffect, useState } from "react";
import { getReports, type Report } from "./api";
import ReportTable from "./components/report-table";
import UploadForm from "./components/upload-form";

export default function Home() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReports()
      .then(setReports)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <UploadForm
        onUploaded={(report) => setReports((current) => [report, ...current])}
      />

      <h2 className="h5 mb-3">Uploaded reports</h2>
      {loading && <p className="text-muted">Loading reports...</p>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && reports.length === 0 && (
        <p className="text-muted">
          No reports yet. Upload a PDF to see its results here.
        </p>
      )}
      {reports.map((report) => (
        <ReportTable key={report.id} report={report} />
      ))}
    </>
  );
}
