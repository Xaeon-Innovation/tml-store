// Emails the store owner when a new order or custom request arrives.
// Triggered by a Supabase Database Webhook (see README → "Order emails").
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   from resend.com (free plan)
//   OWNER_EMAIL      where notifications go
//   WEBHOOK_SECRET   any long random text; the same value goes in the webhook's header
//   STORE_NAME       optional, e.g. "TML Store"
//   DASHBOARD_URL    optional, e.g. "https://yourshop.com/admin/"
//   CURRENCY         optional, default "EGP"
//   FROM_EMAIL       optional, e.g. "TML Store <orders@yourshop.com>" (needs a verified domain in Resend)

const money = (n: number) => (Deno.env.get('CURRENCY') || 'EGP') + ' ' + Number(n || 0).toLocaleString('en-US');
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || body.type !== 'INSERT' || !body.record) return new Response('Ignored', { status: 200 });

  const store = Deno.env.get('STORE_NAME') || 'Your store';
  const dash = Deno.env.get('DASHBOARD_URL') || '';
  const r = body.record;
  let subject: string, html: string;

  if (body.table === 'orders') {
    const custom = (r.items || []).some((it: any) => it.custom);
    const items = (r.items || []).map((it: any) =>
      `<tr><td style="padding:4px 12px 4px 0">${esc(it.name)} × ${esc(it.qty)}<br><small style="color:#666">${esc(it.size_label)} ${esc(it.size_total)}</small></td><td style="padding:4px 0;text-align:right">${it.custom ? '<b style="color:#7A4600">Needs price</b>' : money(it.line_total)}</td></tr>`).join('');
    subject = `New order ${r.ref} — ${money(r.subtotal)}${custom ? ' + custom size' : ''}`;
    html = `<h2 style="margin:0 0 12px">New order ${esc(r.ref)}</h2>
      <p><b>${esc(r.customer_name)}</b><br>${esc(r.phone)}${r.email ? '<br>' + esc(r.email) : ''}<br>${esc(r.region)} — ${esc(r.address)}</p>
      ${r.notes ? `<p><i>${esc(r.notes)}</i></p>` : ''}
      <table style="border-collapse:collapse;min-width:280px">${items}
      <tr><td style="padding:8px 12px 0 0;border-top:1px solid #ddd"><b>Subtotal</b></td><td style="padding:8px 0 0;border-top:1px solid #ddd;text-align:right"><b>${money(r.subtotal)}</b></td></tr></table>
      <p style="color:#666">Cash on delivery. Call the customer to confirm the order and delivery fee.${custom ? ' Agree the price of the custom size, then enter it on the order in the dashboard.' : ''}</p>`;
  } else if (body.table === 'custom_requests') {
    subject = `New custom request ${r.ref} — ${r.name}`;
    html = `<h2 style="margin:0 0 12px">New custom request ${esc(r.ref)}</h2>
      <p><b>${esc(r.name)}</b><br>${esc(r.phone)}${r.email ? '<br>' + esc(r.email) : ''}<br>${esc(r.region)}</p>
      <p>Arrangement: ${esc(r.layout)}<br>Size: ${esc(r.size || 'not given')}<br>Images: ${(r.image_paths || []).length}</p>
      <p style="white-space:pre-line;background:#f6f6f4;padding:12px;border-radius:6px">${esc(r.description)}</p>`;
  } else {
    return new Response('Ignored', { status: 200 });
  }
  if (dash) html += `<p><a href="${esc(dash)}">Open the dashboard</a></p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL') || `${store} <onboarding@resend.dev>`,
      to: [Deno.env.get('OWNER_EMAIL')],
      subject: `[${store}] ${subject}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#18181b">${html}</div>`,
    }),
  });
  if (!res.ok) {
    console.error('Email failed', res.status, await res.text());
    return new Response('Email failed', { status: 502 });
  }
  return new Response('Sent', { status: 200 });
});
