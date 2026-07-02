const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function generateOrderCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AIM${ts}${rand}`.slice(0, 16);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { course, amount } = req.body || {};
  const numericAmount = Number(amount);

  if (!course || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Thiếu course hoặc amount không hợp lệ' });
  }

  const acc = process.env.SEPAY_ACCOUNT_NUMBER;
  const bank = process.env.SEPAY_BANK_CODE;
  if (!acc || !bank) {
    return res.status(500).json({ error: 'Server chưa cấu hình SEPAY_ACCOUNT_NUMBER / SEPAY_BANK_CODE' });
  }

  const code = generateOrderCode();

  const { error } = await supabase.from('orders').insert({
    code,
    course: String(course).slice(0, 100),
    amount: numericAmount,
    status: 'pending',
  });

  if (error) {
    return res.status(500).json({ error: 'Không thể tạo đơn hàng', detail: error.message });
  }

  const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${numericAmount}&des=${encodeURIComponent(code)}&template=compact`;

  return res.status(200).json({
    code,
    qrUrl,
    accountNumber: acc,
    accountName: process.env.SEPAY_ACCOUNT_NAME || '',
    bankCode: bank,
    amount: numericAmount,
  });
};
