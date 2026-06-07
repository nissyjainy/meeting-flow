const MEET_API_BASE = "https://meet.googleapis.com/v2";

export type MeetConferenceRecord = {
  name: string;
  startTime?: string;
  endTime?: string;
};

export type MeetTranscriptState = "STATE_UNSPECIFIED" | "STARTED" | "ENDED" | "FILE_GENERATED";

export type MeetTranscriptResource = {
  name: string;
  state?: MeetTranscriptState;
  startTime?: string;
  endTime?: string;
};

export type MeetTranscriptEntryResource = {
  name?: string;
  participant?: string;
  text?: string;
  languageCode?: string;
  startTime?: string;
  endTime?: string;
};

type ListResponse<TKey extends string, TItem> = {
  nextPageToken?: string;
} & Record<TKey, TItem[] | undefined>;

function conferenceRecordIdFromName(name: string): string {
  const prefix = "conferenceRecords/";
  if (name.startsWith(prefix)) {
    return name.slice(prefix.length);
  }
  return name;
}

export function buildConferenceRecordsFilter(input: {
  meetingCode: string;
  startsAt: string;
  endsAt: string;
  bufferMinutes?: number;
}): string {
  const bufferMs = (input.bufferMinutes ?? 15) * 60 * 1000;
  const startMs = new Date(input.startsAt).getTime();
  const endMs = new Date(input.endsAt).getTime();

  const timeMin = new Date(startMs - bufferMs).toISOString();
  const timeMax = new Date(endMs + bufferMs).toISOString();

  return [
    `space.meeting_code = "${input.meetingCode}"`,
    `start_time >= "${timeMin}"`,
    `start_time <= "${timeMax}"`,
  ].join(" AND ");
}

async function meetApiGet<T>(accessToken: string, path: string, query?: URLSearchParams): Promise<T> {
  const url = query?.size
    ? `${MEET_API_BASE}${path}?${query.toString()}`
    : `${MEET_API_BASE}${path}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Google Meet API failed (${response.status}): ${text}`), {
      status: response.status,
    });
  }

  return (await response.json()) as T;
}

async function meetApiGetAllPages<TItem>(
  accessToken: string,
  buildPath: (pageToken?: string) => { path: string; query: URLSearchParams },
  extract: (payload: Record<string, unknown>) => {
    items: TItem[];
    nextPageToken?: string;
  },
): Promise<TItem[]> {
  const items: TItem[] = [];
  let pageToken: string | undefined;

  do {
    const { path, query } = buildPath(pageToken);
    const payload = (await meetApiGet<Record<string, unknown>>(accessToken, path, query)) as Record<
      string,
      unknown
    >;
    const page = extract(payload);
    items.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return items;
}

export async function listConferenceRecords(
  accessToken: string,
  filter: string,
): Promise<MeetConferenceRecord[]> {
  return meetApiGetAllPages<MeetConferenceRecord>(
    accessToken,
    (pageToken) => {
      const query = new URLSearchParams({ filter, pageSize: "25" });
      if (pageToken) query.set("pageToken", pageToken);
      return { path: "/conferenceRecords", query };
    },
    (payload) => ({
      items: (payload.conferenceRecords as MeetConferenceRecord[] | undefined) ?? [],
      nextPageToken: payload.nextPageToken as string | undefined,
    }),
  );
}

export function pickBestConferenceRecord(
  records: MeetConferenceRecord[],
  startsAt: string,
  endsAt: string,
): MeetConferenceRecord | null {
  if (records.length === 0) return null;
  if (records.length === 1) return records[0] ?? null;

  const targetStart = new Date(startsAt).getTime();
  const targetEnd = new Date(endsAt).getTime();

  let best: MeetConferenceRecord | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const record of records) {
    const recordStart = record.startTime ? new Date(record.startTime).getTime() : Number.NaN;
    const recordEnd = record.endTime ? new Date(record.endTime).getTime() : Number.NaN;
    if (Number.isNaN(recordStart)) continue;

    const overlapStart = Math.max(recordStart, targetStart);
    const overlapEnd = Math.min(
      Number.isNaN(recordEnd) ? targetEnd : recordEnd,
      targetEnd,
    );
    const overlap = Math.max(0, overlapEnd - overlapStart);
    const startDelta = Math.abs(recordStart - targetStart);
    const score = overlap - startDelta;

    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }

  return best ?? records[0] ?? null;
}

export async function listTranscripts(
  accessToken: string,
  conferenceRecordName: string,
): Promise<MeetTranscriptResource[]> {
  const conferenceRecordId = conferenceRecordIdFromName(conferenceRecordName);

  return meetApiGetAllPages<MeetTranscriptResource>(
    accessToken,
    (pageToken) => {
      const query = new URLSearchParams({ pageSize: "25" });
      if (pageToken) query.set("pageToken", pageToken);
      return {
        path: `/conferenceRecords/${encodeURIComponent(conferenceRecordId)}/transcripts`,
        query,
      };
    },
    (payload) => ({
      items: (payload.transcripts as MeetTranscriptResource[] | undefined) ?? [],
      nextPageToken: payload.nextPageToken as string | undefined,
    }),
  );
}

export function pickReadyTranscript(
  transcripts: MeetTranscriptResource[],
): MeetTranscriptResource | null {
  const generated = transcripts.filter((item) => item.state === "FILE_GENERATED");
  if (generated.length > 0) {
    return generated[generated.length - 1] ?? null;
  }

  const ended = transcripts.filter((item) => item.state === "ENDED");
  if (ended.length > 0) {
    return ended[ended.length - 1] ?? null;
  }

  return transcripts[transcripts.length - 1] ?? null;
}

export async function listTranscriptEntries(
  accessToken: string,
  transcriptName: string,
): Promise<MeetTranscriptEntryResource[]> {
  const path = `/${transcriptName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}/entries`;

  return meetApiGetAllPages<MeetTranscriptEntryResource>(
    accessToken,
    (pageToken) => {
      const query = new URLSearchParams({ pageSize: "100" });
      if (pageToken) query.set("pageToken", pageToken);
      return { path, query };
    },
    (payload) => ({
      items: (payload.transcriptEntries as MeetTranscriptEntryResource[] | undefined) ?? [],
      nextPageToken: payload.nextPageToken as string | undefined,
    }),
  );
}

export { conferenceRecordIdFromName };
