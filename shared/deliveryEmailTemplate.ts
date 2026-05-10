export interface DeliveryEmailField {
  label: string;
  value: string;
}

export interface DeliveryEmailItemSummary {
  title: string;
  quantity: number;
  totalLabel: string;
}

export type DeliveryEmailItem =
  | {
      kind: "account";
      title: string;
      fields: DeliveryEmailField[];
      notes?: string | null;
    }
  | {
      kind: "key";
      title: string;
      value: string;
      notes?: string | null;
    }
  | {
      kind: "out_of_stock";
      title: string;
      notes?: string | null;
    };

export interface DeliveryEmailTemplateData {
  storeName: string;
  logoUrl?: string | null;
  orderCode: string;
  createdAtLabel: string;
  paymentMethodLabel: string;
  totalLabel: string;
  customerName?: string | null;
  itemsSummary: DeliveryEmailItemSummary[];
  deliveredItems: DeliveryEmailItem[];
}

export const buildDeliveryEmailHtml = (data: DeliveryEmailTemplateData) => {
  const customerName = data.customerName?.trim();
  const introName = customerName ? ` ${escapeHtml(customerName)}` : "";
  const logoHtml = data.logoUrl
    ? `<img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.storeName)}" style="display:block;max-width:190px;height:auto;border:0;" />`
    : `<div style="font-size:14px;line-height:1.2;text-transform:uppercase;letter-spacing:2px;color:#33d6ff;font-weight:800;">${escapeHtml(data.storeName)}</div>`;

  const itemsSummaryHtml = data.itemsSummary
    .map((item) => `
      <tr>
        <td style="padding:16px 0;color:#d8d3ea;font-size:15px;line-height:1.5;border-top:1px solid #2a2940;">${escapeHtml(`${item.quantity}x ${item.title}`)}</td>
        <td style="padding:16px 0;color:#f4efff;font-size:15px;line-height:1.5;border-top:1px solid #2a2940;text-align:right;white-space:nowrap;">${escapeHtml(item.totalLabel)}</td>
      </tr>`)
    .join("");

  const deliveredItemsHtml = data.deliveredItems
    .map((item) => {
      if (item.kind === "out_of_stock") {
        return `
          <li style="list-style:none;margin:0 0 18px;padding:18px;background:#13121d;border:1px solid #2a2940;border-radius:20px;">
            <div style="font-size:20px;line-height:1.3;color:#f6f3ff;font-weight:700;">${escapeHtml(item.title)}</div>
            <div style="margin-top:14px;background:#1c1223;border:1px solid #4d1c48;border-radius:16px;padding:16px;color:#f7b3e4;font-size:15px;line-height:1.6;">${escapeHtml(item.notes || "Sin stock disponible por el momento. Te contactamos en breve para resolverlo.")}</div>
          </li>`;
      }

      const notesHtml = item.notes
        ? `<div style="margin-top:10px;font-size:13px;line-height:1.5;color:#b8b0cf;">${escapeHtml(item.notes)}</div>`
        : "";

      if (item.kind === "key") {
        return `
          <li style="list-style:none;margin:0 0 18px;padding:18px;background:#13121d;border:1px solid #2a2940;border-radius:20px;">
            <div style="font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">${escapeHtml(item.title)}</div>
            <div style="margin-top:14px;background:#1b1324;border:1px solid #a2146f;border-radius:18px;padding:18px;">
              <div style="font-size:12px;line-height:1.2;text-transform:uppercase;letter-spacing:1.5px;color:#33d6ff;font-weight:800;margin-bottom:10px;">Key</div>
              <div style="font-size:18px;line-height:1.4;color:#f7f3ff;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;word-break:break-word;">${escapeHtml(item.value)}</div>
            </div>
            ${notesHtml}
          </li>`;
      }

      const fieldsHtml = item.fields
        .map((field) => `
          <div style="display:inline-block;vertical-align:top;width:calc(50% - 8px);min-width:220px;margin:0 8px 12px 0;background:#171320;border:1px solid #2f2842;border-radius:12px;padding:14px;box-sizing:border-box;">
            <div style="font-size:11px;line-height:1.2;text-transform:uppercase;letter-spacing:1px;color:#8f87b3;margin-bottom:8px;font-weight:700;">${escapeHtml(field.label)}</div>
            <div style="font-size:17px;line-height:1.4;color:#f7f3ff;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;word-break:break-word;">${escapeHtml(field.value)}</div>
          </div>`)
        .join("");

      return `
        <li style="list-style:none;margin:0 0 18px;padding:18px;background:#13121d;border:1px solid #2a2940;border-radius:20px;">
          <div style="font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">${escapeHtml(item.title)}</div>
          <div style="margin-top:14px;background:#1b1324;border:1px solid #a2146f;border-radius:18px;padding:18px;">
            <div style="font-size:12px;line-height:1.2;text-transform:uppercase;letter-spacing:1.5px;color:#33d6ff;font-weight:800;margin-bottom:14px;">Cuenta</div>
            <div style="font-size:0;line-height:0;">${fieldsHtml}</div>
          </div>
          ${notesHtml}
        </li>`;
    })
    .join("");

  return `
<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#0a0912;font-family:Arial,sans-serif;color:#fff;">
<div style="max-width:760px;margin:0 auto;background:#10101a;border:1px solid #2a2940;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,0.35);">
  <div style="padding:24px 26px;border-bottom:1px solid #2a2940;background:linear-gradient(180deg,#151424 0%,#10101a 100%);">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          ${logoHtml}
          <div style="margin-top:16px;font-size:15px;line-height:1.2;color:#f5f2ff;font-weight:800;letter-spacing:0.5px;">${escapeHtml(data.orderCode)}</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.6;color:#9d96b7;">${escapeHtml(data.createdAtLabel)} · ${escapeHtml(data.paymentMethodLabel)}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="display:inline-block;padding:9px 14px;border-radius:10px;background:#34172f;border:1px solid #b41c7a;color:#ff62cb;font-size:13px;line-height:1.2;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Entregado ✨</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="padding:26px;">
    <div style="background:#13121d;border:1px solid #2a2940;border-radius:20px;padding:22px 22px 18px;margin:0 0 22px;">
      <div style="font-size:12px;line-height:1.2;text-transform:uppercase;letter-spacing:1.5px;color:#8f87b3;margin-bottom:12px;">Resumen del pedido</div>
      <div style="font-size:16px;line-height:1.8;color:#f7f3ff;">
        <div><span style="color:#8f87b3;">Codigo:</span> ${escapeHtml(data.orderCode)}</div>
        <div><span style="color:#8f87b3;">Fecha:</span> ${escapeHtml(data.createdAtLabel)}</div>
        <div><span style="color:#8f87b3;">Pago:</span> ${escapeHtml(data.paymentMethodLabel)}</div>
        <div><span style="color:#8f87b3;">Total:</span> ${escapeHtml(data.totalLabel)}</div>
      </div>
    </div>
    <div style="background:#13121d;border:1px solid #2a2940;border-radius:20px;padding:20px 22px;margin:0 0 22px;">
      <div style="font-size:15px;line-height:1.4;color:#2bdd7f;font-weight:800;">✓ Pago verificado</div>
      <div style="margin-top:8px;color:#b2abc8;font-size:15px;line-height:1.7;">Hola${introName}, ya asignamos los datos de tu compra y los dejamos mas abajo para que los tengas a mano.</div>
    </div>
    <div style="background:#13121d;border:1px solid #2a2940;border-radius:20px;padding:8px 22px;margin:0 0 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${itemsSummaryHtml}
      </table>
    </div>
    <div style="font-size:24px;line-height:1.2;color:#ff4ecb;font-weight:800;margin:0 0 14px;">Tus credenciales</div>
    <ul style="margin:0;padding:0;">${deliveredItemsHtml}</ul>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #2b2940;color:#9d96b7;font-size:13px;line-height:1.7;">
      Si tenes alguna duda o un dato no coincide, responde este mail y lo revisamos.
      <br />Gracias por elegir ${escapeHtml(data.storeName)}.
    </div>
  </div>
</div></body></html>`;
};

