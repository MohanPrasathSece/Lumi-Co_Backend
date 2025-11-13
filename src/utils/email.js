import nodemailer from "nodemailer";

let transporter;

export const getTransporter = () => {
  if (transporter) return transporter;
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn("⚠️ Email credentials missing. Emails will not be sent.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
};

export const sendMail = async ({ to, subject, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn("Skipping email send because transporter is not configured.");
    return;
  }

  await mailer.sendMail({
    from: (process.env.EMAIL_FROM || process.env.SMTP_USER),
    to,
    subject,
    html,
  });
};

export const sendOrderEmails = async ({ order }) => {
  const formattedItems = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #eee;">${item.name}</td>
          <td style="padding: 6px 12px; border: 1px solid #eee;">${item.quantity}</td>
          <td style="padding: 6px 12px; border: 1px solid #eee;">₹${item.price.toLocaleString("en-IN")}</td>
        </tr>
      `
    )
    .join("");

  const orderTable = `
    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr>
          <th style="padding: 8px 12px; text-align: left; background: #f7f1ff; border: 1px solid #eee;">Product</th>
          <th style="padding: 8px 12px; text-align: left; background: #f7f1ff; border: 1px solid #eee;">Qty</th>
          <th style="padding: 8px 12px; text-align: left; background: #f7f1ff; border: 1px solid #eee;">Price</th>
        </tr>
      </thead>
      <tbody>${formattedItems}</tbody>
    </table>
  `;

  const addressBlock = `
    <p style="margin:0;">${order.shippingAddress.line1}</p>
    ${order.shippingAddress.line2 ? `<p style="margin:0;">${order.shippingAddress.line2}</p>` : ""}
    <p style="margin:0;">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}</p>
    <p style="margin:0;">${order.shippingAddress.country}</p>
  `;

  const ownerHtml = `
    <h2 style="font-family: 'Playfair Display', serif; color:#9b2241;">New Lumi & Co. order</h2>
    <p>A new order has been placed on Lumi & Co.</p>
    <p><strong>Customer:</strong> ${order.customer.name}</p>
    <p><strong>Email:</strong> ${order.customer.email}</p>
    <p><strong>Phone:</strong> ${order.customer.phone}</p>
    <p><strong>Order ID:</strong> ${order.razorpayOrderId}</p>
    <p><strong>Payment ID:</strong> ${order.razorpayPaymentId || "Pending"}</p>
    <h3 style="margin-top:24px;">Items</h3>
    ${orderTable}
    <p style="margin-top:24px;"><strong>Total:</strong> ₹${order.amount.toLocaleString("en-IN")}</p>
    <h3 style="margin-top:24px;">Shipping Address</h3>
    ${addressBlock}
  `;

  const customerHtml = `
    <h2 style="font-family: 'Playfair Display', serif; color:#9b2241;">Thank you for your order!</h2>
    <p>Hello ${order.customer.name},</p>
    <p>We're delighted to confirm your Lumi & Co. order. Our artisans will begin preparing your radiant pieces.</p>
    <p><strong>Order reference:</strong> ${order.razorpayOrderId}</p>
    <h3 style="margin-top:24px;">Your Selection</h3>
    ${orderTable}
    <p style="margin-top:24px;"><strong>Total paid:</strong> ₹${order.amount.toLocaleString("en-IN")}</p>
    <h3 style="margin-top:24px;">Shipping Address</h3>
    ${addressBlock}
    <p style="margin-top:24px;">We'll send a dispatch update as soon as your jewels leave our atelier.</p>
    <p style="margin-top:16px;">With warmth,<br/>Lumi & Co.</p>
  `;

  await Promise.all([
    sendMail({ to: (process.env.OWNER_EMAIL || "mohanprasath563@gmail.com"), subject: "New Lumi & Co. Order", html: ownerHtml }),
    sendMail({ to: order.customer.email, subject: "Your Lumi & Co. order is confirmed", html: customerHtml }),
  ]);
};
