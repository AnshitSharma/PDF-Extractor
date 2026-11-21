import type { Report } from "../api";

export default function ReportTable({ report }: { report: Report }) {
  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between flex-wrap gap-2">
        <span>
          <strong>{report.reportCode}</strong>
          <span className="text-muted ms-2">{report.fileName}</span>
        </span>
        <span className="text-muted small">
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="table-responsive">
        <table className="table table-striped align-middle mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Test</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference range</th>
            </tr>
          </thead>
          <tbody>
            {report.parameters.map((parameter) => (
              <tr key={parameter.id}>
                <td className="text-muted">{parameter.position}</td>
                <td>{parameter.name}</td>
                <td>{parameter.value ?? "-"}</td>
                <td>{parameter.unit ?? "-"}</td>
                <td>{parameter.referenceRange ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
