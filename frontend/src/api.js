async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* not JSON */ }
    throw new Error(msg);
  }
  return res;
}

export const getInfo = async () => (await request("/api/info")).json();
export const getSampleJd = async () => (await request("/api/sample-jd")).text();

export async function createJob({ text, file }) {
  const fd = new FormData();
  if (text) fd.append("text", text);
  if (file) fd.append("file", file);
  return (await request("/api/jobs", { method: "POST", body: fd })).json();
}

export async function uploadResumes(jobId, files) {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return (await request(`/api/jobs/${jobId}/resumes`, { method: "POST", body: fd })).json();
}

export const getCandidate = async (jobId, id) =>
  (await request(`/api/jobs/${jobId}/candidates/${id}`)).json();

export async function updateCandidate(jobId, id, data) {
  return (
    await request(`/api/jobs/${jobId}/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  ).json();
}

export const clearCandidates = async (jobId) =>
  (await request(`/api/jobs/${jobId}/candidates`, { method: "DELETE" })).json();

export const exportUrl = (jobId) => `/api/jobs/${jobId}/export.csv`;
export const candidateReportUrl = (jobId, id) => `/api/jobs/${jobId}/candidates/${id}/report.html`;
