const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  const code = (req.query.code || '').toString().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Thiếu mã đơn hàng' });

  const { data, error } = await supabase
    .from('orders')
    .select('status, paid_at')
    .eq('code', code)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Lỗi truy vấn đơn hàng' });
  if (!data) return res.status(404).json({ status: 'not_found' });

  return res.status(200).json({ status: data.status, paidAt: data.paid_at });
};
