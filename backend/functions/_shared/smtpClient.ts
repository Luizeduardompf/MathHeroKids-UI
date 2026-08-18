// Cliente SMTP mínimo para Deno — envia email via relay do iCloud (smtp.mail.me.com:587,
// STARTTLS) sem depender de um provedor terceiro. Implementa só o subconjunto necessário
// (EHLO, STARTTLS, AUTH LOGIN, MAIL FROM/RCPT TO/DATA) — não é um cliente SMTP genérico.
// Portado de Luka/Luka/supabase/functions/_shared/smtpClient.ts, genericizado (o domínio do
// EHLO/Message-ID passa a ser derivado do endereço `from`, em vez de "menescalio.com" fixo).
//
// Por quê um cliente próprio em vez de nodemailer: nodemailer é uma lib Node (usa os módulos
// internos net/tls do Node) e não roda de forma confiável no runtime Deno das Supabase Edge
// Functions. Deno.connect + Deno.startTls dão exactamente o que STARTTLS precisa (upgrade de
// uma conexão TCP em texto puro para TLS no meio da sessão).

export interface SendIcloudMailOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  /** Precisa ser igual a `user` ou um alias configurado nessa mesma conta — restrição do iCloud/Apple. */
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
}

interface SmtpReply {
  code: number;
  lines: string[];
}

function toCrlf(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function encodeHeaderValue(value: string): string {
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${base64EncodeUtf8(value)}?=`;
}

function ehloDomain(from: string): string {
  return from.split('@')[1] ?? 'localhost';
}

async function readLine(conn: Deno.Conn, state: { buf: string }): Promise<string> {
  const decoder = new TextDecoder();
  const chunk = new Uint8Array(4096);
  while (true) {
    const idx = state.buf.indexOf('\r\n');
    if (idx !== -1) {
      const line = state.buf.slice(0, idx);
      state.buf = state.buf.slice(idx + 2);
      return line;
    }
    const n = await conn.read(chunk);
    if (n === null) throw new Error('SMTP: conexão fechada inesperadamente enquanto esperava resposta');
    state.buf += decoder.decode(chunk.subarray(0, n), { stream: true });
  }
}

async function readReply(conn: Deno.Conn, state: { buf: string }): Promise<SmtpReply> {
  const lines: string[] = [];
  let code = 0;
  while (true) {
    const line = await readLine(conn, state);
    lines.push(line);
    code = parseInt(line.slice(0, 3), 10);
    if (line.charAt(3) !== '-') break; // linha final do bloco: 4º caractere é espaço, não hífen
  }
  return { code, lines };
}

async function sendLine(conn: Deno.Conn, text: string): Promise<void> {
  await conn.write(new TextEncoder().encode(text + '\r\n'));
}

function expectCode(reply: SmtpReply, expected: number[], step: string): void {
  if (!expected.includes(reply.code)) {
    throw new Error(`SMTP falhou em ${step}: ${reply.lines.join(' | ')}`);
  }
}

/** Envia um email via relay SMTP do iCloud. Lança erro em qualquer falha — quem chama decide se loga ou propaga. */
export async function sendIcloudMail(opts: SendIcloudMailOptions): Promise<void> {
  const state = { buf: '' };
  const domain = ehloDomain(opts.from);
  let conn: Deno.Conn = await Deno.connect({ hostname: opts.host, port: opts.port });
  try {
    expectCode(await readReply(conn, state), [220], 'greeting');

    await sendLine(conn, `EHLO ${domain}`);
    expectCode(await readReply(conn, state), [250], 'EHLO');

    await sendLine(conn, 'STARTTLS');
    expectCode(await readReply(conn, state), [220], 'STARTTLS');

    conn = await Deno.startTls(conn, { hostname: opts.host });
    state.buf = '';

    await sendLine(conn, `EHLO ${domain}`);
    expectCode(await readReply(conn, state), [250], 'EHLO (TLS)');

    await sendLine(conn, 'AUTH LOGIN');
    expectCode(await readReply(conn, state), [334], 'AUTH LOGIN');

    await sendLine(conn, base64EncodeUtf8(opts.user));
    expectCode(await readReply(conn, state), [334], 'AUTH LOGIN (usuário)');

    await sendLine(conn, base64EncodeUtf8(opts.password));
    expectCode(await readReply(conn, state), [235], 'AUTH LOGIN (senha)');

    await sendLine(conn, `MAIL FROM:<${opts.from}>`);
    expectCode(await readReply(conn, state), [250], 'MAIL FROM');

    await sendLine(conn, `RCPT TO:<${opts.to}>`);
    expectCode(await readReply(conn, state), [250, 251], 'RCPT TO');

    await sendLine(conn, 'DATA');
    expectCode(await readReply(conn, state), [354], 'DATA');

    const fromHeader = opts.fromName
      ? `${encodeHeaderValue(opts.fromName)} <${opts.from}>`
      : opts.from;
    const body = toCrlf(opts.text).replace(/^\./gm, '..'); // dot-stuffing (RFC 5321 §4.5.2)
    const message =
      `From: ${fromHeader}\r\n` +
      `To: ${opts.to}\r\n` +
      `Subject: ${encodeHeaderValue(opts.subject)}\r\n` +
      `Date: ${new Date().toUTCString()}\r\n` +
      `Message-ID: <${crypto.randomUUID()}@${domain}>\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `\r\n${body}\r\n.`;
    await sendLine(conn, message);
    expectCode(await readReply(conn, state), [250], 'DATA (corpo)');

    await sendLine(conn, 'QUIT');
  } finally {
    try { conn.close(); } catch { /* conexão já pode estar fechada */ }
  }
}
