import { NextRequest, NextResponse } from 'next/server';

const TARGETS: Record<string, string> = {
  emu: `http://${process.env.NEXT_PUBLIC_EMU_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_EMU_PORT ?? '8008'}`,
  'ras-emu': `http://${process.env.NEXT_PUBLIC_RAS_EMU_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_RAS_EMU_PORT ?? '8009'}`,
};

const FORWARD_REQUEST_HEADERS = ['authorization', 'x-auth-token', 'content-type'];
const FORWARD_RESPONSE_HEADERS = ['content-type', 'x-auth-token', 'location', 'odata-version'];

async function handler(request: NextRequest, { params }: { params: { path: string[] } }) {
  const [server, ...rest] = params.path;
  const base = TARGETS[server];
  if (!base) return NextResponse.json({ error: 'Unknown server' }, { status: 404 });

  const upstreamPath = '/' + rest.join('/');
  const upstreamUrl = base + upstreamPath + (request.nextUrl.search ?? '');

  const reqHeaders = new Headers();
  for (const key of FORWARD_REQUEST_HEADERS) {
    const val = request.headers.get(key);
    if (val) reqHeaders.set(key, val);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'DELETE';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: reqHeaders,
    body,
  });

  // SSE: stream the response body
  if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
    const resHeaders = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
  }

  const resHeaders = new Headers();
  for (const key of FORWARD_RESPONSE_HEADERS) {
    const val = upstream.headers.get(key);
    if (val) resHeaders.set(key, val);
  }

  const resBody = upstream.status === 204 ? null : await upstream.arrayBuffer();
  return new NextResponse(resBody, { status: upstream.status, headers: resHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
