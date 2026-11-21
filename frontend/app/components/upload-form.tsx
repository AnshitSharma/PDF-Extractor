"use client";

import { useState, type FormEvent } from "react";
import { uploadReport, type Report } from "../api";

interface Props {
  onUploaded: (report: Report) => void;
}

export default function UploadForm({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const report = await uploadReport(data);
      onUploaded(report);
      setNotice(
        `Saved report ${report.reportCode} with ${report.parameters.length} test results.`,
      );
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h5 card-title">Upload a lab report</h1>
        <p className="text-muted small">
          PDF only, up to 10 MB. Scanned reports take a few seconds longer.
        </p>
        <form onSubmit={handleSubmit} className="d-flex gap-2">
          <input
            type="file"
            name="file"
            aria-label="Lab report PDF"
            accept="application/pdf,.pdf"
            required
            className="form-control"
          />
          <button
            type="submit"
            className="btn btn-primary text-nowrap"
            disabled={uploading}
          >
            {uploading ? "Reading PDF..." : "Upload"}
          </button>
        </form>
        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
        {notice && (
          <div className="alert alert-success mt-3 mb-0">{notice}</div>
        )}
      </div>
    </div>
  );
}