export const buildDeliveryEmailText = (data: DeliveryEmailTemplateData) => {
  const customerLine = data.customerName?.trim() ? `Hola ${data.customerName?.trim()},\n\n` : "";

  const itemsSummaryText = data.itemsSummary
    .map((item) => `- ${item.quantity}x ${item.title}: ${item.totalLabel}`)
    .join("\n");

  const deliveredItemsText = data.deliveredItems
    .map((item) => {
      if (item.kind === "out_of_stock") {
        return `• ${item.title}: ${item.notes || "Sin stock disponible por el momento. Te contactamos en breve para resolverlo."}`;
      }

      if (item.kind === "key") {
        return `• ${item.title}: ${item.value}${item.notes ? ` (${item.notes})` : ""}`;
      }

      const fields = item.fields.map((field) => `${field.label}: ${field.value}`).join(" | ");
      return `• ${item.title}: ${fields}${item.notes ? ` (${item.notes})` : ""}`;
    })
    .join("\n");

  return [
    `Pago confirmado - ${data.orderCode}`,
    customerLine.trimEnd(),
    `Fecha: ${data.createdAtLabel}`,
    `Pago: ${data.paymentMethodLabel}`,
    `Total: ${data.totalLabel}`,
    "",
    "Resumen del pedido:",
    itemsSummaryText,
    "",
    "Tus credenciales:",
    deliveredItemsText,
    "",
    `Gracias por elegir ${data.storeName}.`,
  ]
    .filter(Boolean)
    .join("\n");
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}