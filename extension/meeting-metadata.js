/** Append capture metadata fields for extension upload FormData. */

function appendCaptureMetadata(formData, meta) {
  if (!formData || !meta) return;

  const meetUrl = meta.meetUrl?.trim();
  const tabTitle = (meta.tabTitle ?? meta.title ?? meta.meetTitle)?.trim();
  const platform = meta.platform?.trim();
  const meetingCode = (meta.meetCode ?? meta.meetingCode)?.trim();

  if (meetUrl) formData.append("meetUrl", meetUrl);
  if (tabTitle) {
    formData.append("tabTitle", tabTitle);
    formData.append("meetTitle", tabTitle);
  }
  if (platform) formData.append("platform", platform);
  if (meetingCode) formData.append("meetingCode", meetingCode);
}
