import { AxiosError } from 'axios';
import { apiClient } from '@/shared/api/client';
import { ApiError, TRANSPORT_ERROR_CODE, type ApiEnvelope } from '@/shared/api/types';
import { staticText } from '@/locales/staticText';

/**
 * 파일을 받아 온다 — <b>봉투가 아니라 바이트다</b>(playbook/excel-download.md 의 세 번째 갈래).
 *
 * <p>{@code request()} 를 쓸 수 없다. 그쪽은 응답을 {@code ApiEnvelope} 로 읽어 알맹이를
 * 꺼내는데(backend/api.md), 파일 응답에는 벗길 봉투가 없다 — 통째로 파일이다.
 *
 * <h2>실패하면 <b>그때는 봉투가 온다</b></h2>
 *
 * <p>여기가 이 파일의 존재 이유다. {@code responseType: 'blob'} 이면 <b>실패 응답의 body
 * 도 Blob</b> 이라 {@code error.response.data.message} 가 언제나 {@code undefined} 다 —
 * 그대로 두면 서버가 보낸 <i>"조회 조건을 좁혀 주세요"</i> 가 사라지고 화면에는 <b>네트워크
 * 오류</b>만 뜬다. 실제 원인이 4xx 인데 사용자는 <i>서버가 죽었나</i> 를 의심하게 된다.
 *
 * <p>그래서 Blob 을 <b>글자로 되읽어</b> 봉투를 복원한다. 성공 응답이 JSON 으로 올 때도
 * 같은 길로 보낸다 — 파일 엔드포인트가 200 과 함께 봉투를 내는 것은 <b>서버 쪽 실수</b>이며,
 * 그것을 {@code .xlsx} 라 부르며 저장하면 사용자는 <b>열리지 않는 파일</b>을 얻는다.
 */
export interface DownloadedFile {
  blob: Blob;
  /**
   * 서버가 정한 이름 — {@code Content-Disposition}. 없으면 {@code null} 이고 부르는 쪽이
   * 자기 규칙으로 짓는다.
   */
  fileName: string | null;
}

export async function postDownload(url: string, body?: unknown): Promise<DownloadedFile> {
  try {
    const response = await apiClient.request<Blob>({
      url,
      method: 'POST',
      data: body,
      responseType: 'blob',
    });

    // 200 인데 봉투다 — 서버 쪽 실수를 파일로 저장하지 않는다(위).
    if (isEnvelope(response.data)) {
      throw await envelopeError(response.data, response.status);
    }
    return {
      blob: response.data,
      fileName: fileNameOf(response.headers['content-disposition']),
    };
  } catch (error) {
    throw await normalize(error);
  }
}

/** 서버가 실제로 무엇을 말했는지 — Blob 을 글자로 되읽는다(위). */
async function normalize(error: unknown): Promise<ApiError> {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const data: unknown = error.response?.data;
    const status = error.response?.status ?? 0;

    if (data instanceof Blob) {
      const envelope = await parseEnvelope(data);
      if (envelope) return toApiError(envelope, status);
    }
    return new ApiError({
      code: TRANSPORT_ERROR_CODE,
      message: staticText('net.unreachable'),
      status,
    });
  }

  return new ApiError({
    code: TRANSPORT_ERROR_CODE,
    message: error instanceof Error ? error.message : staticText('net.unknown'),
    status: 0,
  });
}

function isEnvelope(data: unknown): data is Blob {
  return data instanceof Blob && data.type.includes('json');
}

async function envelopeError(blob: Blob, status: number): Promise<ApiError> {
  const envelope = await parseEnvelope(blob);
  return envelope
    ? toApiError(envelope, status)
    : new ApiError({ code: TRANSPORT_ERROR_CODE, message: staticText('net.failed'), status });
}

async function parseEnvelope(blob: Blob): Promise<ApiEnvelope<unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await blob.text());
    return typeof parsed === 'object' && parsed !== null && 'success' in parsed
      ? (parsed as ApiEnvelope<unknown>)
      : null;
  } catch {
    // 봉투가 아니다 — 프록시의 HTML 이거나 잘린 응답이다.
    return null;
  }
}

function toApiError(envelope: ApiEnvelope<unknown>, status: number): ApiError {
  return new ApiError({
    // 문구는 서버가 완성한다 — 프론트에 에러 카탈로그를 두지 않는다(backend/packages.md).
    code: envelope.code ?? TRANSPORT_ERROR_CODE,
    message: envelope.message ?? staticText('net.failed'),
    status,
    traceId: envelope.traceId,
    fields: envelope.fields,
  });
}

/**
 * {@code Content-Disposition} 에서 파일 이름을 꺼낸다.
 *
 * <p><b>{@code filename*} 을 먼저 본다</b>(RFC 5987). 한글 이름은 그쪽에만 온전히 실리며,
 * 옛 {@code filename=} 은 ASCII 로 뭉개진 <i>대체 이름</i>이라 <b>둘 다 있을 때 뒤를 고르면
 * 이름이 깨진다</b>.
 */
function fileNameOf(header: unknown): string | null {
  if (typeof header !== 'string') return null;

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // 서버가 인코딩을 틀렸다 — 아래의 평범한 쪽으로 떨어진다.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}
